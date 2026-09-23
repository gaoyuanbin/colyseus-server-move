const { Room } = require("@colyseus/core");
const { CHARACTERS, DEFAULT_CHARACTER_ID } = require("./characters");

const SPAWN_X = 500;
const SPAWN_Y = 300;
const DASH_ENERGY_COST = 15

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
      const sender = this.players.get(client.sessionId);
      this.broadcast("playerSaidHi", {sessionId: client.sessionId,
      x: data.x,
      y: data.y,
      character: sender?.character,
      }, { except: client });

      // The client only sends "sayHi" once its own message handlers are mounted,
      // so replying straight to it (instead of relying on others' broadcasts,
      // which can arrive before those handlers exist) can't be missed.
      for (const [sessionId, other] of this.players) {
        if (sessionId === client.sessionId) continue;
        client.send("playerSaidHi", { sessionId, x: other.x, y: other.y, character: other.character });
      }
    })
  }

  onJoin(client, options) {
    console.log("Client joined:", client.sessionId);
    // `character` picks which data/characters/*.json moveset this player uses.
    // Validated against the known ids (not just relayed) since ArenaRoom trusts
    // it to look up hp/energy caps and attack stats - an unrecognized id falls
    // back to the default character instead of leaving the player without one.
    const character = CHARACTERS[options?.character] ? options.character : DEFAULT_CHARACTER_ID;
    this.players.set(client.sessionId, { x: SPAWN_X, y: SPAWN_Y, character });
    client.send("imroom", { roomtype: "lobby" });
    this.broadcast("playerJoined", { sessionId: client.sessionId, character }, { except: client });
  }

  onLeave(client) {
    console.log("Client left:", client.sessionId);
    this.players.delete(client.sessionId);
    // tell everyone to remove this player
    this.broadcast("playerLeft", { sessionId: client.sessionId });
  }
}

module.exports = { HelloRoom, SPAWN_X, SPAWN_Y };
