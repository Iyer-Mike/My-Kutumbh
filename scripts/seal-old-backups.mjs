/**
 * Sealing the copies that were written before there was a lock
 * ═══════════════════════════════════════════════════════════
 *
 * Run once. Every my-kutumbh_*.json.gz already in the backup folder is
 * read, sealed, written as .json.gz.enc, opened again to prove the
 * seal works, and only then is the plain one removed.
 *
 * The order matters. Those files hold lab values, allergies and
 * medicines in the clear, so they should not survive this — but a
 * plain file deleted before its sealed replacement has been opened
 * would be a backup lost to tidiness, which is worse than the thing
 * being fixed. Nothing is deleted until its replacement has been read
 * back and parsed.
 *
 *   node scripts/seal-old-backups.mjs            do it
 *   node scripts/seal-old-backups.mjs --dry-run  say what would happen
 *
 * OneDrive keeps deleted files for thirty days, so a mistake here is
 * recoverable from its recycle bin — but this does not rely on that.
 */

import { readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync, statSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { homedir } from "node:os";
import { seal, open, SEALED_SUFFIX } from "./backup-crypto.mjs";

const folder = process.env.MY_KUTUMBH_BACKUP_DIR ?? join(homedir(), "OneDrive", "My Kutumbh backups");
const dryRun = process.argv.includes("--dry-run");

const plain = readdirSync(folder)
  .filter((f) => f.startsWith("my-kutumbh_") && f.endsWith(".json.gz"))
  .sort();

if (!plain.length) {
  console.log("Nothing left in the clear. Every backup in the folder is sealed.");
  process.exit(0);
}

console.log(`${plain.length} unsealed backup${plain.length === 1 ? "" : "s"} in ${folder}`);
if (dryRun) console.log("(--dry-run: nothing will be written or deleted)\n");

let sealed = 0, skipped = 0, failed = 0;

for (const name of plain) {
  const from = join(folder, name);
  const to = `${from}${SEALED_SUFFIX}`;

  if (existsSync(to)) {
    console.log(`  ${name} — already has a sealed twin, leaving both alone`);
    skipped++;
    continue;
  }

  try {
    const bytes = readFileSync(from);
    JSON.parse(gunzipSync(bytes).toString("utf8"));   // it was readable to begin with

    if (dryRun) {
      console.log(`  ${name} → ${name}${SEALED_SUFFIX}, then the plain one removed`);
      sealed++;
      continue;
    }

    writeFileSync(to, seal(bytes));

    // Prove the replacement opens BEFORE the original goes
    JSON.parse(gunzipSync(open(readFileSync(to))).toString("utf8"));

    unlinkSync(from);
    console.log(`  ${name} — sealed (${(statSync(to).size / 1024).toFixed(0)} KB), plain copy removed`);
    sealed++;
  } catch (e) {
    console.log(`  ${name} — LEFT ALONE: ${e.message}`);
    failed++;
  }
}

console.log(`\n${sealed} sealed, ${skipped} skipped, ${failed} left alone`);
if (failed) console.log("Anything left alone still holds readable household data. Look at it.");
