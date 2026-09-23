-- ══════════════════════════════════════════════════════════════════
-- Fix: Remove Preethi's duplicate kutumbh and re-add her as member
-- ══════════════════════════════════════════════════════════════════
-- Real M.IYER Kutumbh (owned by iyer.mike@gmail.com):
--   kutumbh_id = 'ac6a96a3-8704-4eb5-9944-d88788e0a287'
-- Preethi's duplicate (created during RLS bug):
--   kutumbh_id = 'c1df93ba-56a1-49d5-9379-6791de98a896'

-- Step 1: Remove Preethi's membership row in the duplicate kutumbh
DELETE FROM kutumbh_members
WHERE kutumbh_id = 'c1df93ba-56a1-49d5-9379-6791de98a896';

-- Step 2: Delete the duplicate kutumbh itself
DELETE FROM kutumbhs
WHERE id = 'c1df93ba-56a1-49d5-9379-6791de98a896';

-- Step 3: Add Preethi as a proper member of the real M.IYER Kutumbh
INSERT INTO kutumbh_members (kutumbh_id, user_id, role)
SELECT
  'ac6a96a3-8704-4eb5-9944-d88788e0a287',
  id,
  'member'
FROM auth.users
WHERE email = 'iampreethi.225@gmail.com'
ON CONFLICT DO NOTHING;

-- Step 4: Verify — should show 2 rows: Mohan (owner) + Preethi (member)
SELECT
  k.name    AS kutumbh_name,
  u.email,
  p.full_name,
  km.role
FROM kutumbhs k
JOIN kutumbh_members km ON km.kutumbh_id = k.id
JOIN auth.users u       ON u.id = km.user_id
LEFT JOIN profiles p    ON p.id = km.user_id
WHERE k.id = 'ac6a96a3-8704-4eb5-9944-d88788e0a287'
ORDER BY km.role;
