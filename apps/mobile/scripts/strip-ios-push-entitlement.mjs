import { readFile, writeFile } from "node:fs/promises";

const entitlementsPath = new URL(
  "../ios/KASALifeOS/KASALifeOS.entitlements",
  import.meta.url,
);
const contents = await readFile(entitlementsPath, "utf8");
const localOnly = contents.replace(
  /\s*<key>aps-environment<\/key>\s*<string>[^<]+<\/string>/,
  "",
);

await writeFile(entitlementsPath, localOnly);
console.log(
  "KASA iOS configured for free local notifications (remote push off).",
);
