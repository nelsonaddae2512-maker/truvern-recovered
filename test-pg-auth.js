const { Client } = require("pg");

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log("CONNECTING...");
    await client.connect();
    console.log("AUTHENTICATED");

    const r = await client.query("select current_user, current_database()");
    console.log(r.rows);
  } catch (e) {
    console.log("ERROR DETAILS");
    console.dir({
      name: e.name,
      code: e.code,
      message: e.message,
      severity: e.severity,
      routine: e.routine,
    }, { depth: null });
  } finally {
    try { await client.end(); } catch {}
  }
})();
