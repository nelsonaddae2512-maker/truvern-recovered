const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

client.connect()
  .then(() => {
    console.log("CONNECTED");
    return client.query("select 1 as ok");
  })
  .then((r) => console.log(r.rows))
  .catch((e) => {
    console.error("PG ERROR");
    console.error(e);
  })
  .finally(() => client.end());
