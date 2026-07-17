const { Room } = require("@colyseus/core");

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
  }

  onJoin(client) {
    console.log("Client joined:", client.sessionId);
    this.players.set(client.sessionId, { x: SPAWN_X, y: SPAWN_Y });
    client.send("imroom", { roomtype: "lobby" });
    this.broadcast("playerJoined", { sessionId: client.sessionId }, { except: client });
  }

  onLeave(client) {
    console.log("Client left:", client.sessionId);
    this.players.delete(client.sessionId);
    // tell everyone to remove this player
    this.broadcast("playerLeft", { sessionId: client.sessionId });
  }
}

module.exports = { HelloRoom, SPAWN_X, SPAWN_Y };
