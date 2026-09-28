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
 * WHAT IS NOT — the schema itself, and the stored files. The schema
 * needs no copy: it is the twenty-odd migration files in supabase/,
 * kept in git. Photographs and uploaded reports live in Supabase
 * Storage and are not fetched here; there is a note below on that.
 *
 * TO RESTORE — run the migrations in order against a fresh project,
 * then load each table's rows back in. The JSON is plain and ordered,
 * so this can be done by hand if it ever has to be.
 *
 * ── Once, to set up ──────────────────────────────────────────────
 *   setx MY_KUTUMBH_DB_URL "postgresql://postgres.xxxx:PASSWORD@..."
 *   (the Session pooler URI from Supabase → Connect → Direct)
 *
 * For the photographs and uploaded reports as well:
 *   setx MY_KUTUMBH_SUPABASE_URL "https://<project>.supabase.co"
 *   setx MY_KUTUMBH_SERVICE_KEY "<the service_role key>"
 *   (Supabase → Project Settings → API. This key reads everything, so
 *    it belongs in your Windows environment and nowhere near the app.)
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

/**
 * Mirror the stored files — photographs, uploaded medical reports.
 *
 * Needs the project's URL and service key, which a database connection
 * cannot stand in for. Without them the database copy still runs and
 * says plainly that the files were skipped: half a backup that knows
 * it is half is far better than one that quietly isn't.
 */
async function mirrorFiles(db, into) {
  const base = process.env.MY_KUTUMBH_SUPABASE_URL;
  const key = process.env.MY_KUTUMBH_SERVICE_KEY;

  if (!base || !key) {
    console.log("Files: skipped — MY_KUTUMBH_SUPABASE_URL or MY_KUTUMBH_SERVICE_KEY is not set");
    return { mirrored: 0, skipped: "no service key set", listed: 0 };
  }

  const { rows } = await db.query(`
    SELECT bucket_id, name, COALESCE((metadata->>'size')::bigint, 0) AS size
    FROM storage.objects
    ORDER BY bucket_id, name
  `);

  const root = join(into, "files");
  let fetched = 0, already = 0, failed = 0;

  for (const o of rows) {
    const target = join(root, o.bucket_id, ...o.name.split("/"));

    // The same bytes as last night need no second journey
    try {
      if (statSync(target).size === Number(o.size) && Number(o.size) > 0) { already++; continue; }
    } catch { /* not there yet */ }

    try {
      const res = await fetch(`${base}/storage/v1/object/${o.bucket_id}/${encodeURI(o.name)}`, {
        headers: { Authorization: `Bearer ${key}`, apikey: key },
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

      mkdirSync(join(root, o.bucket_id, ...o.name.split("/").slice(0, -1)), { recursive: true });
      writeFileSync(target, Buffer.from(await res.arrayBuffer()));
      fetched++;
    } catch (e) {
      console.log(`  could not fetch ${o.bucket_id}/${o.name}: ${e.message}`);
      failed++;
    }
  }

  console.log(`Files: ${rows.length} in the app — ${fetched} copied, ${already} already held${failed ? `, ${failed} failed` : ""}`);
  return {
    listed: rows.length, mirrored: fetched, alreadyHeld: already, failed,
    where: root,
    note: "Files are mirrored, not re-copied nightly, and never deleted locally — a file removed from the app stays here.",
  };
}

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
      "Photographs and uploaded reports are mirrored beside this file, in files/.",
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
  // These live in Supabase Storage, which a database connection cannot
  // reach, so they need the service key. They are mirrored rather than
  // copied afresh each night: a family photograph is the same bytes
  // every evening, and fourteen copies of a medical report would fill
  // OneDrive for nothing. Nothing here is ever deleted locally — a file
  // removed from the app stays in the mirror, which is the whole point
  // of keeping a copy somewhere else.
  copy.files = await mirrorFiles(client, folder);

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
