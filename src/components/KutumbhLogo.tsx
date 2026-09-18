interface KutumbhLogoProps {
  size?: number;
  color?: string;
}

export default function KutumbhLogo({ size = 40 }: KutumbhLogoProps) {
  return (
    <span
      style={{
        fontSize: size * 0.8,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
      }}
      role="img"
      aria-label="My Kutumbh"
    >
      🌿
    </span>
  );
}
