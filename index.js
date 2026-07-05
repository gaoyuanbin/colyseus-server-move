const { Server } = require("@colyseus/core");
const { WebSocketTransport } = require("@colyseus/ws-transport");
const { HelloRoom } = require("./HelloRoom");

const server = new Server({ transport: new WebSocketTransport() });
server.define("hello_room", HelloRoom);

const port = Number(process.env.PORT) || 2567;
server.listen(port, "0.0.0.0");
console.log(`Colyseus server running on port ${port}`);
