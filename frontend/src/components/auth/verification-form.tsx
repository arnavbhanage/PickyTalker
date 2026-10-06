"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { LoaderCircle, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import CodeSlots from "./CodeSlots";
import { AccountForm } from "./account-form";
import { resendResetCode, resendVerificationCode, verifyEmailCode, verifyResetCode, type AuthFormState } from "@/lib/auth-actions";

export function VerificationForm({ purpose, email, initialResendAt, resetVerified = false }: { purpose: "verify" | "reset"; email: string; initialResendAt: number; resetVerified?: boolean }) {
  const [state, action, pending] = useActionState(purpose === "reset" ? verifyResetCode : verifyEmailCode, {});
  const [code, setCode] = useState("");
  const [edited, setEdited] = useState(false);
  const [ignoreVerificationError, setIgnoreVerificationError] = useState(false);
  const router = useRouter();
  const [resendState, setResendState] = useState<AuthFormState>({});
  const [resendPending, startResend] = useTransition();
  const [resendAt, setResendAt] = useState(initialResendAt);
  const [seconds, setSeconds] = useState(() => Math.max(0, Math.ceil((initialResendAt - Date.now()) / 1000)));
  useEffect(() => {
    const tick = () => setSeconds(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [resendAt]);
  useEffect(() => {
    if (!state.success || purpose !== "verify") return;
    const timer = setTimeout(() => { router.replace("/app"); router.refresh(); }, 350);
    return () => clearTimeout(timer);
  }, [state.success, purpose, router]);
  if (purpose === "reset" && (resetVerified || state.success)) return <><p className="auth-code-success" role="status"><MailCheck size={18} aria-hidden="true" /> Email confirmed. Set your new password.</p><AccountForm kind="reset" /></>;
  const error = (!ignoreVerificationError ? state.error : undefined) ?? resendState.error;
  return <div className="auth-verification">
    <div className="auth-email-target"><MailCheck aria-hidden="true" /><p>{purpose === "reset" ? "If your account uses a password, check the inbox for" : "We sent a six-digit code to"}<strong>{email}</strong></p></div>
    <form action={action} onSubmit={() => { setEdited(false); setIgnoreVerificationError(false); setResendState({}); }} aria-busy={pending}>
      <CodeSlots value={code} onChange={value => { setCode(value); setEdited(true); }} status={state.success ? "success" : state.error && !edited && !pending ? "error" : "idle"} disabled={pending || resendPending || state.success} autoFocus slotSize={40} gap={7} radius={9} ariaLabel="Six-digit email verification code" />
      <p className="auth-code-help">Your code expires after 10 minutes.</p>
      <div className="auth-feedback" aria-live="polite" aria-atomic="true">{error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}{resendState.message && <p>{resendState.message}</p>}{state.success && <p>Code accepted. Opening your workspace…</p>}</div>
      <Button className="auth-submit" type="submit" disabled={code.length !== 6 || pending || resendPending || state.success}>{pending ? <><LoaderCircle className="animate-spin" aria-hidden="true" /> Verifying…</> : state.success ? "Verified" : purpose === "reset" ? "Verify reset code" : "Verify email"}</Button>
    </form>
    <div className="auth-resend"><span>Didn’t receive it?</span><Button variant="ghost" type="button" disabled={seconds > 0 || resendPending || pending} onClick={() => startResend(async () => {
      const result = await (purpose === "reset" ? resendResetCode() : resendVerificationCode());
      setResendState(result);
      if (result.resendAt) { setResendAt(result.resendAt); setSeconds(Math.max(0, Math.ceil((result.resendAt - Date.now()) / 1000))); }
      if (!result.error) { setCode(""); setEdited(true); setIgnoreVerificationError(true); }
    })}>{resendPending ? "Sending…" : seconds > 0 ? "Resend available in " + seconds + "s" : "Resend code"}</Button></div>
    <span className="sr-only" role="status">{seconds > 0 ? "Resend is temporarily unavailable." : "You can now resend the code."}</span>
    <p className="auth-switch"><Link href={purpose === "reset" ? "/forgot-password" : "/signin"}>Use a different email</Link></p>
  </div>;
}
