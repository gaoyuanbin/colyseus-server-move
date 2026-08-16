const { HelloRoom, SPAWN_X, SPAWN_Y } = require("./HelloRoom");

const MAX_HP = 100;
const ATTACK_DAMAGE = 10;
const ATTACK_COOLDOWN_MS = 500;
const ATTACK_RANGE = 60;
const SUPER_ATTACK_DAMAGE = 25;
const SUPER_ATTACK_COOLDOWN_MS = 3000;
const SUPER_ATTACK_RANGE = 120;
const PLAYER_HALF_SIZE = 25;

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
      attacker.lastAttack = now;

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
      attacker.lastAttack = now;

      this.resolveAttack(client, attacker, data.direction, {
        damage: SUPER_ATTACK_DAMAGE,
        range: SUPER_ATTACK_RANGE,
        hitEvent: "playerSuperAttacked",
      });
    });
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
    player.lastAttack = 0;
    client.send("imroom", { roomtype: "arena" });
  }
}

module.exports = { ArenaRoom };
