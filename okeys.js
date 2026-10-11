const fs = require("fs");
const path = require("path");

// Leer JSON original
const inputPath = path.join(__dirname, "keys.json");
const raw = fs.readFileSync(inputPath, "utf-8");
const keys = JSON.parse(raw);

// Codificar cada key y opcionalmente la fecha
const obfuscatedKeys = keys.map(k => ({
  key: Buffer.from(k.key).toString("base64"),
  expires: Buffer.from(k.expires).toString("base64") // opcional
}));

// Guardar en keys.json
const outputPath = path.join(__dirname, "keys.json");
fs.writeFileSync(outputPath, JSON.stringify(obfuscatedKeys, null, 2));

console.log("Keys ofuscadas guardadas en keys.json");
