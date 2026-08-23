import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import { parse } from "dotenv";

const require = createRequire(import.meta.url);
const sharedEnvPath = resolve(process.cwd(), "../nextproject/.env");
const sharedAwsKeys = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_REGION",
  "AWS_S3_BUCKET",
  "KASA_DOCUMENTS_S3_PREFIX",
];

if (existsSync(sharedEnvPath)) {
  const sharedEnv = parse(readFileSync(sharedEnvPath));
  for (const key of sharedAwsKeys) {
    if (!process.env[key] && sharedEnv[key]) process.env[key] = sharedEnv[key];
  }
}

const child = spawn(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "dev"],
  {
    env: process.env,
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
