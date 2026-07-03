const { Server } = require("@colyseus/core");
const { WebSocketTransport } = require("@colyseus/ws-transport");
const { HelloRoom } = require("./HelloRoom");

const server = new Server({ transport: new WebSocketTransport() });
server.define("hello_room", HelloRoom);
server.listen(2567);
console.log("Colyseus server running on ws://localhost:2567");
