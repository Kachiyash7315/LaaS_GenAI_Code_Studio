const fse = require('fs-extra');
module.exports.runPython = function runPython(code, ptyProcess) {
    let filePath = `${process.env.HOME}/codes/main.py`;
    let script = `python3 ${filePath}`
    fse.outputFileSync(filePath, code) 
    ptyProcess.write(script);
    ptyProcess.write("\n");
};

module.exports.runJava = function runJava(code, ptyProcess) {
    let filePath = `${process.env.HOME}/codes/Main.java`;
    let compileScript = `javac ${filePath}`;
    let runScript = `java ${filePath}`;
    fse.outputFileSync(filePath, code) 
    ptyProcess.write(compileScript);
    ptyProcess.write("\n");
    ptyProcess.write(runScript);
    ptyProcess.write("\n");
}