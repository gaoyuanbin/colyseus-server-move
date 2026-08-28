const fs = require("fs");
const path = require("path");

// Ported from PygameFighting's abilities/ folder: each attack (id, damage,
// range, cooldown, energy cost, and client-side effect visuals) lives in its
// own JSON file under data/attacks/. Which files get loaded is listed in
// data/attacks/index.json - to add, remove, or reorder attacks, edit that
// list and its JSON files; nothing here in attacks.js needs to change.
function loadAttacks() {
  const dir = path.join(__dirname, "data", "attacks");
  const files = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8"));
  const attacks = {};
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    attacks[data.id] = data;
  }
  return attacks;
}

const ATTACKS = loadAttacks();

module.exports = { ATTACKS, loadAttacks };
