const http = require("http");
const express = require("express");
const { Server, matchMaker } = require("@colyseus/core");
const { WebSocketTransport } = require("@colyseus/ws-transport");
const { HelloRoom } = require("./HelloRoom");
const { ArenaRoom } = require("./ArenaRoom");

const app = express();
app.get("/", (req, res) => res.send("OK"));

// Lets clients list open arenas so players can pick one to join.
app.get("/arenas", async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  const rooms = await matchMaker.query({ name: "arena_room" });
  res.json(rooms.map((room) => ({
    roomId: room.roomId,
    name: room.metadata?.name,
    clients: room.clients,
    maxClients: room.maxClients,
  })));
});

const httpServer = http.createServer(app);

const server = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});
server.define("hello_room", HelloRoom);
server.define("arena_room", ArenaRoom);

const port = Number(process.env.PORT) || 2567;
server.listen(port);
console.log(`Colyseus server running on port ${port}`);
