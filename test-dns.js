const dns = require("dns");

dns.lookup(
  "ep-withered-hall-adpo8e37-pooler.c-2.us-east-1.aws.neon.tech",
  { all: true },
  (err, addresses) => {
    console.dir({ err, addresses }, { depth: null });
  }
);
