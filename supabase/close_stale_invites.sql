-- ═══════════════════════════════════════════════════════════════════
--  Closing the doors nobody walked through
--
--  Every invite link is a way into a family. Seven stand open on the
--  M.IYER Kutumbh and six were never used. They should be shut before
--  any are handed out in earnest.
--
--  The app already closes older links when a new one is made, so these
--  are most likely older than that code. The first query tells us
--  which it is — if a link created AFTER the newest one still shows
--  active, the closing is not working and that is a bug to chase.
-- ═══════════════════════════════════════════════════════════════════

-- ── Before: what stands open, and was it ever used ──
SELECT k.name                                   AS kutumbh,
       i.invite_code,
       i.is_active,
       i.used_count,
       i.expires_at - interval '7 days'         AS made,
       i.expires_at,
       (i.expires_at < now())                   AS already_expired
FROM kutumbh_invites i
JOIN kutumbhs k ON k.id = i.kutumbh_id
ORDER BY i.expires_at DESC;


-- ── Close every link that nobody used ──
--  A link that was used is left as it is: it is part of the record of
--  how someone joined, and closing it changes nothing for them.
UPDATE kutumbh_invites
SET is_active = false
WHERE is_active = true
  AND used_count = 0;


-- ── After: nothing unused should still be open ──
SELECT count(*) FILTER (WHERE is_active AND used_count = 0) AS unused_still_open,
       count(*) FILTER (WHERE is_active)                    AS open_in_all,
       count(*)                                             AS links_in_all
FROM kutumbh_invites;
