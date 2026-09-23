const fs = require("fs");
const path = require("path");

// Each character (id, name, color, speed, hp/energy caps, and its own full
// attack/superAttack/dash movesets) lives in its own JSON file under
// data/characters/. Which files get loaded is listed in
// data/characters/index.json - to add, remove, or reorder characters, edit
// that list and its JSON files; nothing here needs to change.
function loadCharacters() {
  const dir = path.join(__dirname, "data", "characters");
  const files = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8"));
  const characters = {};
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    characters[data.id] = data;
  }
  return characters;
}

const CHARACTERS = loadCharacters();
const DEFAULT_CHARACTER_ID = Object.keys(CHARACTERS)[0];

module.exports = { CHARACTERS, DEFAULT_CHARACTER_ID, loadCharacters };
