const { Client } = require("pg");

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log("CONNECTING SSL...");
    await client.connect();
    console.log("CONNECTED");
    console.log((await client.query("select now()")).rows);
  } catch (e) {
    console.log("PG SSL ERROR");
    console.dir(e, { depth: null });
  } finally {
    try { await client.end(); } catch {}
  }
})();
