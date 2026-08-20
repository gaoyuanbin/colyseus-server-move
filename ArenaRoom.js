const { HelloRoom, SPAWN_X, SPAWN_Y } = require("./HelloRoom");

const MAX_HP = 100;
const ATTACK_DAMAGE = 10;
const ATTACK_COOLDOWN_MS = 500;
const ATTACK_RANGE = 60;
const ATTACK_ENERGY_COST = 10;
const SUPER_ATTACK_DAMAGE = 25;
const SUPER_ATTACK_COOLDOWN_MS = 3000;
const SUPER_ATTACK_RANGE = 150;
const SUPER_ATTACK_ENERGY_COST = 25;
const PLAYER_HALF_SIZE = 25;

// Ported from PygameFighting's data/game_settings.json ("energy": {"regen_rate": 0.5})
// at its 60fps tick, i.e. +0.5 energy per frame == +30/sec.
const MAX_ENERGY = 100;
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

    this.onMessage("attack", (client, data) => {
      const attacker = this.players.get(client.sessionId);
      if (!attacker) return;

      const now = Date.now();
      if (now - attacker.lastAttack < ATTACK_COOLDOWN_MS) return;
      if (attacker.energy < ATTACK_ENERGY_COST) return;
      attacker.lastAttack = now;
      this.spendEnergy(client, attacker, ATTACK_ENERGY_COST);

      this.resolveAttack(client, attacker, data.direction, {
        damage: ATTACK_DAMAGE,
        range: ATTACK_RANGE,
        hitEvent: "playerAttacked",
      });
    });

    this.onMessage("superAttack", (client, data) => {
      const attacker = this.players.get(client.sessionId);
      if (!attacker) return;

      const now = Date.now();
      if (now - attacker.lastAttack < SUPER_ATTACK_COOLDOWN_MS) return;
      if (attacker.energy < SUPER_ATTACK_ENERGY_COST) return;
      attacker.lastAttack = now;
      this.spendEnergy(client, attacker, SUPER_ATTACK_ENERGY_COST);

      this.resolveAttack(client, attacker, data.direction, {
        damage: SUPER_ATTACK_DAMAGE,
        range: SUPER_ATTACK_RANGE,
        hitEvent: "playerSuperAttacked",
      });
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
      if (!player || player.energy >= MAX_ENERGY) continue;
      player.energy = Math.min(MAX_ENERGY, player.energy + ENERGY_PER_TICK);
      client.send("energyUpdate", { energy: player.energy });
    }
  }

  resolveAttack(client, attacker, direction, { damage, range, hitEvent }) {
    const dir = direction === "left" ? -1 : 1;
    const hitboxX = attacker.x + dir * (range / 2);

    this.broadcast(hitEvent, { sessionId: client.sessionId, direction });

    for (const [sessionId, target] of this.players) {
      if (sessionId === client.sessionId) continue;
      const dx = Math.abs(target.x - hitboxX);
      const dy = Math.abs(target.y - attacker.y);
      if (dx <= range / 2 + PLAYER_HALF_SIZE && dy <= PLAYER_HALF_SIZE * 2) {
        target.hp -= damage;

        if (target.hp <= 0) {
          target.hp = MAX_HP;
          target.x = SPAWN_X;
          target.y = SPAWN_Y;
          this.broadcast("playerRespawned", { sessionId, x: target.x, y: target.y, hp: target.hp });
        } else {
          this.broadcast("playerHit", { sessionId, hp: target.hp });
        }
      }
    }
  }

  onJoin(client) {
    super.onJoin(client);
    const player = this.players.get(client.sessionId);
    player.hp = MAX_HP;
    player.energy = MAX_ENERGY;
    player.lastAttack = 0;
    client.send("imroom", { roomtype: "arena" });
    client.send("energyUpdate", { energy: player.energy });
  }
}

module.exports = { ArenaRoom };
