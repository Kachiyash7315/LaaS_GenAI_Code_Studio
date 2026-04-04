function toggleTerminalVisibility() {
    var terminalWindow = document.getElementById("terminal-window");
    var workspaceWindow = document.getElementById("workspace-window");
    if (terminalWindow.style.display === "none") {
        terminalWindow.style.display = "block";
        workspaceWindow.style.height = "60%";
    } else {
        terminalWindow.style.display = "none";
        workspaceWindow.style.height = "100%";
    }
}