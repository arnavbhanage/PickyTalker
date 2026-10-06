import { auth } from "@/auth";
import { NavbarClient } from "@/components/landing/navbar-client";

export async function Navbar() {
  const session = await auth();
  return <NavbarClient user={session?.user ?? null} />;
}
