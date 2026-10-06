"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { signOutCurrentUser } from "@/lib/auth-actions";
import { SITE_LINKS } from "@/lib/site-links";

export type AuthUserSummary = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type AuthControlsProps = {
  user: AuthUserSummary | null;
  signedOutLabel?: string;
  compact?: boolean;
};

export function AuthControls({
  user,
  signedOutLabel = "Sign in",
  compact = false,
}: AuthControlsProps) {
  if (!user) {
    return (
      <Button asChild className={compact ? "auth-cta auth-cta-compact" : "auth-cta"}>
        <Link href={SITE_LINKS.signIn}>{signedOutLabel}</Link>
      </Button>
    );
  }

  return (
    <div className="auth-controls">
      <div className="auth-user" title={user.email ?? undefined}>
        <Avatar className="auth-avatar">
          {user.image ? <AvatarImage src={user.image} alt="" /> : null}
          <AvatarFallback className="auth-avatar-fallback" aria-hidden="true">
            {(user.name ?? user.email ?? "U").charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="auth-user-name">{user.name ?? user.email ?? "Account"}</span>
      </div>
      <form action={signOutCurrentUser}>
        <Button className="auth-signout" variant="outline" size="sm" type="submit">
          <LogOut aria-hidden="true" />
          Sign out
        </Button>
      </form>
    </div>
  );
}
