import "dotenv/config";

import { Client } from "pg";

/*
 * Verifies that the Life Vault migration actually landed.
 *
 * `prisma migrate deploy` reports success once it has run the SQL, but the parts
 * this module depends on are easy to miss by eye: a generated tsvector column, a
 * GIN index, the pg_trgm extension behind the `%` operator. Checking them
 * explicitly turns "the page crashes at runtime" into a clear message here.
 */

const REQUIRED_TABLES = ["Document", "DocumentCategory", "DocumentReminder"];
const REQUIRED_INDEXES = [
  "Document_searchVector_idx",
  "Document_title_trgm_idx",
];

function ok(message) {
  console.log(`  [32m✓[0m ${message}`);
}

function bad(message) {
  console.log(`  [31m✗[0m ${message}`);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
} catch (error) {
  console.error(`\nCould not reach the database: ${error.message}`);
  console.error("Check DATABASE_URL in .env, then run: npm run db:setup\n");
  process.exit(1);
}

console.log("\nLife Vault database check\n");
let failed = false;

const { rows: tables } = await client.query(
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = ANY($1)`,
  [REQUIRED_TABLES],
);
for (const table of REQUIRED_TABLES) {
  if (tables.some((row) => row.table_name === table)) {
    ok(`table ${table}`);
  } else {
    bad(`table ${table} is missing`);
    failed = true;
  }
}

// The search column is GENERATED ALWAYS; a plain tsvector column would silently
// stay empty and every search would return nothing.
const { rows: generated } = await client.query(
  `SELECT is_generated FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'Document'
     AND column_name = 'searchVector'`,
);
if (generated[0]?.is_generated === "ALWAYS") {
  ok("searchVector is a generated column");
} else {
  bad("searchVector column missing or not generated");
  failed = true;
}

const { rows: indexes } = await client.query(
  `SELECT indexname FROM pg_indexes
   WHERE tablename = 'Document' AND indexname = ANY($1)`,
  [REQUIRED_INDEXES],
);
for (const index of REQUIRED_INDEXES) {
  if (indexes.some((row) => row.indexname === index)) {
    ok(`index ${index}`);
  } else {
    bad(`index ${index} is missing`);
    failed = true;
  }
}

const { rows: extensions } = await client.query(
  `SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'`,
);
if (extensions.length > 0) {
  ok("pg_trgm extension");
} else {
  bad("pg_trgm extension missing (partial-word search will fail)");
  failed = true;
}

/*
 * Exercises the real search query rather than trusting the schema alone. This is
 * the one that would surface a permissions problem or a missing operator class.
 */
try {
  await client.query(
    `SELECT "id" FROM "Document"
     WHERE "userId" = $1
       AND ("searchVector" @@ to_tsquery('simple', $2) OR "title" % $3)
     LIMIT 1`,
    ["__verify__", "dl:*", "DL"],
  );
  ok("search query runs");
} catch (error) {
  bad(`search query failed: ${error.message}`);
  failed = true;
}

await client.end();

if (failed) {
  console.log("\nSomething is missing. Try: npx prisma migrate deploy\n");
  process.exit(1);
}

console.log("\nLife Vault is ready. Start the app with: npm run dev\n");
