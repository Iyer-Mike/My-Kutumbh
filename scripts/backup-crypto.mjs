/**
 * Locking a backup, and unlocking it again
 * ════════════════════════════════════════
 *
 * The nightly copy holds what the privacy notice calls the app's
 * records: lab values read from blood reports, allergies, medicines,
 * dates of birth, and every meal every member has logged. It is
 * written into OneDrive, which means it is also on Microsoft's
 * servers, and on any machine that syncs the folder.
 *
 * So it is sealed before it is written, and the key never leaves this
 * computer — it is not in the file, not in the repository, and not in
 * Supabase. It is derived from a passphrase held in the Windows user
 * environment, and from nothing else.
 *
 * THE COST, PLAINLY: lose the passphrase and every backup is scrap.
 * There is no recovery, by design — a copy that someone else could
 * open would not be worth making.
 *
 * ── The shape of a sealed file ───────────────────────────────────
 *
 *   MKBK1     5 bytes   so a wrong file is refused, not mangled
 *   salt     16 bytes   fresh per file; two identical backups differ
 *   iv       12 bytes   fresh per file; never reused with one key
 *   tag      16 bytes   GCM's proof that nothing was altered
 *   body        rest    AES-256-GCM over the gzipped JSON
 *
 * AES-256-GCM rather than CBC: it authenticates as well as encrypts,
 * so a file that has been tampered with fails to open rather than
 * opening as something else. scrypt rather than a plain hash, so that
 * a weak passphrase still costs real time and memory to attack.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const MAGIC = Buffer.from("MKBK1", "utf8");
const SALT = 16;
const IV = 12;
const TAG = 16;

// Deliberately slow: ~100ms and 32MB per derivation. Nightly that is
// nothing; to somebody guessing passphrases it is everything.
const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export const SEALED_SUFFIX = ".enc";

/** The passphrase, or a refusal that says how to fix it. */
export function passphrase() {
  const p = process.env.MY_KUTUMBH_BACKUP_PASSPHRASE;
  if (!p || p.length < 12) {
    throw new Error(
      "MY_KUTUMBH_BACKUP_PASSPHRASE is not set, or is shorter than 12 characters.\n" +
        "  The backup holds lab values, allergies and medicines, so it is not written unsealed.\n" +
        '  Set one once:  setx MY_KUTUMBH_BACKUP_PASSPHRASE "a long phrase you will not forget"\n' +
        "  Write it down somewhere that is not this computer. Lose it and the backups are scrap.",
    );
  }
  return p;
}

/** Plain bytes in, sealed bytes out. */
export function seal(plain, pass = passphrase()) {
  const salt = randomBytes(SALT);
  const iv = randomBytes(IV);
  const key = scryptSync(pass, salt, 32, SCRYPT);

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);

  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body]);
}

/** Sealed bytes in, plain bytes out — or a refusal, never a guess. */
export function open(sealed, pass = passphrase()) {
  if (sealed.length < MAGIC.length + SALT + IV + TAG || !sealed.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("That is not a sealed My Kutumbh backup.");
  }

  let at = MAGIC.length;
  const salt = sealed.subarray(at, (at += SALT));
  const iv = sealed.subarray(at, (at += IV));
  const tag = sealed.subarray(at, (at += TAG));
  const body = sealed.subarray(at);

  const decipher = createDecipheriv("aes-256-gcm", scryptSync(pass, salt, 32, SCRYPT), iv);
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([decipher.update(body), decipher.final()]);
  } catch {
    // GCM refused the tag. Either the passphrase is wrong or the file
    // has been altered, and there is no way to tell which — nor should
    // there be.
    throw new Error("It would not open: either the passphrase is wrong, or the file has been altered.");
  }
}
