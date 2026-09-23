import { BRAND as B } from "@/lib/brand";

export default function AuthHeader({ subtitle }: { subtitle: string }) {
  return (
    <div className="rounded-3xl px-6 pt-10 pb-8 mb-6 text-center" style={{ background: B.headerGradient }}>
      {/* Logo mark */}
      <div className="flex justify-center mb-4">
        <span className="w-[46px] h-[46px] rounded-2xl flex items-center justify-center text-[26px]"
          style={{ background: B.gold, color: "#2A1646", fontFamily: "var(--font-dm-serif)" }}
          role="img" aria-label="My Kutumbh">
          क
        </span>
      </div>

      {/* Brand lockup */}
      <p className="text-3xl text-white" style={{ fontFamily: "var(--font-dm-serif)" }}>
        My Kutumbh
      </p>
      <p className="text-base mt-1" style={{ color: B.onDarkFaint }}>
        मेरा कुटुम्ब
      </p>
      <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.6)" }}>
        {subtitle}
      </p>
    </div>
  );
}
