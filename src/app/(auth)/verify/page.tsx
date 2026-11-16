"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import VerifyEmail from "@/components/VerifyEmail";
import { checkEmail } from "@/lib/auth-error";

/** For someone who registered earlier and never confirmed: the code box, on its own page. */
function Verify() {
  const params = useSearchParams();
  const checked = checkEmail(params.get("email") ?? "");
  if (checked.problem) {
    return (
      <p className="text-sm text-center" style={{ color: "#4A4360" }}>
        We need your email address to confirm it. <Link href="/login" className="font-semibold" style={{ color: "#6B46B8" }}>Go to Sign in</Link>
      </p>
    );
  }
  return <VerifyEmail email={checked.email} next={null} loginHref="/login" />;
}

export default function VerifyPage() {
  return <Suspense><Verify /></Suspense>;
}
