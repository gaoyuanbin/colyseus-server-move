import requests
import websocket
import msgpack

ROOM_DATA = 13
JOIN_ROOM = 10

# Step 1: matchmaking
resp = requests.post("http://localhost:2567/matchmake/joinOrCreate/hello_room", json={})
seat = resp.json()
print("Seat:", seat)

# Step 2: connect to room WebSocket
uri = f"ws://localhost:2567/{seat['processId']}/{seat['roomId']}?sessionId={seat['sessionId']}"
print("Connecting to:", uri)

ws = websocket.WebSocket()
ws.connect(uri)

# Step 3: read JOIN_ROOM handshake
raw = ws.recv()
print("Handshake:", bytes(raw).hex())

# Step 3b: acknowledge JOIN_ROOM — server won't deliver messages until this is sent
ws.send_binary(bytes([JOIN_ROOM]))
print("Sent JOIN_ROOM ack")

# Step 4: send ping
msg = bytes([ROOM_DATA]) + msgpack.packb("ping", use_bin_type=True)
ws.send_binary(msg)
print("Sent ping:", msg.hex())

# Step 5: read response
raw = ws.recv()
buf = bytes(raw)
print("Raw response:", buf.hex())

# Step 6: decode
if buf[0] == ROOM_DATA:
    unpacker = msgpack.Unpacker(raw=False)
    unpacker.feed(buf[1:])
    msg_type = next(unpacker)
    try:
        data = next(unpacker)
    except StopIteration:
        data = None
    print(f"Message type: {msg_type!r}")
    print(f"Data: {data!r}")

ws.close()
