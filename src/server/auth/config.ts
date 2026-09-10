import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { prisma } from "@/server/db";

import { verifyPassword } from "./password";
import type { Permission } from "./permissions";

export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        });

        // A missing user, an inactive account and a wrong password all fail
        // the same way here so the caller can never distinguish them.
        if (!user || user.status !== "ACTIVE") {
          return null;
        }

        const passwordMatches = await verifyPassword(password, user.passwordHash);
        if (!passwordMatches) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roleId: user.roleId,
          roleName: user.role.name,
          permissions: user.role.permissions.map((rp) => rp.permission.key as Permission),
        };
      },
    }),
  ],
  callbacks: {
    // `user` is only present on the sign-in request, so permissions are
    // captured once here and carried in the JWT from then on. A permission
    // or role change on an existing user only takes effect on their next
    // sign-in, not immediately — a JWT session trade-off, not an oversight.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.roleId = user.roleId;
        token.roleName = user.roleName;
        token.permissions = user.permissions;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.roleId = token.roleId;
      session.user.roleName = token.roleName;
      session.user.permissions = token.permissions;
      return session;
    },
  },
} satisfies NextAuthConfig;
