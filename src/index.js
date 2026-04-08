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
const fs = require('fs');


const dependancy = require('./inject/dependancy');
const { runPython, runJava } = require("./runner/runner");
dependancy(app);

// Ensure vendor files (tf.min.js, blazeface.min.js) exist under src/js/vendor.
// If missing, attempt to download from CDN and save locally so the client can load them.
async function ensureVendorFiles(){
    const vendorDir = path.join(__dirname, 'js', 'vendor');
    try{ fs.mkdirSync(vendorDir, { recursive: true }); }catch(e){}

    const files = [
        { name: 'tf.min.js', urls: ['https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.21.0/dist/tf.min.js','https://unpkg.com/@tensorflow/tfjs@3.21.0/dist/tf.min.js'] },
        { name: 'blazeface.min.js', urls: ['https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.0.8/dist/blazeface.min.js','https://unpkg.com/@tensorflow-models/blazeface@0.0.8/dist/blazeface.min.js'] }
    ];

    const https = require('https');

    for(const f of files){
        const dest = path.join(vendorDir, f.name);
        if(fs.existsSync(dest) && fs.statSync(dest).size > 100) { console.log('Vendor exists:', f.name); continue; }
        let downloaded = false;
        for(const url of f.urls){
            try{
                console.log('Downloading', url, '->', dest);
                await new Promise((resolve, reject)=>{
                    const req = https.get(url, (res) => {
                        if(res.statusCode && res.statusCode >= 400){
                            reject(new Error('HTTP ' + res.statusCode));
                            return;
                        }
                        const file = fs.createWriteStream(dest);
                        res.pipe(file);
                        file.on('finish', ()=> file.close(resolve));
                        file.on('error', (err)=>{ try{ fs.unlinkSync(dest); }catch(e){}; reject(err); });
                    });
                    req.on('error', (err)=> reject(err));
                });
                console.log('Downloaded', f.name);
                downloaded = true;
                break;
            }catch(err){ console.warn('Failed to download', url, err && err.message ? err.message : err); }
        }
        if(!downloaded) console.warn('Could not obtain vendor file', f.name);
    }
}

// Vendor proxy: serve requested vendor JS from local file if present, otherwise stream from CDN.
// This helps clients load large libs like tf.min.js and blazeface.min.js when they are not available locally.
app.get(['/vendor/:name', '/js/vendor/:name'], (req, res) => {
    const name = req.params.name;
    const localPaths = [
        path.join(__dirname, 'js', 'vendor', name),
        path.join(__dirname, '..', 'vendor', name),
        path.join(__dirname, 'vendor', name)
    ];
    for (const p of localPaths) {
        try {
            if (require('fs').existsSync(p)) {
                return res.sendFile(p);
            }
        } catch (e) {}
    }

    // Map known files to stable CDN locations
    const cdnMap = {
        'tf.min.js': 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.21.0/dist/tf.min.js',
        'blazeface.min.js': 'https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.0.8/dist/blazeface.min.js'
    };
    const remote = cdnMap[name] || `https://cdn.jsdelivr.net/npm/${name}`;

    const https = require('https');
    try {
        https.get(remote, (proxRes) => {
            if (proxRes.statusCode && proxRes.statusCode >= 400) {
                res.status(proxRes.statusCode).send(`Failed to proxy ${name}`);
                return;
            }
            res.setHeader('Content-Type', 'application/javascript');
            proxRes.pipe(res);
        }).on('error', (err) => {
            console.error('Vendor proxy error', err);
            res.status(502).send('Vendor proxy error');
        });
    } catch (err) {
        console.error('Vendor proxy exception', err);
        res.status(500).send('Vendor proxy exception');
    }
});



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

// Ensure vendor files, then start server
ensureVendorFiles().then(()=>{
    server.listen(3000, () => {
        console.log("listening on *:3000");
    });
}).catch(err=>{
    console.warn('ensureVendorFiles failed:', err);
    server.listen(3000, () => {
        console.log("listening on *:3000 (vendors may be missing)");
    });
});

