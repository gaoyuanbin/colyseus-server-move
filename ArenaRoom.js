const { HelloRoom, SPAWN_X, SPAWN_Y } = require("./HelloRoom");
const { CHARACTERS } = require("./characters");

const PLAYER_HALF_SIZE = 25;

// Ported from PygameFighting's data/game_settings.json ("energy": {"regen_rate": 0.5})
// at its 60fps tick, i.e. +0.5 energy per frame == +30/sec. Applies to every
// character equally - only the cap (player.maxEnergy) varies by character.
const ENERGY_REGEN_PER_SEC = 30;
const ENERGY_TICK_MS = 100;
const ENERGY_PER_TICK = ENERGY_REGEN_PER_SEC * (ENERGY_TICK_MS / 1000);

// Small server room: same as HelloRoom, but attacking is allowed.
// Players create/join these individually, so many can run at once.
class ArenaRoom extends HelloRoom {
  async onCreate(options) {
    this.maxClients = 8;
    await this.setMetadata({ name: options?.name || "Arena" });

    super.onCreate();

    // Single generic handler: the attack's own stats (damage, range,
    // cooldown, energy cost) come from the attacker's own character
    // (data/characters/*.json) — nothing attack-specific is hardcoded here.
    this.onMessage("attack", (client, data) => {
      const attacker = this.players.get(client.sessionId);
      if (!attacker) return;

      const attack = CHARACTERS[attacker.character]?.attacks?.[data.attackId];
      if (!attack) return;

      const now = Date.now();
      const lastUsed = attacker.lastAttack[attack.id] || 0;
      if (now - lastUsed < attack.cooldownMs) return;
      if (attacker.energy < attack.energyCost) return;
      attacker.lastAttack[attack.id] = now;
      this.spendEnergy(client, attacker, attack.energyCost);

      this.resolveAttack(client, attacker, data.direction, attack);
    });

    // Energy is a private resource (only the owning client needs to see it),
    // so it's ticked server-side and pushed to each client individually
    // rather than broadcast through room state.
    this.setSimulationInterval(() => this.regenEnergy(), ENERGY_TICK_MS);
  }

  spendEnergy(client, player, cost) {
    player.energy = Math.max(0, player.energy - cost);
    client.send("energyUpdate", { energy: player.energy });
  }

  regenEnergy() {
    for (const client of this.clients) {
      const player = this.players.get(client.sessionId);
      if (!player || player.energy >= player.maxEnergy) continue;
      player.energy = Math.min(player.maxEnergy, player.energy + ENERGY_PER_TICK);
      client.send("energyUpdate", { energy: player.energy });
    }
  }

  resolveAttack(client, attacker, direction, attack) {
    const dir = direction === "left" ? -1 : 1;
    const hitboxX = attacker.x + dir * (attack.range / 2);

    this.broadcast("playerAttacked", { sessionId: client.sessionId, attackId: attack.id, direction });

    for (const [sessionId, target] of this.players) {
      if (sessionId === client.sessionId) continue;
      const dx = Math.abs(target.x - hitboxX);
      const dy = Math.abs(target.y - attacker.y);
      if (dx <= attack.range / 2 + PLAYER_HALF_SIZE && dy <= attack.height / 2 + PLAYER_HALF_SIZE) {
        target.hp -= attack.damage;

        if (target.hp <= 0) {
          target.hp = target.maxHp;
          target.x = SPAWN_X;
          target.y = SPAWN_Y;
          this.broadcast("playerRespawned", { sessionId, x: target.x, y: target.y, hp: target.hp });
        } else {
          this.broadcast("playerHit", { sessionId, hp: target.hp });
        }
      }
    }
  }

  onJoin(client, options) {
    super.onJoin(client, options);
    const player = this.players.get(client.sessionId);
    // super.onJoin() already validated player.character against CHARACTERS,
    // so this lookup is guaranteed to succeed.
    const character = CHARACTERS[player.character];
    player.maxHp = character.maxHp;
    player.hp = character.maxHp;
    player.maxEnergy = character.maxEnergy;
    player.energy = character.maxEnergy;
    player.lastAttack = {};
    client.send("imroom", { roomtype: "arena" });
    client.send("energyUpdate", { energy: player.energy });
  }
}

module.exports = { ArenaRoom };
