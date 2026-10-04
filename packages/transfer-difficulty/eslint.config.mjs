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
              // 共有する語彙（型・定数のみ。Drizzle も実行時の依存も持たない）の enums だけは許可する（ADR-0015）。
              // group の '!' による除外は親（@furatora/database）を除外すると効かないため、正規表現で書く
              regex: '^(@furatora/database(?!/enums$)(/.*)?|drizzle-orm(/.*)?)$',
              message: 'このパッケージは DB 非依存を保ってください。使えるのは @furatora/database/enums だけです（ADR-0015）',
            },
          ],
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
]);
