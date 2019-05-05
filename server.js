const net = require('net');
const fs = require("fs");
const readline = require('readline').createInterface({
	input: process.stdin,
	output: process.stdout
})
const cmd = ['to', 'tx', 'fileTxOver'];


var server = {
	s: null,
	socket: null,
	name: null,
	HOST: require("local-ipv4-address")().then((ipAddress) => {
		console.log('my ip address is : ' + ipAddress);
		console.log("Input server name");
		return ipAddress;
	}),
	PORT: 8080
};
var on_data_state = -1,
	chunks = [],
	file_name;
// flag
var is_conn = false,
	wait_rx_res = false,
	wait_tx_res = false,
	rx_file = false;

readline.on('line', line => {
	if (!server.name) {
		line = line.trim();
		if (line.length < 1) {
			console.log("Input server name");
		}
		else {
			server.name = line;
			CreServer();
		}
	}
	else if (is_conn) {
		var par = line.split(' ');
		// to
		if (par[0] == cmd[0]) {
			server.socket.write(server.name + ": " + line);
		}
		// tx
		else if (par[0] == cmd[1]) {
			if (par.length != 2) {
				console.log('tx command error');
				return;
			}
			// file exist?
			if (fs.existsSync(par[1])) {
				wait_tx_res = true;
				file_name = par[1];
				server.socket.write(server.name + ": " + line);
			}
			else
				console.log('file is not exist')
		}
		// wait recieve response
		else if (wait_rx_res) {
			wait_rx_res = false;
			if (par[0] === 'y' && par.length === 1) {
				rx_file = true;
				server.socket.write(server.name + ": " + line);
			}
			else {
				on_data_state = -1;
				server.socket.write(server.name + ': not allow recieve file');
				console.log('not allow recieve file');
			}
		}
		else
			console.log('command error');
	}
	else
		console.log('not connected yet');
});



function CreServer() {
	server.s = net.createServer()
		.listen(server.PORT, server.HOST);

	server.s.on('connection', (socket) => {
		is_conn = true;
		console.log('Server has a new connection');
		console.log('	IP：' + socket.remoteAddress);
		console.log('	PORT：' + socket.remotePort);

		socket.on('data', (data) => {
			var par = data.toString().split(' ');

			if (wait_tx_res) {
				wait_tx_res = false;
				if (par[1] === 'y' && par.length == 2) {
					console.log('will transfer file, ' + file_name)
					fs.readFile(file_name, (err, data) => {
						server.socket.write(data);
						server.socket.write(' fileTxOver');
						console.log('file transfer over');
					});
				}
			}
			else if (on_data_state != 1) {
				cmd.forEach((e) => {
					if (e === par[1])
						on_data_state = cmd.indexOf(e);
				});
				if (on_data_state == 1) {
					wait_rx_res = true;
					var reg = /\./;
					var insertStr = "_copy."
					file_name = par[2].replace(reg, insertStr);

					console.log(data.toString());
					console.log('allow the file, ' + file_name + '?');
				}
			}
			else {
				if (cmd[2] === par[par.length - 1]) {
					rx_file = false;
					on_data_state = 2;
					// last data 
					// remove 'fileTxOver'
					chunks.push(data.slice(0, data.length - 10));
				}
			}

			switch (on_data_state) {
				// 0-> send message
				// 1-> push data to chunks
				// 2-> write file 
				case 0:
					console.log(data.toString())
					break;
				case 1:
					if (rx_file)
						chunks.push(data);
					break;
				case 2:
					var buf = Buffer.concat(chunks);
					
					(async () => {
						console.log('get the file, ' + file_name);
						await fs.writeFile(file_name, buf, (err) => {
							if (err) throw err;
						});
						chunks = [];
					})();
					break;
			}

			// keep 1, or = -1
			on_data_state = (on_data_state == 1) ? 1 : -1;
		});
		server.socket = socket;
	});

	server.s.on('error', () => {
		console.log('Server error');
		server.s.end();
	});

	server.s.on('close', () => {
		console.log('Server closed');
		process.exit()
	});
}
