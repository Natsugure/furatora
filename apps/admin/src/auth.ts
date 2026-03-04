import NextAuth, { type NextAuthResult } from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Credentials from 'next-auth/providers/credentials';

const allowedLogin = process.env.AUTH_ALLOWED_GITHUB_LOGIN;
const isPlaywrightTest = process.env.PLAYWRIGHT_TEST === 'true';

const nextAuth: NextAuthResult = NextAuth({
  providers: [
    GitHub,
    ...(isPlaywrightTest
      ? [
          Credentials({
            credentials: { username: { label: 'Username', type: 'text' } },
            authorize: (credentials) => {
              if (credentials.username === 'test-admin') {
                return { id: 'test-id', name: 'Test Admin', email: 'test@test.com' };
              }
              return null;
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    signIn({ profile, account }) {
      if (account?.provider === 'credentials') return true;
      return profile?.login === allowedLogin;
    },
  },
});

export const { handlers, auth, signIn, signOut } = nextAuth;
