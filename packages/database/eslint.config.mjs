import { defineConfig } from 'eslint/config';
import nextTs from 'eslint-config-next/typescript';
import base from '@furatora/eslint-config/base';

// DB クライアントとスキーマのパッケージ。transfer-difficulty / platform-diagram と同じく、
// TypeScript の構文解析・型検査ルールだけを eslint-config-next/typescript から借りる。
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
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // src/enums/ はアプリとドメインの packages が共有する語彙の置き場で、ドメインの packages はここだけを import できる
    // （ADR-0015 決定3）。配下が Drizzle や DB クライアントに依存すると、その依存がドメインの packages に漏れる。
    // @furatora/database 自身も禁止する（自分自身の exports を経由して schema を読む抜け道になるため）
    files: ['src/enums/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(drizzle-orm(/.*)?|@furatora/database(/.*)?|\\.\\./(schema|client|tx)(/.*)?)$',
              message: 'src/enums/ は Drizzle と DB クライアントに依存させないでください（ADR-0015 決定3）',
            },
          ],
        },
      ],
    },
  },
]);
