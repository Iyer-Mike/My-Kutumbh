/**
 * Opening a backup
 * ════════════════
 *
 * The night this is needed will not be a calm one, so it does the
 * least surprising thing possible: point it at a sealed file and it
 * writes the plain JSON beside it and tells you what is inside.
 *
 * With no arguments it opens the newest backup in the usual folder,
 * which is also how you check, on an ordinary Tuesday, that the
 * passphrase you wrote down is the passphrase that works.
 *
 *   node scripts/restore.mjs                      the newest one
 *   node scripts/restore.mjs <file>               a particular one
 *   node scripts/restore.mjs <file> --list        say what is in it, write nothing
 *
 * TO RESTORE THE APP ITSELF: run the migrations in supabase/ in order
 * against a fresh project, then load each table's rows from the JSON.
 * The JSON is plain and ordered, so it can be done by hand.
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import { open, SEALED_SUFFIX } from "./backup-crypto.mjs";

const folder = process.env.MY_KUTUMBH_BACKUP_DIR ?? join(homedir(), "OneDrive", "My Kutumbh backups");

const args = process.argv.slice(2);
const listOnly = args.includes("--list");
let target = args.find((a) => !a.startsWith("--")) ?? null;

if (!target) {
  const newest = readdirSync(folder)
    .filter((f) => f.startsWith("my-kutumbh_") && f.endsWith(SEALED_SUFFIX))
    .sort()
    .reverse()[0];
  if (!newest) {
    console.error(`No sealed backups in ${folder}`);
    process.exit(1);
  }
  target = join(folder, newest);
}

try {
  const copy = JSON.parse(gunzipSync(open(readFileSync(target))).toString("utf8"));

  console.log(`Opened ${basename(target)}`);
  console.log(`  made on ${copy.made_on_local ?? copy.made_on}`);

  const counts = Object.entries(copy.counts ?? {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const total = counts.reduce((t, [, n]) => t + n, 0);
  console.log(`  ${Object.keys(copy.tables ?? {}).length} tables, ${total} rows`);
  for (const [t, n] of counts) console.log(`     ${String(n).padStart(6)}  ${t}`);

  if (listOnly) {
    console.log("\n--list: nothing was written.");
  } else {
    const out = target.replace(new RegExp(`\\.gz${SEALED_SUFFIX}$`), ".json").replace(/\.json\.json$/, ".json");
    writeFileSync(out, JSON.stringify(copy, null, 1), "utf8");
    console.log(`\n  → ${out}`);
    console.log("  Plain JSON, and no longer sealed. Delete it once you are done with it.");
  }
} catch (e) {
  console.error(`Could not open ${basename(target)}: ${e.message}`);
  process.exit(1);
}
