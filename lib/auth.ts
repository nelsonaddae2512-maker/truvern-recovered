// lib/auth.ts
import type { NextAuthOptions } from "next-auth";

/**
 * Minimal authOptions stub. You can wire real providers later.
 */
export const authOptions: NextAuthOptions = {
  providers: [],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async session({ session }) {
      return session;
    },
  },
};

export default authOptions;



