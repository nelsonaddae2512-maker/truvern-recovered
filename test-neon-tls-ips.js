const tls = require("tls");

const host = "ep-withered-hall-adpo8e37-pooler.c-2.us-east-1.aws.neon.tech";
const ips = ["44.198.216.75", "3.218.140.61", "54.156.15.30"];

for (const ip of ips) {
  const socket = tls.connect({
    host: ip,
    port: 5432,
    servername: host,
    rejectUnauthorized: false,
    timeout: 10000,
  });

  socket.on("secureConnect", () => {
    console.log(ip, "TLS CONNECTED");
    socket.end();
  });

  socket.on("timeout", () => {
    console.log(ip, "TLS TIMEOUT");
    socket.destroy();
  });

  socket.on("error", (e) => {
    console.log(ip, "TLS ERROR", e.code || e.message);
  });
}
