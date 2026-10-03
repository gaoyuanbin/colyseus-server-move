const { HelloRoom, SPAWN_X, SPAWN_Y } = require("./HelloRoom");
const { CHARACTERS } = require("./characters");

const PLAYER_HALF_SIZE = 25;

// Ported from PygameFighting's data/game_settings.json ("energy": {"regen_rate": 0.5})
// at its 60fps tick, i.e. +0.5 energy per frame == +30/sec. Applies to every
// character equally - only the cap (player.maxEnergy) varies by character.
const ENERGY_REGEN_PER_SEC = 30;
const ENERGY_TICK_MS = 100;
const ENERGY_PER_TICK = ENERGY_REGEN_PER_SEC * (ENERGY_TICK_MS / 1000);

// Ported from PygameFighting's Player.status_effects / update_status_effects():
// a duration-based effect applied by an attack's "statusEffect" (to whoever it
// hits) or "selfStatusEffect" (to the attacker, cast on use). "stun" and "slow"
// are read and enforced by the client itself (same trust model as movement, which
// the server already doesn't validate); "poison" and "regen" tick hp here since
// that's the authoritative value. A second application of the same type refreshes
// its clock instead of stacking, unlike the original, which just appended freely.
const STATUS_TICK_MS = 100;

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

      if (attack.selfStatusEffect) {
        this.applyStatusEffect(client.sessionId, attacker, attack.selfStatusEffect);
      }
      this.resolveAttack(client, attacker, data.direction, attack);
    });

    // Energy is a private resource (only the owning client needs to see it),
    // so it's ticked server-side and pushed to each client individually
    // rather than broadcast through room state.
    this.setSimulationInterval(() => this.regenEnergy(), ENERGY_TICK_MS);
    this.setSimulationInterval(() => this.tickStatusEffects(), STATUS_TICK_MS);
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
        // A hit that respawns the target clears their effects as part of
        // the reset, so only a survivor picks up the attack's status effect.
        const survived = this.applyDamage(sessionId, target, attack.damage);
        if (survived && attack.statusEffect) {
          this.applyStatusEffect(sessionId, target, attack.statusEffect);
        }
      }
    }
  }

  // Returns true if the target survived the hit (false if they respawned).
  applyDamage(sessionId, target, amount) {
    target.hp -= amount;
    if (target.hp <= 0) {
      target.hp = target.maxHp;
      target.x = SPAWN_X;
      target.y = SPAWN_Y;
      target.statusEffects = [];
      this.broadcast("playerRespawned", { sessionId, x: target.x, y: target.y, hp: target.hp });
      this.broadcast("playerStatusEffects", { sessionId, effects: [] });
      return false;
    }
    this.broadcast("playerHit", { sessionId, hp: target.hp });
    return true;
  }

  applyStatusEffect(sessionId, player, effect) {
    const now = Date.now();
    const tickMs = effect.tickMs || effect.durationMs;
    // Refresh rather than stack: re-applying the same type just resets its clock.
    player.statusEffects = player.statusEffects.filter((e) => e.type !== effect.type);
    player.statusEffects.push({
      type: effect.type,
      endsAt: now + effect.durationMs,
      tickMs,
      nextTickAt: now + tickMs,
      damagePerTick: effect.damagePerTick,
      healPerTick: effect.healPerTick,
    });
    this.broadcast("playerStatusEffects", { sessionId, effects: player.statusEffects.map((e) => e.type) });
  }

  tickStatusEffects() {
    const now = Date.now();
    for (const [sessionId, player] of this.players) {
      if (!player.statusEffects || player.statusEffects.length === 0) continue;

      const before = player.statusEffects.length;
      const remaining = [];
      let respawned = false;
      for (const effect of player.statusEffects) {
        if (now < effect.endsAt) remaining.push(effect);

        if (now < effect.nextTickAt) continue;
        effect.nextTickAt += effect.tickMs;

        if (effect.type === "poison") {
          // applyDamage() already clears+broadcasts player.statusEffects on
          // respawn, so don't let this loop's own bookkeeping stomp on that.
          if (!this.applyDamage(sessionId, player, effect.damagePerTick || 0)) {
            respawned = true;
            break;
          }
        } else if (effect.type === "regen") {
          player.hp = Math.min(player.maxHp, player.hp + (effect.healPerTick || 0));
          this.broadcast("playerHit", { sessionId, hp: player.hp });
        }
      }

      if (respawned) continue;

      player.statusEffects = remaining;
      if (remaining.length !== before) {
        this.broadcast("playerStatusEffects", { sessionId, effects: remaining.map((e) => e.type) });
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
    player.statusEffects = [];
    client.send("imroom", { roomtype: "arena" });
    client.send("energyUpdate", { energy: player.energy });
  }
}

module.exports = { ArenaRoom };
