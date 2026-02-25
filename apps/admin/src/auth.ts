import NextAuth, { type NextAuthResult } from 'next-auth';
import GitHub from 'next-auth/providers/github';

const allowedLogin = process.env.AUTH_ALLOWED_GITHUB_LOGIN;

const nextAuth: NextAuthResult = NextAuth({
  providers: [GitHub],
  callbacks: {
    signIn({ profile }) {
      return profile?.login === allowedLogin;
    },
  },
});

export const { handlers, auth, signIn, signOut } = nextAuth;
