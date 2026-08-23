import nextApp from '@furatora/eslint-config/next-app';

/**
 * 移行中の除外。ADR-0001の依存ルール導入時点で features/ へ未移行の
 * 既存ファイルを列挙する（段階的に削っていく。ディレクトリ丸ごとの除外にしないのは、
 * src/app/** 配下に新規追加されるファイルには引き続きルールを効かせるため）。
 * `[slug]` 等は minimatch の文字クラス構文と衝突するため `\\[`/`\\]` でエスケープする。
 */
const legacyExclusions = {
  files: [
    'src/app/page.tsx',
    'src/app/lines/\\[slug\\]/stations/page.tsx',
    'src/app/api/v1/stations/route.ts',
    'src/app/api/v1/stations/\\[id\\]/route.ts',
    'src/app/api/v1/lines/\\[slug\\]/stations/route.ts',
    'src/app/api/v1/operators/route.ts',
  ],
  rules: {
    'no-restricted-imports': 'off',
  },
};

export default [...nextApp, legacyExclusions];
