import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { verifyPassword } from "@/lib/auth/password";
import { isVerifiedGoogle } from "@/lib/auth/validation";
import { verification } from "@/lib/auth/verification";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  providers: [
    Google,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        challengeId: { type: "text" },
        verificationGrant: { type: "text" },
      },
      async authorize(credentials) {
        const email = typeof credentials.email === "string"
          ? credentials.email.trim().toLowerCase()
          : "";
        const password = typeof credentials.password === "string"
          ? credentials.password
          : "";

        if (email && typeof credentials.challengeId === "string" && typeof credentials.verificationGrant === "string") {
          const granted = await verification.consumeGrant(email, "verify", credentials.challengeId, credentials.verificationGrant);
          if (!granted) return null;
          const current = await prisma.user.findUnique({ where: { id: granted.id } });
          return current ? { id: current.id, name: current.name, email: current.email, image: current.image } : null;
        }
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash || !user.emailVerified) return null;

        const passwordMatches = await verifyPassword(password, user.passwordHash);
        if (!passwordMatches) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  pages: {
    signIn: "/signin",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "google") return isVerifiedGoogle(profile);
      return true;
    },
    async jwt({ token, user, account }) {
      if (user?.id) {
        const current = await prisma.user.findUnique({ where: { id: user.id } });
        if (!current) return null;
        // Default Auth.js account-linking protection is intentionally preserved.
        if (account?.provider === "google" && !current.emailVerified) {
          await prisma.user.update({ where: { id: current.id }, data: { emailVerified: new Date() } });
        }
        token.sessionVersion = current.sessionVersion;
      } else if (token.sub) {
        const current = await prisma.user.findUnique({ where: { id: token.sub } });
        if (!current || token.sessionVersion !== current.sessionVersion) return null;
      }
      return token;
    },
  },
});
