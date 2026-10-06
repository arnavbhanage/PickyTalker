"use client";

import Link from "next/link";
import { useId } from "react";
import { useFormStatus } from "react-dom";
import { ChevronDown, LogOut, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AuthUserSummary } from "@/components/auth/auth-controls";
import { SITE_LINKS } from "@/lib/site-links";
import styles from "./account-control.module.css";

function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" className={styles.signout} disabled={pending}>
      <LogOut size={15} aria-hidden="true" />{pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}

export function AccountControl({ user, signOutAction }: {
  user: AuthUserSummary | null;
  signOutAction: () => Promise<void>;
}) {
  const id = useId();
  if (!user) return <Button asChild variant="outline"><Link href={SITE_LINKS.signIn}>Sign in</Link></Button>;
  const name = user.name?.trim() || user.email || "Account";
  const initial = Array.from(name)[0]?.toUpperCase() || "U";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" className={styles.trigger} aria-label="Open account menu">
          <Avatar className={styles.avatar}>
            {user.image ? <AvatarImage src={user.image} alt="" /> : null}
            <AvatarFallback aria-hidden="true">{initial}</AvatarFallback>
          </Avatar>
          <span className={styles.triggerName}>{name}</span>
          <ChevronDown className={styles.chevron} size={14} aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className={styles.panel} aria-labelledby={`${id}-title`} aria-describedby={`${id}-details`}>
        <div className={styles.heading}>
          <h2 id={`${id}-title`}>Your account</h2>
          <PopoverClose asChild><Button type="button" variant="ghost" size="icon" className={styles.close} aria-label="Close account menu"><X size={16} aria-hidden="true" /></Button></PopoverClose>
        </div>
        <div className={styles.identity}>
          <p className={styles.name}>{name}</p>
          {user.email ? <p className={styles.email}>{user.email}</p> : null}
        </div>
        <p className={styles.details} id={`${id}-details`}>You’re signed in. Conversation and ratings are only kept in this session.</p>
        <form action={signOutAction}><SignOutButton /></form>
      </PopoverContent>
    </Popover>
  );
}
