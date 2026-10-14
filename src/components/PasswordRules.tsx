"use client";

/** The password rule, checked live as the person types (same rule as the sign-in service). */
export const passwordOk = (p: string) => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);

export default function PasswordRules({ password, touched }: { password: string; touched: boolean }) {
  const rules = [
    { ok: password.length >= 8, label: "8+ characters" },
    { ok: /[A-Za-z]/.test(password), label: "a letter" },
    { ok: /\d/.test(password), label: "a digit" },
  ];
  // Grey while nothing is typed; once they've moved on, unmet rules turn red
  const colour = (ok: boolean) => (ok ? "#2F7D32" : touched && password ? "#A23A1E" : "#8A8299");
  return (
    <p className="text-xs mt-1.5 m-0 flex flex-wrap gap-x-3 gap-y-0.5" aria-live="polite">
      {rules.map((r) => (
        <span key={r.label} style={{ color: colour(r.ok) }}>{r.ok ? "✓" : "○"} {r.label}</span>
      ))}
    </p>
  );
}

export function ConfirmHint({ password, confirm }: { password: string; confirm: string }) {
  if (!confirm) return null;
  const same = password === confirm;
  return (
    <p className="text-xs mt-1.5 m-0" aria-live="polite" style={{ color: same ? "#2F7D32" : "#A23A1E" }}>
      {same ? "✓ Passwords match" : "Doesn't match yet"}
    </p>
  );
}
