const fs = require("fs");

const file = "app/(ops)/truvern/ops/page.tsx";
let text = fs.readFileSync(file, "utf8");

text = text.replace(/>\s*Manage[^<]*<\/Link>/g, ">Manage -></Link>");
text = text.replace(/>\s*View all[^<]*<\/Link>/g, ">View all -></Link>");
text = text.replace(/Return to customer app[^\n<]*/g, "Return to customer app ->");

text = text
  .replaceAll("â†’", "->")
  .replaceAll("â€”", "-")
  .replaceAll("â€œ", '"')
  .replaceAll("â€", '"')
  .replaceAll("â€™", "'")
  .replaceAll("→", "->")
  .replaceAll("—", "-");

fs.writeFileSync(file, text, { encoding: "utf8" });
