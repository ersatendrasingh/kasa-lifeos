import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/*
 * Clears Turbopack's dev cache.
 *
 * Needed after the Prisma schema changes, because lib/db.ts caches the client on
 * globalThis to avoid opening a new connection on every hot reload. That cached
 * instance keeps the accessors it was built with, so a newly generated model
 * stays invisible (`db.document` reads as undefined) until the dev server is
 * restarted with a cold cache.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

await rm(join(root, ".next"), { recursive: true, force: true });
console.log("Cleared .next — restart the dev server with: npm run dev");
