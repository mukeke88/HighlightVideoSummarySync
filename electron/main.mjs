import { app, BrowserWindow, globalShortcut, ipcMain } from "electron";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

let mainWindow = null;
let monitorEnabled = false;
let keyHook = null;
let keyHookListener = null;
let lastKPressAt = 0;

try {
  const module = require("uiohook-napi");
  keyHook = module?.uIOhook ?? null;
} catch {
  keyHook = null;
}

const sendHotkeySignal = () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("hotkey:k");
};

const getHotkeyMode = () => (keyHook ? "hook" : "shortcut");

const isKPressed = (event) => {
  if (!event || typeof event !== "object") return false;
  const rawcode = Number(event.rawcode);
  const keycode = Number(event.keycode);
  // Windows VK_K is 75; libuiohook keycode for K is commonly 37.
  return rawcode === 75 || keycode === 37;
};

const attachKeyHook = () => {
  if (!keyHook) return false;
  if (keyHookListener) return true;
  keyHookListener = (event) => {
    if (!isKPressed(event)) return;
    const now = Date.now();
    if (now - lastKPressAt < 120) return;
    lastKPressAt = now;
    sendHotkeySignal();
  };
  keyHook.on("keydown", keyHookListener);
  keyHook.start();
  return true;
};

const detachKeyHook = () => {
  if (!keyHook || !keyHookListener) return;
  keyHook.off("keydown", keyHookListener);
  keyHookListener = null;
  keyHook.stop();
};

const setGlobalKMonitor = (enabled) => {
  const shouldEnable = Boolean(enabled);
  if (shouldEnable === monitorEnabled) return monitorEnabled;

  if (keyHook) {
    if (shouldEnable) {
      monitorEnabled = attachKeyHook();
      return monitorEnabled;
    }
    detachKeyHook();
    monitorEnabled = false;
    return monitorEnabled;
  }

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
  ipcMain.handle("hotkey:set-monitoring", (_, enabled) => {
    const result = setGlobalKMonitor(enabled);
    return { enabled: result, mode: getHotkeyMode() };
  });
  ipcMain.handle("hotkey:get-mode", () => ({ mode: getHotkeyMode() }));
  await createMainWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("will-quit", () => {
  detachKeyHook();
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
