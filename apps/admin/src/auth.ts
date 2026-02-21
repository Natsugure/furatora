import NextAuth, { type NextAuthResult } from 'next-auth';
import GitHub from 'next-auth/providers/github';

const nextAuth: NextAuthResult = NextAuth({
  providers: [GitHub],
});

export const { handlers, auth, signIn, signOut } = nextAuth;
