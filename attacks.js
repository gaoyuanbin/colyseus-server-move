const fs = require("fs");
const path = require("path");

// Ported from PygameFighting's abilities/ folder: every *.json file in
// data/attacks/ describes one attack (id, damage, range, cooldown, energy
// cost, and client-side effect visuals) so attack data lives in JSON,
// not hardcoded constants in the room/scene code.
function loadAttacks() {
  const dir = path.join(__dirname, "data", "attacks");
  const attacks = {};
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith(".json")) continue;
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    attacks[data.id] = data;
  }
  return attacks;
}

const ATTACKS = loadAttacks();

module.exports = { ATTACKS, loadAttacks };
