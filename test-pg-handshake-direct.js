const net = require("net");

const host = "ep-little-cake-adb4xqi6.c-2.us-east-1.aws.neon.tech";
const port = 5432;

const socket = net.createConnection({ host, port }, () => {
  console.log("TCP CONNECTED");

  const buf = Buffer.alloc(8);
  buf.writeInt32BE(8, 0);
  buf.writeInt32BE(80877103, 4);
  socket.write(buf);
});

socket.setTimeout(10000);

socket.on("data", (data) => {
  console.log("SERVER RESPONSE:", data.toString("utf8"), data);
  socket.end();
});

socket.on("timeout", () => {
  console.log("TIMEOUT waiting for PostgreSQL SSL response");
  socket.destroy();
});

socket.on("error", (err) => {
  console.error("SOCKET ERROR", err);
});
