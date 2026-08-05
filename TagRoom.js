const { HelloRoom } = require("./HelloRoom");

const TAG_RANGE = 50;
const TAG_IMMUNITY_MS = 1000;
const CHECK_INTERVAL_MS = 100;

// Small server room: same as HelloRoom, but one player is "it" and tags others by touch.
class TagRoom extends HelloRoom {
  onCreate(options) {
    this.maxClients = 8;
    super.onCreate();

    this.itSessionId = null;
    this.setSimulationInterval(() => this.checkTags(), CHECK_INTERVAL_MS);
  }

  onJoin(client) {
    super.onJoin(client);
    const player = this.players.get(client.sessionId);
    player.lastTagged = 0;

    client.send("imroom", { roomtype: "tag" });

    if (!this.itSessionId) {
      this.setIt(client.sessionId);
    } else {
      client.send("itStatus", { sessionId: this.itSessionId });
    }
  }

  onLeave(client) {
    super.onLeave(client);
    if (client.sessionId === this.itSessionId) {
      const next = this.players.keys().next().value ?? null;
      this.setIt(next);
    }
  }

  setIt(sessionId) {
    this.itSessionId = sessionId;
    this.broadcast("itChanged", { sessionId });
  }

  checkTags() {
    if (!this.itSessionId) return;
    const it = this.players.get(this.itSessionId);
    if (!it) return;

    const now = Date.now();
    for (const [sessionId, player] of this.players) {
      if (sessionId === this.itSessionId) continue;
      if (now - player.lastTagged < TAG_IMMUNITY_MS) continue;

      const dx = Math.abs(player.x - it.x);
      const dy = Math.abs(player.y - it.y);
      if (dx <= TAG_RANGE && dy <= TAG_RANGE) {
        // The outgoing "it" is still standing right next to the new one, so
        // give them (not the newly-tagged player) immunity from an instant tag-back.
        it.lastTagged = now;
        this.setIt(sessionId);
        break;
      }
    }
  }
}

module.exports = { TagRoom };
