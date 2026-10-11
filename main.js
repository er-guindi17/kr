const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 400,
    height: 600,
    resizable: false,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });
  win.loadFile("index.html");
}

app.whenReady().then(createWindow);

ipcMain.on("window-control", (event, action) => {
  if (!win) return;
  switch (action) {
    case "minimize": win.minimize(); break;
    case "maximize": win.isMaximized() ? win.unmaximize() : win.maximize(); break;
    case "close": win.close(); break;
  }
});

ipcMain.handle("verify-key", async (event, inputKey) => {
  try {
    const filePath = path.join(__dirname, "keys.json");
    if (!fs.existsSync(filePath)) {
      return { valid: false, message: "Archivo de claves no encontrado" };
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    const encodedKeys = JSON.parse(raw);

    // Decodificar Base64
    const keys = encodedKeys.map(k => ({
      key: Buffer.from(k.key, "base64").toString("utf-8"),
      expires: k.expires // si quieres también decodificas la fecha
    }));

    const found = keys.find(k => k.key === inputKey);
    if (!found) {
      return { valid: false, message: "Clave incorrecta" };
    }

    const now = new Date();
    const [day, month, year] = found.expires.split("/").map(Number);
    const expires = new Date(year, month - 1, day, 23, 59, 59);

    if (now > expires) {
      return { valid: false, message: "La clave ha caducado" };
    }

    return { valid: true };
  } catch (err) {
    console.error(err);
    return { valid: false, message: "Error al verificar la clave" };
  }
});

ipcMain.handle("start-bots", async (event, data) => {
  const { pin, count, base } = data;
  const botLogic = require("./kahootBot"); // tu módulo de bots
  await botLogic(pin, count, base);
});
