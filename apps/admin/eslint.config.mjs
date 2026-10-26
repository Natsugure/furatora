import nextApp from '@furatora/eslint-config/next-app';

/**
 * 移行中の除外。ADR-0001の依存ルール導入時点で features/ へ未移行の
 * 既存ファイルを列挙する（段階的に削っていく。ディレクトリ丸ごとの除外にしないのは、
 * src/app/** 配下に新規追加されるファイルには引き続きルールを効かせるため）。
 * `[stationId]` 等は minimatch の文字クラス構文と衝突するため `\\[`/`\\]` でエスケープする。
 */
const legacyExclusions = {
  files: [
    'src/app/operators/page.tsx',
    'src/app/operators/\\[operatorId\\]/edit/page.tsx',
    'src/app/lines/\\[lineId\\]/directions/page.tsx',
    'src/app/trains/page.tsx',
    'src/app/api/stations/\\[stationId\\]/route.ts',
    'src/app/api/lines/\\[lineId\\]/route.ts',
    'src/app/api/lines/\\[lineId\\]/directions/\\[directionId\\]/route.ts',
    'src/app/api/operators/route.ts',
    'src/app/api/operators/\\[operatorId\\]/route.ts',
  ],
  rules: {
    'no-restricted-imports': 'off',
  },
};

export default [...nextApp, legacyExclusions];
