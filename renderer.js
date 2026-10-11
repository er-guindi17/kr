const overlay = document.getElementById("key-overlay");
const mainContent = document.getElementById("main-content");
const keyInput = document.getElementById("key-input");
const keySubmit = document.getElementById("key-submit");
const keyError = document.getElementById("key-error");

// Verificación de clave
keySubmit.addEventListener("click", async () => {
  const key = keyInput.value.trim();
  if (!key) {
    keyError.textContent = "Introduce una clave";
    keyError.style.display = "block";
    return;
  }

  const result = await window.electronAPI.verifyKey(key);

  if (result.valid) {
    overlay.style.display = "none";
    mainContent.style.display = "flex";
    keyError.style.display = "none";
  } else {
    keyError.textContent = result.message;
    keyError.style.display = "block";
  }
});

// Control de ventana
document.getElementById("minimize-btn").addEventListener("click", () => {
  window.electronAPI.windowControl("minimize");
});

document.getElementById("maximize-btn").addEventListener("click", () => {
  window.electronAPI.windowControl("maximize");
});

document.getElementById("close-btn").addEventListener("click", () => {
  window.electronAPI.windowControl("close");
});

// Función para iniciar bots
document.getElementById("start-btn").addEventListener("click", async () => {
  const pin = document.getElementById("pin").value.trim();
  const count = parseInt(document.getElementById("count").value);
  const base = document.getElementById("base").value || "SuperIdol";

  if (!pin || isNaN(count) || count <= 0) {
    alert("Introduce un PIN válido y un número de bots mayor que 0");
    return;
  }

  document.getElementById("output").style.display = "block";
  await window.electronAPI.startBots({ pin, count, base });
});
