import KutumbhLogo from "./KutumbhLogo";

export default function AuthHeader({ subtitle }: { subtitle: string }) {
  return (
    <div
      className="rounded-3xl px-6 pt-10 pb-8 mb-6 text-center"
      style={{ background: "linear-gradient(160deg, #1C2B1C 0%, #2E4A2C 60%, #3D6638 100%)" }}
    >
      {/* Logo mark */}
      <div className="flex justify-center mb-4">
        <KutumbhLogo size={52} color="#ffffff" />
      </div>

      {/* Brand lockup */}
      <p
        className="text-3xl text-white"
        style={{ fontFamily: "var(--font-dm-serif)" }}
      >
        My Kutumbh
      </p>
      <p className="text-base mt-1" style={{ color: "#8FBF88" }}>
        मेरा कुटुम्ब
      </p>
      <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>
        {subtitle}
      </p>
    </div>
  );
}
