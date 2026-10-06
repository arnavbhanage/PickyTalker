"use client";
import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PasswordField } from "./password-field";
import { signInWithEmail, signUpWithEmail, signInWithGoogle, requestPasswordReset, resetPassword } from "@/lib/auth-actions";
import { validatePassword } from "@/lib/auth/validation";

export type FormKind = "signin" | "signup" | "forgot" | "reset";
export function AccountForm({ kind, notice }: { kind: FormKind; notice?: string }) {
  const action = kind === "signup" ? signUpWithEmail : kind === "forgot" ? requestPasswordReset : kind === "reset" ? resetPassword : signInWithEmail;
  const [state, formAction, pending] = useActionState(action, {});
  const [clientError, setClientError] = useState<string>();
  const [googlePending, setGooglePending] = useState(false);
  const isNewPassword = kind === "signup" || kind === "reset";
  const isAccount = kind === "signup" || kind === "signin";
  const submitLabel = kind === "signup" ? "Create account" : kind === "forgot" ? "Send reset code" : kind === "reset" ? "Save new password" : "Sign in";
  function validate(event: FormEvent<HTMLFormElement>) {
    setClientError(undefined);
    if (!isNewPassword) return;
    const data = new FormData(event.currentTarget);
    const error = validatePassword(String(data.get("password") ?? ""), String(data.get("confirmPassword") ?? ""));
    if (error) { event.preventDefault(); setClientError(error); }
  }
  const error = clientError ?? state.error;
  return <div className="auth-form-wrap">
    {notice && <Alert className="auth-notice"><AlertDescription>{notice}</AlertDescription></Alert>}
    {isAccount && <>
      <form action={signInWithGoogle} onSubmit={() => setGooglePending(true)}>
        <Button className="auth-google" variant="outline" type="submit" disabled={googlePending || pending}>
          {googlePending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.4a4.6 4.6 0 0 1-2 3v2.6h3.3c1.9-1.8 2.9-4.3 2.9-7.6Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.2l-3.3-2.6c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3v2.7A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 14.1a6 6 0 0 1 0-4.2V7.2H3a10 10 0 0 0 0 9.6l3.4-2.7Z"/><path fill="#EA4335" d="M12 5.8c1.5 0 2.9.5 3.9 1.5l2.9-2.9A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9 5.2l3.4 2.7C7.2 7.6 9.4 5.8 12 5.8Z"/></svg>}
          Continue with Google
        </Button>
      </form>
      <div className="auth-divider"><span />or continue with email<span /></div>
    </>}
    <form action={formAction} onSubmit={validate} onChange={() => setClientError(undefined)} className="auth-form" aria-busy={pending}>
      <fieldset disabled={pending || googlePending}>
        {kind === "signup" && <div className="auth-name-row">
          <div className="auth-field"><Label htmlFor="firstName">First name</Label><Input id="firstName" name="firstName" autoComplete="given-name" placeholder="Tyler" required maxLength={40} /></div>
          <div className="auth-field"><Label htmlFor="lastName">Last name</Label><Input id="lastName" name="lastName" autoComplete="family-name" placeholder="Durden" required maxLength={40} /></div>
        </div>}
        {kind !== "reset" && <div className="auth-field"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="email" placeholder={kind === "signup" ? "fightclub@gmail.com" : "you@example.com"} required maxLength={254} /></div>}
        {kind !== "forgot" && <PasswordField newPassword={isNewPassword} />}
        {isNewPassword && <><p className="auth-field-help">At least 8 characters. Make it unique to you.</p><PasswordField name="confirmPassword" label="Confirm password" newPassword /></>}
        {kind === "signin" && <Link className="auth-forgot" href="/forgot-password">Forgot password?</Link>}
        <div aria-live="polite" aria-atomic="true">{error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}</div>
        <Button type="submit" className="auth-submit" disabled={pending || googlePending}>{pending ? <><LoaderCircle className="animate-spin" aria-hidden="true" /> Please wait…</> : <>{submitLabel}<ArrowRight size={16} aria-hidden="true" /></>}</Button>
      </fieldset>
    </form>
    {kind === "signup" ? <p className="auth-switch">Already have an account? <Link href="/signin">Sign in</Link></p> : kind === "signin" ? <p className="auth-switch">New around here? <Link href="/signup">Create an account</Link></p> : <p className="auth-switch"><Link href="/signin">Back to sign in</Link></p>}
    {isAccount && <p className="auth-legal">By continuing, you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>}
  </div>;
}
