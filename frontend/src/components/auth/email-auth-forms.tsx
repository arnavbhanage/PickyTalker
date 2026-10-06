"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, ArrowRight, LoaderCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  type AuthFormState,
} from "@/lib/auth-actions";
import { SITE_LINKS } from "@/lib/site-links";

const initialState: AuthFormState = {};

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.4a4.6 4.6 0 0 1-2 3v2.7h3.3c1.9-1.8 2.9-4.4 2.9-7.7Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.3l-3.3-2.6c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.7A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-3.9V7.3H3.1a10 10 0 0 0 0 9.4L6.5 14Z" />
      <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.8 9.8 0 0 0 3.1 7.3l3.4 2.8A5.9 5.9 0 0 1 12 5.9Z" />
    </svg>
  );
}

function FormError({ state }: { state: AuthFormState }) {
  if (!state.error) return null;

  return (
    <Alert className="email-auth-alert" variant="destructive">
      <AlertCircle aria-hidden="true" />
      <AlertDescription>{state.error}</AlertDescription>
    </Alert>
  );
}

export function EmailAuthForms() {
  const [signInState, signInAction, signInPending] = useActionState(signInWithEmail, initialState);
  const [signUpState, signUpAction, signUpPending] = useActionState(signUpWithEmail, initialState);

  return (
    <div className="auth-methods">
      <form action={signInWithGoogle}>
        <Button className="signin-google-button" size="lg" type="submit">
          <GoogleIcon />
          Continue with Google
          <ArrowRight aria-hidden="true" />
        </Button>
      </form>

      <div className="auth-divider" aria-label="Or use email">
        <Separator />
        <span>or use email</span>
        <Separator />
      </div>

      <Tabs className="email-auth-tabs" defaultValue="signin">
        <TabsList className="email-auth-tabs-list">
          <TabsTrigger value="signin">Sign in</TabsTrigger>
          <TabsTrigger value="signup">Create account</TabsTrigger>
        </TabsList>

        <TabsContent value="signin">
          <form action={signInAction} className="email-auth-form">
            <div className="email-auth-field">
              <Label htmlFor="signin-email">Email</Label>
              <Input id="signin-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
            </div>
            <div className="email-auth-field">
              <Label htmlFor="signin-password">Password</Label>
              <Input id="signin-password" name="password" type="password" autoComplete="current-password" placeholder="Your password" minLength={8} required />
            </div>
            <FormError state={signInState} />
            <Button className="email-auth-submit" disabled={signInPending} size="lg" type="submit">
              {signInPending ? <LoaderCircle className="auth-spinner" aria-hidden="true" /> : null}
              {signInPending ? "Signing in…" : "Sign in with email"}
              {!signInPending ? <ArrowRight aria-hidden="true" /> : null}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="signup">
          <form action={signUpAction} className="email-auth-form">
            <div className="email-auth-field">
              <Label htmlFor="signup-name">Name</Label>
              <Input id="signup-name" name="name" type="text" autoComplete="name" placeholder="Your name" minLength={2} maxLength={80} required />
            </div>
            <div className="email-auth-field">
              <Label htmlFor="signup-email">Email</Label>
              <Input id="signup-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
            </div>
            <div className="email-auth-field">
              <Label htmlFor="signup-password">Password</Label>
              <Input id="signup-password" name="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" minLength={8} required />
              <span className="email-auth-hint">Use 8 or more characters.</span>
            </div>
            <div className="email-auth-field">
              <Label htmlFor="signup-confirm-password">Confirm password</Label>
              <Input id="signup-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" placeholder="Repeat your password" minLength={8} required />
            </div>
            <FormError state={signUpState} />
            <Button className="email-auth-submit" disabled={signUpPending} size="lg" type="submit">
              {signUpPending ? <LoaderCircle className="auth-spinner" aria-hidden="true" /> : null}
              {signUpPending ? "Creating account…" : "Create account"}
              {!signUpPending ? <ArrowRight aria-hidden="true" /> : null}
            </Button>
          </form>
        </TabsContent>
      </Tabs>

      <p className="signin-privacy-note">
        By continuing, you agree to the <Link href={SITE_LINKS.terms}>Terms</Link> and acknowledge
        the <Link href={SITE_LINKS.privacy}>Privacy Policy</Link>.
      </p>
    </div>
  );
}
