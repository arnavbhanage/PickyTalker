import type { ReactNode } from "react";
import { AppShell } from "@/components/app/app-shell";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function ApplicationLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const { name, email, image } = session.user;
  // Keep authentication server-side; send only the display fields to the shell.
  return <AppShell user={{ name, email, image }}>{children}</AppShell>;
}
