import { defineConfig } from 'eslint/config';
import nextTs from 'eslint-config-next/typescript';
import base from '@furatora/eslint-config/base';

// このパッケージは apps/web / apps/admin の両方から使われる、乗換難易度の解釈規則
// （設備 → 必要な行為 → バリアフリールートか）の純粋関数パッケージ。
// platform-diagram（ADR-0010）と同じく、TypeScript の構文解析・型検査ルールだけを
// eslint-config-next/typescript から借りる。Next.js・React・DB への依存は禁止する。
export default defineConfig([
  ...base,
  ...nextTs,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['next', 'next/*', 'react', 'react-dom'],
              message: 'このパッケージは Next.js・React 非依存を保ってください',
            },
            {
              group: ['@furatora/database', '@furatora/database/*', 'drizzle-orm'],
              message: 'このパッケージは DB 非依存を保ってください',
            },
          ],
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
]);
