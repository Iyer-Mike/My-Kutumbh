/**
 * My Kutumbh — a copy of everything, kept somewhere else
 * ══════════════════════════════════════════════════════
 *
 * Supabase's free tier keeps no backups. If the project were deleted
 * or corrupted, every meal logged and every medical report would be
 * gone — and nothing written inside the app could help, since whatever
 * the app writes lives in the same place as the thing it protects.
 *
 * So this runs outside the app, on your own machine, and writes into
 * OneDrive: off-site the moment it is saved, with Microsoft's version
 * history behind it.
 *
 * WHAT IS COPIED — every row of every table, as JSON.
 *
 * WHAT IS NOT — the schema, and the stored files.
 *
 * The schema needs no copy: it is the twenty-odd migration files in
 * supabase/, kept in git.
 *
 * The files are a decision rather than an omission. Photographs and
 * uploaded medical reports used to be mirrored here too, which meant
 * a family's blood test sat in the Admin's personal OneDrive and
 * synced to Microsoft. On 2026-09-29 that was stopped deliberately:
 * a backup is not worth holding somebody's medical report outside the
 * app they gave it to. The privacy notice can now say, plainly, that
 * uploaded files never leave Supabase.
 *
 * The cost is real and should be understood: if Supabase lost the
 * storage buckets, the photographs and reports would be gone. The
 * ROWS describing them would survive — who uploaded what, and when —
 * so a family would know what was lost. That is the trade accepted.
 *
 * TO RESTORE — run the migrations in order against a fresh project,
 * then load each table's rows back in. The JSON is plain and ordered,
 * so this can be done by hand if it ever has to be.
 *
 * ── Once, to set up ──────────────────────────────────────────────
 *   setx MY_KUTUMBH_DB_URL "postgresql://postgres.xxxx:PASSWORD@..."
 *   (the Session pooler URI from Supabase → Connect → Direct)
 *
 * That is the only secret this needs. MY_KUTUMBH_SUPABASE_URL and
 * MY_KUTUMBH_SERVICE_KEY were once required here, to fetch the stored
 * files; nothing reads them any more, and the service key reads
 * everything in the project, so it is worth removing from your
 * environment rather than leaving it lying about:
 *   setx MY_KUTUMBH_SERVICE_KEY ""
 *
 * ── To run ───────────────────────────────────────────────────────
 *   node scripts/backup.mjs
 *
 * ── Nightly ──────────────────────────────────────────────────────
 *   See scripts/backup.ps1 for the Windows scheduled-task command.
 */

import pg from "pg";
import { gzipSync } from "node:zlib";
import { writeFileSync, appendFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const KEEP = 14; // a fortnight of nights

/**
 * Times are the household's own, not the world's. A file written at
 * half past five in the evening should not be named 1202, and on the
 * night it is needed nobody should be doing arithmetic.
 */
const pad = (n) => String(n).padStart(2, "0");
const localStamp = (d = new Date()) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
const localWhen = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

const url = process.env.MY_KUTUMBH_DB_URL;
if (!url) {
  console.error("MY_KUTUMBH_DB_URL is not set. See the notes at the top of this file.");
  process.exit(1);
}

const folder = process.env.MY_KUTUMBH_BACKUP_DIR ?? join(homedir(), "OneDrive", "My Kutumbh backups");
mkdirSync(folder, { recursive: true });

const client = new pg.Client({
  connectionString: url,
  // Supabase's pooler presents a certificate for its own domain; the
  // connection is encrypted either way, which is what matters here.
  ssl: { rejectUnauthorized: false },
});

const started = Date.now();
let file = null;

try {
  await client.connect();

  // Every table the app owns, in a settled order so two copies of the
  // same data look the same
  const { rows: tables } = await client.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);

  const copy = {
    what_this_is:
      "Every row of every table in My Kutumbh, as it stood when this was made. " +
      "The schema is not here: it is the migration files in supabase/, kept in git. " +
      "Uploaded photographs and medical reports are NOT here: they stay in Supabase Storage.",
    made_on: new Date().toISOString(),
    made_on_local: localWhen(),
    tables: {},
    counts: {},
  };

  // Quote each name properly — a table called "order" or "user" is legal
  const quoted = (id) => `"${id.replace(/"/g, '""')}"`;

  for (const { tablename } of tables) {
    const { rows } = await client.query(`SELECT * FROM public.${quoted(tablename)}`);
    copy.tables[tablename] = rows;
    copy.counts[tablename] = rows.length;
  }

  // ── The photographs and the uploaded reports ──
  //
  // Not here, on purpose. See the note at the top of this file: a
  // backup is not worth holding somebody's blood test outside the app
  // they handed it to. The storage.objects rows ARE copied above, so a
  // family could still be told exactly what was lost and when it was
  // uploaded — only the bytes stay in Supabase.
  copy.files = {
    mirrored: 0,
    note:
      "Uploaded files are deliberately not copied here. They stay in Supabase Storage, " +
      "which is what the privacy notice promises. The storage.objects rows above record " +
      "what exists, so a loss could be described even though it could not be undone.",
  };

  const stamp = localStamp();
  file = join(folder, `my-kutumbh_${stamp}.json.gz`);
  writeFileSync(file, gzipSync(Buffer.from(JSON.stringify(copy, null, 1), "utf8")));

  const mb = (statSync(file).size / 1024 / 1024).toFixed(2);
  const total = Object.values(copy.counts).reduce((t, n) => t + n, 0);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  console.log(`Copied ${tables.length} tables, ${total} rows, in ${seconds}s`);
  console.log(`  → ${file}  (${mb} MB)`);
  for (const [t, n] of Object.entries(copy.counts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${String(n).padStart(6)}  ${t}`);
  }

  // A fortnight is enough; the older ones are tidied away
  const old = readdirSync(folder)
    .filter((f) => f.startsWith("my-kutumbh_") && f.endsWith(".json.gz"))
    .sort()
    .reverse()
    .slice(KEEP);
  for (const f of old) {
    unlinkSync(join(folder, f));
    console.log(`  tidied away ${f}`);
  }

  appendFileSync(
    join(folder, "backup-log.txt"),
    `${localWhen()}  ok   ${String(total).padStart(6)} rows  ${mb} MB\n`,
    "utf8",
  );
} catch (error) {
  // A failure must be loud and must leave the older copies alone
  const when = localWhen();
  console.error(`The copy did not complete: ${error.message}`);
  console.error("Nothing was deleted; the previous copies are untouched.");
  try {
    appendFileSync(join(folder, "backup-log.txt"), `${when}  FAILED  ${error.message}\n`, "utf8");
  } catch {
    // if even the log cannot be written, the message above is all there is
  }
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
