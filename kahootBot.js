const Kahoot = require("kahoot.js-updated-fixed");

async function botLogic(pin, count, base = "SuperIdol") {
  for (let i = 1; i <= count; i++) {
    const client = new Kahoot();
    const name = `${base}_${i}`;

    client.join(pin, name)
      .then(() => {
        console.log(`✅ ${name} se ha unido`);
        client.on("quizStart", () => {});
        client.on("questionStart", () => {});
        client.on("finish", () => {});
        client.on("disconnect", () => {});
      })
      .catch(err => {
        console.log(`❌ Error con ${name}: ${err.message}`);
      });

    await new Promise(r => setTimeout(r, 200));
  }
}

module.exports = botLogic;
