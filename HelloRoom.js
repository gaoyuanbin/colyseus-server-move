const { Room } = require("@colyseus/core");

class HelloRoom extends Room {
  onCreate() {
    this.onMessage("move", (client, data) => {
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
    this.broadcast("playerJoined", { sessionId: client.sessionId }, { except: client });
  }

  onLeave(client) {
    console.log("Client left:", client.sessionId);
    // tell everyone to remove this player
    this.broadcast("playerLeft", { sessionId: client.sessionId });
  }
}

module.exports = { HelloRoom };
