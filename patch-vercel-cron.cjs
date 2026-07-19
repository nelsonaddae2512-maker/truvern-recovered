const fs = require("fs");

const path = "vercel.json";
const raw = fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "{}";
const json = JSON.parse(raw || "{}");

json.crons = Array.isArray(json.crons) ? json.crons : [];

const cronPath = "/api/cron/reassessment-reminders";
const exists = json.crons.some((c) => c && c.path === cronPath);

if (!exists) {
  json.crons.push({
    path: cronPath,
    schedule: "0 13 * * *"
  });
}

fs.writeFileSync(path, JSON.stringify(json, null, 2) + "\n", "utf8");
