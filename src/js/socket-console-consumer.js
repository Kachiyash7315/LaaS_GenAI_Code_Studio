let consoleHistory = [];

let currentIndex = 0;

var term = new Terminal({
    cursorBlink: "block",
    rows: 10,
    cols: 10,
    fontSize: 10,

});

var term2 = new Terminal({
    cursorBlink: "block",
    rows: 10,
    cols: 10,
    fontSize: 10,
});

// term.terminalOptions = {

//     cursorBlink: true,
//     enableBold: true,
//     cols: 80,
//     rows: 40,
//     screenKeys: true
//   };

//Uncomment on Deployment
// const socket = io("http://154.26.154.29"); 

const socket = io();
console.log(socket);
var curr_line = "";
var entries = [];

var documentTerminal = document.getElementById('terminal');
var documentTerminalMobile = document.getElementById('terminalMobile');
term.open(documentTerminal);
// term2.open(documentTerminalMobile);

//-------------------Write Data To Terminal-------------------------------//

// term.onData(e => {
//     term.write(e)
// })

//-------------------When Msg Comes from Backend-------------------------------//
socket.on('output', function (data) {
    let printLn = true;
    if (data.trim() === curr_line.trim()) {
        printLn = false;
    }
    console.log(printLn);
    curr_line = "";
    console.log(data);
    if (printLn) {
        term.write(data);
        term2.write(data);
    }
    printLn = true;
});


term.onKey((key) => {
    console.log(key)
    if (key.key === "\r") {
        if (curr_line != "") {
            term.write("\n\r");
            term2.write("\n\r");
            socket.emit("input", curr_line);
            consoleHistory.push(curr_line);
        }
    } else if (key.key === "\u007f") {
        if (curr_line) {
            curr_line = curr_line.slice(0, curr_line.length - 1);
            term.write("\b \b");
            term2.write("\b \b");
        }
    }
    else {
        console.log("Else");
        curr_line += key.key;
        term.write(key.key);
        term2.write(key.key);
    }
    console.log("This is curr line " + curr_line);
})


term2.onKey((key) => {
    console.log(key)
    if (key.key === "\r") {
        if (curr_line != "") {
            term.write("\n\r");
            term2.write("\n\r");
            consoleHistory.push(curr_line);
            socket.emit("input", curr_line);
        }
    } else if (key.key === "\u007f") {
        if (curr_line) {
            curr_line = curr_line.slice(0, curr_line.length - 1);
            term.write("\b \b");
            term2.write("\b \b");
        }
    } else if (key.key === "\u001b[A") {

    } else {
        console.log("Else");
        curr_line += key.key;
        term.write(key.key);
        term2.write(key.key);
    }
    console.log("This is curr line " + curr_line);
})




//--- tools -----

//clear the terminal 

function clearTerminal() {
    socket.emit("input", "clear");
}


//Keep track of device height and width


function terminalSizeAdjust(width) {
    const initWidth = width;
    let initFontSize;
    let intCols;
    let intRows;
    if (initWidth < 400) {
        initFontSize = 11;
        intCols = 40;
        intRows = 40
    }
    else if (initWidth > 400 && initWidth < 500) {
        initFontSize = 11;
        intCols = 54;
        intRows = 40;
    }
    else if (initWidth > 500 && initWidth < 600) {
        initFontSize = 11;
        intCols = 63;
        intRows = 40;
    }
    else if (initWidth > 600 && initWidth < 700) {
        initFontSize = 11;
        intCols = 65;
        intRows = 40;

    }
    else if (initWidth > 700 && initWidth < 800) {
        initFontSize = 11;
        intCols = 75;
        intRows = 12;

    } else if (initWidth >= 800 && initWidth < 850) {
        initFontSize = 12;
        intCols = 75
        intRows = 12;

    } else {
        initFontSize = 14;
        intCols = 80;
        intRows = 12;
    }

    term._publicOptions.fontSize = initFontSize;
    term2._publicOptions.fontSize = initFontSize;
    term.resize(intCols, intRows)
    term2.resize(intCols, intRows)
    // console.log(term._publicOptions.set("cols"));
    // term._publicOptions.rows = rows;

}


terminalSizeAdjust(window.innerWidth);


window.addEventListener("resize", function () {
    const width = window.innerWidth;
    const height = window.innerHeight;
    // do something with the updated width and height

    console.log(width, height);

    // term.fontSize = 10;

    console.log(term);

    terminalSizeAdjust(width);


    // term.terminalOptions = {
    //     fontSize: 20,
    // }

    // term.refresh(0, term.rows - 1);
});


// Navigate through history
// term.onKey((e) => {
//     console.log("my key is",e);
//     if (e.key === 'ArrowUp' || e.key==='\u001b[A') {
//       term.write('\x1b[A'); // Move cursor up
//       term.write(term.history.getPrevious());
//     } else if (e.key === 'ArrowDown') {
//       term.write('\x1b[B'); // Move cursor down
//       term.write(term.history.getNext());
//     }
//   });


//-----------Code Runner ------------------









