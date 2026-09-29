import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { gzipSync, gunzipSync } from "node:zlib";
import { seal, open, passphrase } from "./backup-crypto.mjs";

/**
 * The backup holds lab values, allergies and medicines. These tests
 * care about two things only: that what goes in comes back out
 * unchanged, and that everything else fails closed — a wrong
 * passphrase, an altered byte, a file that is not ours.
 */

const PASS = "a long phrase nobody would guess";
const SAMPLE = { tables: { profiles: [{ full_name: "Preethi", conditions: ["anaemia"] }] } };

describe("sealing a backup", () => {
  test("what goes in comes back out", () => {
    const plain = gzipSync(Buffer.from(JSON.stringify(SAMPLE), "utf8"));
    const back = JSON.parse(gunzipSync(open(seal(plain, PASS), PASS)).toString("utf8"));
    assert.deepEqual(back, SAMPLE);
  });

  test("the household's words are not in the sealed bytes", () => {
    const sealed = seal(Buffer.from(JSON.stringify(SAMPLE), "utf8"), PASS);
    assert.doesNotMatch(sealed.toString("latin1"), /Preethi|anaemia/);
  });

  test("the same backup sealed twice looks different", () => {
    const plain = Buffer.from("the same bytes every night", "utf8");
    assert.notEqual(seal(plain, PASS).toString("hex"), seal(plain, PASS).toString("hex"));
  });

  test("a wrong passphrase does not open it", () => {
    const sealed = seal(Buffer.from("secret", "utf8"), PASS);
    assert.throws(() => open(sealed, "the wrong phrase entirely"), /would not open/);
  });

  test("one altered byte does not open it", () => {
    const sealed = seal(Buffer.from("secret", "utf8"), PASS);
    sealed[sealed.length - 1] ^= 0x01;
    assert.throws(() => open(sealed, PASS), /would not open/);
  });

  test("an altered header does not open it either", () => {
    const sealed = seal(Buffer.from("secret", "utf8"), PASS);
    sealed[8] ^= 0x01;                       // inside the salt
    assert.throws(() => open(sealed, PASS), /would not open/);
  });

  test("something that is not a backup is refused, not mangled", () => {
    assert.throws(() => open(gzipSync(Buffer.from("an ordinary gzip")), PASS), /not a sealed/);
    assert.throws(() => open(Buffer.alloc(3), PASS), /not a sealed/);
  });

  test("an empty backup still round-trips", () => {
    assert.equal(open(seal(Buffer.alloc(0), PASS), PASS).length, 0);
  });
});

describe("refusing to write in the clear", () => {
  const saved = process.env.MY_KUTUMBH_BACKUP_PASSPHRASE;
  const restore = () => {
    if (saved === undefined) delete process.env.MY_KUTUMBH_BACKUP_PASSPHRASE;
    else process.env.MY_KUTUMBH_BACKUP_PASSPHRASE = saved;
  };

  test("no passphrase is refused, and the message says how to set one", () => {
    delete process.env.MY_KUTUMBH_BACKUP_PASSPHRASE;
    assert.throws(() => passphrase(), /setx MY_KUTUMBH_BACKUP_PASSPHRASE/);
    restore();
  });

  test("a short passphrase is refused too", () => {
    process.env.MY_KUTUMBH_BACKUP_PASSPHRASE = "short";
    assert.throws(() => passphrase(), /shorter than 12/);
    restore();
  });
});
