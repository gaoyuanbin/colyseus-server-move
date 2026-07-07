const { Room } = require("@colyseus/core");

const MAX_HP = 100;
const ATTACK_DAMAGE = 10;
const ATTACK_COOLDOWN_MS = 500;
const ATTACK_RANGE = 60;
const PLAYER_HALF_SIZE = 25;
const SPAWN_X = 500;
const SPAWN_Y = 300;

class HelloRoom extends Room {
  onCreate() {
    this.players = new Map();

    this.onMessage("move", (client, data) => {
      const player = this.players.get(client.sessionId);
      if (player) {
        player.x = data.x;
        player.y = data.y;
      }
      // broadcast this player's position to everyone else
      this.broadcast("playerMoved", {
        sessionId: client.sessionId,
        x: data.x,
        y: data.y,
      }, { except: client });
    });
    this.onMessage("sayHi", (client, data) => {
      console.log("player",client.sessionId, " said hi");
      this.broadcast("playerSaidHi", {sessionId: client.sessionId,
      x: data.x,
      y: data.y,
      }, { except: client });
    })

    this.onMessage("attack", (client, data) => {
      const attacker = this.players.get(client.sessionId);
      if (!attacker) return;

      const now = Date.now();
      if (now - attacker.lastAttack < ATTACK_COOLDOWN_MS) return;
      attacker.lastAttack = now;

      const direction = data.direction === "left" ? -1 : 1;
      const hitboxX = attacker.x + direction * (ATTACK_RANGE / 2);

      this.broadcast("playerAttacked", {
        sessionId: client.sessionId,
        direction: data.direction,
      });

      for (const [sessionId, target] of this.players) {
        if (sessionId === client.sessionId) continue;
        const dx = Math.abs(target.x - hitboxX);
        const dy = Math.abs(target.y - attacker.y);
        if (dx <= ATTACK_RANGE / 2 + PLAYER_HALF_SIZE && dy <= PLAYER_HALF_SIZE * 2) {
          target.hp -= ATTACK_DAMAGE;

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
    });
  }

  onJoin(client) {
    console.log("Client joined:", client.sessionId);
    this.players.set(client.sessionId, { x: SPAWN_X, y: SPAWN_Y, hp: MAX_HP, lastAttack: 0 });
    this.broadcast("playerJoined", { sessionId: client.sessionId }, { except: client });
  }

  onLeave(client) {
    console.log("Client left:", client.sessionId);
    this.players.delete(client.sessionId);
    // tell everyone to remove this player
    this.broadcast("playerLeft", { sessionId: client.sessionId });
  }
}

module.exports = { HelloRoom };
