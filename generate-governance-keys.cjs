const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 4096,
  publicKeyEncoding: {
    type: "spki",
    format: "pem",
  },
  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem",
  },
});

const outDir = path.join(process.cwd(), "governance-keys");

fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(
  path.join(outDir, "truvern-governance-private.pem"),
  privateKey,
);

fs.writeFileSync(
  path.join(outDir, "truvern-governance-public.pem"),
  publicKey,
);

console.log("Generated governance signing keys:");
console.log(outDir);
