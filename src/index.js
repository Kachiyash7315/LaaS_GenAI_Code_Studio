// const express = require('express')
// const http = require("http");
// const app = express()
// const { Server } = require("socket.io");
// const server = http.createServer(app);
// const io = new Server(server);
// const os = require("os");
// const pty = require('node-pty-prebuilt-multiarch');
// const port = 3000
// const dependancy = require('./inject/dependancy');
// dependancy(app);


// const shell = os.platform() === "win32" ? "powershell.exe" : "bash";


// app.get('/', (req, res) => {
//   res.sendFile(__dirname + "/ui/index.html");
// })


// io.on("connection", (socket) => {
//   console.log("Connection Established");
//   let ptyProcess = pty.spawn(shell, [], {
//     cwd: process.env.HOME,
//     env: process.env,
//   });

//   // Listen on the terminal for output and send it to the client
//   ptyProcess.on('data', function (data) {
//     socket.emit('output', data);
//   });

//   // Listen on the client and send any input to the terminal
//   socket.on("disconnect", function () {
//     ptyProcess.destroy();
//     console.log("bye");
//   });

//   socket.on("start", (data) => {
//     console.log("Started", data);
//     ptyProcess.onData("data")
//     ptyProcess.on("data", function (output) {
//       socket.emit("output", output);
//       console.log(ptyProcess);
//     });
//     ptyProcess.write("./result.out\n");
//   });

//   socket.on("input", (data) => {
//     userInput = data;
//     ptyProcess.write(data);
//     ptyProcess.write('\n');
//   });
//   //Code Runner
//   socket.on("code", (data) => {
//     ptyProcess.write("clear")
//     ptyProcess.write("\n");

//     //Run Python
//     if (data.type == "python") {
//       runner.runPython(data.code, ptyProcess);
//     } else if (data.type == "java") {
//       runner.runJava(data.code, ptyProcess);
//     } else if (data.type == "javascript") {
//       runner.runNode(data.code, ptyProcess);
//     }

//   })
// });


// app.listen(port, () => {
//   console.log(`Code Studio listening on port ${port}`)
// })


const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const os = require("os");
let pty;
try {
    pty = require('node-pty-prebuilt-multiarch');
} catch (e1) {
    try {
        pty = require('node-pty');
    } catch (e2) {
        const child_process = require('child_process');
        pty = {
            spawn: (shell, args, opts) => {
                const cp = child_process.spawn(shell, args || [], { cwd: opts && opts.cwd, env: opts && opts.env, shell: true });
                return {
                    on: (ev, cb) => {
                        if (ev === 'data') {
                            if (cp.stdout) cp.stdout.on('data', (chunk) => cb(chunk.toString()));
                            if (cp.stderr) cp.stderr.on('data', (chunk) => cb(chunk.toString()));
                        } else if (ev === 'exit') {
                            cp.on('exit', cb);
                        }
                    },
                    write: (data) => { if (cp.stdin) cp.stdin.write(data); },
                    destroy: () => { try { cp.kill(); } catch (e) {} }
                };
            }
        };
    }
}
const path = require('path');


const dependancy = require('./inject/dependancy');
const { runPython, runJava } = require("./runner/runner");
dependancy(app);



const shell = os.platform() === "win32" ? "powershell.exe" : "bash";

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/ui/index.html");
});


io.on("connection", (socket) => {
    console.log("Connection Established");
    let ptyProcess = pty.spawn(shell, [], {
        cwd: process.env.HOME,
        env: process.env,
    });

    // Listen on the terminal for output and send it to the client
    ptyProcess.on('data', function (data) {
        socket.emit('output', data);
    });

    // Listen on the client and send any input to the terminal
    socket.on("disconnect", function () {
        ptyProcess.destroy();
        console.log("bye");
    });

    socket.on("start", (data) => {
        console.log("Started", data);
        ptyProcess.onData("data")
        ptyProcess.on("data", function (output) {
            socket.emit("output", output);
            console.log(ptyProcess);
        });
        ptyProcess.write("./result.out\n");
    });

    socket.on("input", (data) => {
        userInput = data;
        ptyProcess.write(data);
        ptyProcess.write('\n');
    });
    //Code Runner
    socket.on("code", (data) => {
        ptyProcess.write("clear")
        ptyProcess.write("\n");
        
        //Run Python
        if(data.type == "python"){
            runPython(data.code, ptyProcess);
        }else if(data.type == "java"){
            runJava(data.code, ptyProcess);
        }else if(data.type=="javascript"){
            runNode(data.code, ptyProcess);
        }
        
    })
});

server.listen(3000, () => {
    console.log("listening on *:3000");
});

