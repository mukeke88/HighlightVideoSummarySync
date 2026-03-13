import { app, BrowserWindow, globalShortcut, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let monitorEnabled = false;

const sendHotkeySignal = () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("hotkey:k");
};

const setGlobalKMonitor = (enabled) => {
  const shouldEnable = Boolean(enabled);
  if (shouldEnable === monitorEnabled) return monitorEnabled;

  if (shouldEnable) {
    const ok = globalShortcut.register("K", sendHotkeySignal);
    monitorEnabled = ok;
    return monitorEnabled;
  }

  globalShortcut.unregister("K");
  monitorEnabled = false;
  return monitorEnabled;
};

const createMainWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 860,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
    return;
  }
  await mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
};

app.whenReady().then(async () => {
  ipcMain.handle("hotkey:set-monitoring", (_, enabled) => ({
    enabled: setGlobalKMonitor(enabled),
  }));
  await createMainWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
