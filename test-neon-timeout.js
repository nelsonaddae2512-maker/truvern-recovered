const { Client } = require("pg");

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log("CONNECTING...");
    await client.connect();

    console.log("CONNECTED");

    const result = await client.query("select now()");
    console.log(result.rows);
  } catch (e) {
    console.log("PG ERROR FULL");
    console.log("TYPE:", typeof e);
    console.dir(e, { depth: null, colors: false });
  } finally {
    try {
      await client.end();
    } catch {}
  }
})();
