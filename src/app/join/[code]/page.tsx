import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import JoinButton from "./JoinButton";
import { BRAND as B } from "@/lib/brand";

interface Props {
  params: Promise<{ code: string }>;
}

function Tick() {
  return (
    <span className="w-[26px] h-[26px] shrink-0 rounded-[9px] flex items-center justify-center" style={{ background: B.tint }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={B.violet} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 12.5 9 17.5 20 6.5" />
      </svg>
    </span>
  );
}

function Shell({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-8" style={{ background: B.page }}>
      <div className="w-full rounded-3xl overflow-hidden"
        style={{ maxWidth: 400, background: B.card, border: `1px solid ${B.cardEdge}`, boxShadow: "0 4px 24px rgba(36,18,56,0.08)" }}>
        <div className="px-6 pt-8 pb-6" style={{ background: B.headerGradient }}>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center text-[19px]"
              style={{ background: B.gold, color: "#2A1646", fontFamily: "var(--font-dm-serif)" }} aria-hidden>
              क
            </div>
            <div className="grid">
              <span className="text-[19px] leading-tight text-white" style={{ fontFamily: "var(--font-dm-serif)" }}>My Kutumbh</span>
              <span className="text-[11px] tracking-wide" style={{ color: B.onDarkFaint }}>मेरा कुटुम्ब</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 mb-2">
            <span className="block w-[22px] h-px" style={{ background: B.gold }} />
            <span className="text-[11px] uppercase" style={{ letterSpacing: "0.16em", color: B.gold }}>{eyebrow}</span>
          </div>
          <h1 className="m-0 text-white text-[26px]" style={{ fontFamily: "var(--font-dm-serif)", lineHeight: 1.16, textWrap: "balance" }}>
            {title}
          </h1>
        </div>

        <div className="px-6 py-6 grid gap-4">{children}</div>
      </div>
    </div>
  );
}

export default async function JoinPage({ params }: Props) {
  const { code } = await params;
  const clean = code.trim().toUpperCase();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Not signed in: the invite still explains itself. The family's name needs
  // an account to read, so it stays unnamed until they are in.
  if (!user) {
    const next = `/join/${clean}`;
    return (
      <Shell eyebrow="An invitation" title="A place has been kept for you in a Kutumbh">
        <div className="rounded-2xl px-4 py-4 grid gap-3" style={{ background: B.page, border: `1px solid ${B.cardEdge}` }}>
          <p className="m-0 text-[11px] font-semibold uppercase" style={{ letterSpacing: "0.1em", color: B.muted2 }}>
            What joining gives you
          </p>
          <div className="flex gap-3 items-start">
            <Tick />
            <p className="m-0 text-[13px] leading-relaxed" style={{ color: B.ink2 }}>
              The family&apos;s menu each day — you can add dishes to it too.
            </p>
          </div>
          <div className="flex gap-3 items-start">
            <Tick />
            <p className="m-0 text-[13px] leading-relaxed" style={{ color: B.ink2 }}>
              Your own portions, your own insights — nobody else logs for you.
            </p>
          </div>
          <div className="flex gap-3 items-start">
            <Tick />
            <p className="m-0 text-[13px] leading-relaxed" style={{ color: B.ink2 }}>
              Your medical reports stay yours. Only you and the Prime Member can open them.
            </p>
          </div>
        </div>

        <Link href={`/signup?redirect=${encodeURIComponent(next)}`}
          className="block text-center py-3.5 rounded-2xl text-sm font-semibold text-white" style={{ background: B.button }}>
          Create an account to join
        </Link>
        <p className="m-0 text-center text-[13.5px]" style={{ color: B.muted }}>
          Already have an account?{" "}
          <Link href={`/login?redirect=${encodeURIComponent(next)}`} className="font-semibold" style={{ color: B.violetLink }}>
            Sign in to join
          </Link>
        </p>
      </Shell>
    );
  }

  // Look up invite
  const { data: invite } = await supabase
    .from("kutumbh_invites")
    .select("kutumbh_id, expires_at, is_active, kutumbhs(name)")
    .eq("invite_code", clean)
    .single();

  // Check if already a member of any kutumbh
  const { data: existingMember } = await supabase
    .from("kutumbh_members")
    .select("kutumbh_id")
    .eq("user_id", user.id)
    .single();

  const kutumbhName = (invite?.kutumbhs as unknown as { name: string } | null)?.name;
  const expired = invite && new Date(invite.expires_at) < new Date();
  const invalid = !invite || !invite.is_active || expired;

  // Already in this same kutumbh → go straight to family page
  if (existingMember && invite && existingMember.kutumbh_id === invite.kutumbh_id) {
    redirect("/family");
  }

  if (invalid) {
    return (
      <Shell eyebrow="An invitation" title="This invite is no longer open">
        <p className="m-0 text-sm text-center" style={{ color: B.muted }}>
          {!invite
            ? "This invite link is not valid."
            : expired
            ? "This invite link has expired."
            : "This invite link is no longer active."}
        </p>
        <p className="m-0 text-xs text-center" style={{ color: B.muted2 }}>
          Ask the Prime Member to send you a fresh link.
        </p>
        <Link href="/dashboard" className="block text-center py-3.5 rounded-2xl text-sm font-semibold text-white"
          style={{ background: B.button }}>
          Go to my day
        </Link>
      </Shell>
    );
  }

  if (existingMember) {
    return (
      <Shell eyebrow="An invitation" title="You already belong to a Kutumbh">
        <p className="m-0 text-sm text-center" style={{ color: B.muted }}>
          A person can be part of one family at a time.
        </p>
        <Link href="/family" className="block text-center py-3.5 rounded-2xl text-sm font-semibold text-white"
          style={{ background: B.button }}>
          View my Kutumbh
        </Link>
      </Shell>
    );
  }

  return (
    <Shell eyebrow="An invitation" title={`A place has been kept for you at the ${kutumbhName}`}>
      <div className="rounded-2xl px-4 py-4 grid gap-3" style={{ background: B.page, border: `1px solid ${B.cardEdge}` }}>
        <p className="m-0 text-[11px] font-semibold uppercase" style={{ letterSpacing: "0.1em", color: B.muted2 }}>
          What joining gives you
        </p>
        <div className="flex gap-3 items-start">
          <Tick />
          <p className="m-0 text-[13px] leading-relaxed" style={{ color: B.ink2 }}>
            The family&apos;s menu each day — you can add dishes to it too.
          </p>
        </div>
        <div className="flex gap-3 items-start">
          <Tick />
          <p className="m-0 text-[13px] leading-relaxed" style={{ color: B.ink2 }}>
            Your own portions, your own insights — nobody else logs for you.
          </p>
        </div>
        <div className="flex gap-3 items-start">
          <Tick />
          <p className="m-0 text-[13px] leading-relaxed" style={{ color: B.ink2 }}>
            Your medical reports stay yours. Only you and the Prime Member can open them.
          </p>
        </div>
      </div>

      <div className="rounded-2xl px-3.5 py-3 flex gap-2.5 items-start"
        style={{ background: B.goldTint, border: `1px solid ${B.gold}` }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={B.goldInk} strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M12 8h.01" /><path d="M11 12h1v4h1" />
        </svg>
        <p className="m-0 text-[12.5px] leading-relaxed" style={{ color: "#7A5A06" }}>
          The <b>Prime Member</b> of this Kutumbh completes new family dishes and can see everyone&apos;s insights.
        </p>
      </div>

      <JoinButton code={clean} />
    </Shell>
  );
}
