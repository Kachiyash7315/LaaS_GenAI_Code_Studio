const languageMap = {
    0: "java",
    1: "python",
    2: "javascript"
}

const technologyIcnMap = {
    0: 'Java',
    1: 'Python',
    2: 'Node.js'
}

const themeMap = {
    0: "monokai",
    1: "dracula",
    2: "twilight",
    3: "solarized_dark",
    4: "solarized_light"
}

const themeBtnMap = {
    0: "monokai-btn",
    1: "dracula-btn",
    2: "twilight-btn",
    3: "solarized-dark-btn",
    4: "solarized-light-btn"
}



let currentLanguage = 0;

var editor = ace.edit("editor", {
    enableBasicAutocompletion: true,
    enableSnippets: true,
    enableLiveAutocompletion: true
});

// let editorMobile = ace.edit("editor-mobile", {
//     enableBasicAutocompletion: true,
//     enableSnippets: true,
//     enableLiveAutocompletion: true 
// });


editor.setOptions({
    formatOnType: true,
});

// editorMobile.setOptions({
//     formatOnType: true,
// })

function selectLanguage(params) {
    var language = document.getElementById("language");
    // var languageMobile = document.getElementById("language-mobile");
    language.innerHTML = technologyIcnMap[params];
    // languageMobile.innerHTML = technologyIcnMap[params];
    currentLanguage = params
    editor.session.setMode(`ace/mode/${languageMap[params]}`);
    // editorMobile.session.setMode(`ace/mode/${languageMap[params]}`);
    currentLanguage = languageMap[params];
}


function runCode() {
    var code = editor.getValue();
    socket.emit("code", {
        type: currentLanguage,
        code: code
    })
}


function changeFontSize(value) {
    let currentFontSize = 15 + "px";
    if (value != null && value != undefined) {
        localStorage.setItem("fontSize", value.value);
    }
    let fontSize = localStorage.getItem("fontSize");
    if (fontSize != null && fontSize != undefined) {
        console.log("if triggered");
        currentFontSize = fontSize + "px";
        editor.setOption("fontSize", currentFontSize);
        document.getElementById("fontSizeValue").innerText = `${currentFontSize}`;
    } else {
        console.log("else triggered");

        localStorage.setItem("fontSize", 15);
        currentFontSize = 15 + "px";
        editor.setOption("fontSize", currentFontSize);
        document.getElementById("fontSizeValue").innerText = '15px';
    }
}

changeFontSize()

function changeTheme(params) {

    if (params != null && params != undefined) {
        localStorage.setItem('theme', params);
        editor.setTheme(`ace/theme/${themeMap[params]}`);
        removeClassAndAddTheme(params);
    } else {
        let theme = localStorage.getItem('theme');
        if (theme != null && theme != undefined) {
            editor.setTheme(`ace/theme/${themeMap[theme]}`);
            removeClassAndAddTheme(theme)
        } else {
            editor.setTheme(`ace/theme/${themeMap[0]}`);
            localStorage.setItem('theme', 0);
            removeClassAndAddTheme(0)
        }
    }
}

changeTheme();


function removeClassAndAddTheme(themeId) {
    let toolbar = document.getElementById("upper-toolbar");
    let sidebar = document.getElementById("my-side-bar");


    sidebar.classList.forEach(function (className) { // Loop through all class names
        sidebar.classList.remove(className); // Remove each class name
    });
    toolbar.classList.forEach(function (className) { // Loop through all class names
        toolbar.classList.remove(className); // Remove each class name
    });

    toolbar.classList.add("nav");
    toolbar.classList.add(themeBtnMap[themeId]);


    sidebar.classList.add("col-3");
    sidebar.classList.add("no-scrollbar");
    sidebar.classList.add(themeBtnMap[themeId]);
}

// Submit handler used by the Submit button in the UI
function submitCode() {
    try {
        const sb = document.getElementById('submitBtn');
        if (sb && sb.disabled) return;

        const params = new URLSearchParams(window.location.search);
        const token = params.get('token') || localStorage.getItem('token');
        let assignmentId = params.get('assignmentId') || params.get('id') || params.get('assignment');
        if (!assignmentId) {
            console.error('submitCode: assignmentId missing from URL');
            alert('Submission failed: assignmentId missing in URL');
            return;
        }
        if (!token) {
            console.error('submitCode: token missing');
            alert('Submission failed: authentication token missing (please login)');
            return;
        }

        const code = (typeof editor !== 'undefined' && editor && typeof editor.getValue === 'function') ? editor.getValue() : '';
        let language = 'java';
        const languageElement = document.getElementById('language');
        if (languageElement && languageElement.textContent && languageElement.textContent.trim() !== 'Select language') {
            const txt = languageElement.textContent.trim().toLowerCase();
            if (txt.includes('python')) language = 'python';
            else if (txt.includes('node') || txt.includes('javascript')) language = 'javascript';
            else language = 'java';
        }

        const backend = `${location.protocol}//${location.hostname}:9696`;
        if (sb) { sb.disabled = true; sb.textContent = 'Submitting...'; }

        fetch(backend + '/api/student/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'authentication': `Bearer ${token}` },
            body: JSON.stringify({ assignmentId, code, language })
        }).then(async (r) => {
            const json = await r.json().catch(() => null);
            if (!r.ok) {
                console.error('submitCode: submit failed', r.status, json);
                alert('Submit failed: ' + (json && json.message ? json.message : r.status));
            } else {
                console.log('submitCode: submit succeeded', json);
                alert('Assignment submitted successfully');
            }
        }).catch((err) => {
            console.error('submitCode: network error', err);
            alert('Submit network error: ' + err.message);
        }).finally(() => {
            if (sb) { sb.disabled = false; sb.textContent = 'Submit'; }
        });
    } catch (err) {
        console.error('submitCode error', err);
        alert('Submit error: ' + (err && err.message ? err.message : 'unknown'));
    }
}


