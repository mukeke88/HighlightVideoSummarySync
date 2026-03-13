const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("hotkeyBridge", {
  setMonitoring: (enabled) => ipcRenderer.invoke("hotkey:set-monitoring", Boolean(enabled)),
  getMode: () => ipcRenderer.invoke("hotkey:get-mode"),
  onHotkeyK: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = () => callback();
    ipcRenderer.on("hotkey:k", listener);
    return () => {
      ipcRenderer.removeListener("hotkey:k", listener);
    };
  },
});
