import type { ReactNode } from "react";
import { AppShell } from "@/components/app/app-shell";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function ApplicationLayout({ children }: { children: ReactNode }) {
  if (!(await auth())?.user) redirect("/signin");
  return <AppShell>{children}</AppShell>;
}
