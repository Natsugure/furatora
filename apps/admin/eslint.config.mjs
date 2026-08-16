import nextApp from '@furatora/eslint-config/next-app';

/**
 * 移行中の除外。ADR-0001の依存ルール導入時点で features/ へ未移行の
 * 既存ファイルを列挙する（段階的に削っていく。ディレクトリ丸ごとの除外にしないのは、
 * src/app/** 配下に新規追加されるファイルには引き続きルールを効かせるため）。
 * `[stationId]` 等は minimatch の文字クラス構文と衝突するため `\\[`/`\\]` でエスケープする。
 */
const legacyExclusions = {
  files: [
    'src/app/page.tsx',
    'src/app/stations/page.tsx',
    'src/app/stations/\\[stationId\\]/edit/page.tsx',
    'src/app/stations/\\[stationId\\]/platforms/new/page.tsx',
    'src/app/stations/\\[stationId\\]/platforms/\\[platformId\\]/edit/page.tsx',
    'src/app/stations/\\[stationId\\]/facilities/new/page.tsx',
    'src/app/stations/\\[stationId\\]/facilities/page.tsx',
    'src/app/stations/\\[stationId\\]/facilities/\\[locationId\\]/edit/page.tsx',
    'src/app/operators/page.tsx',
    'src/app/operators/\\[operatorId\\]/edit/page.tsx',
    'src/app/lines/page.tsx',
    'src/app/lines/\\[lineId\\]/edit/page.tsx',
    'src/app/lines/\\[lineId\\]/directions/page.tsx',
    'src/app/lines/\\[lineId\\]/directions/new/page.tsx',
    'src/app/lines/\\[lineId\\]/directions/\\[directionId\\]/edit/page.tsx',
    'src/app/trains/page.tsx',
    'src/app/trains/\\[trainId\\]/edit/page.tsx',
    'src/app/api/stations/route.ts',
    'src/app/api/stations/\\[stationId\\]/route.ts',
    'src/app/api/stations/\\[stationId\\]/directions/route.ts',
    'src/app/api/stations/\\[stationId\\]/platforms/route.ts',
    'src/app/api/stations/\\[stationId\\]/platforms/\\[platformId\\]/route.ts',
    'src/app/api/stations/\\[stationId\\]/platform-locations/route.ts',
    'src/app/api/stations/\\[stationId\\]/platform-locations/\\[locationId\\]/route.ts',
    'src/app/api/stations/\\[stationId\\]/platform-locations/\\[locationId\\]/duplicate/route.ts',
    'src/app/api/platforms/route.ts',
    'src/app/api/facility-types/route.ts',
    'src/app/api/lines/route.ts',
    'src/app/api/lines/\\[lineId\\]/route.ts',
    'src/app/api/lines/\\[lineId\\]/directions/route.ts',
    'src/app/api/lines/\\[lineId\\]/directions/\\[directionId\\]/route.ts',
    'src/app/api/operators/route.ts',
    'src/app/api/operators/route.test.ts',
    'src/app/api/operators/\\[operatorId\\]/route.ts',
    'src/app/api/operators/\\[operatorId\\]/route.test.ts',
    'src/app/api/trains/route.ts',
    'src/app/api/trains/\\[trainId\\]/route.ts',
    'src/app/api/station-connections/\\[connectionId\\]/route.ts',
    'src/app/api/unresolved-connections/route.ts',
    'src/app/api/unresolved-connections/railways/route.ts',
    'src/app/api/unresolved-connections/stations/route.ts',
    'src/components/ConnectionsEditSection.tsx',
    'src/components/PlatformForm.tsx',
    'src/components/StationEditForm.tsx',
    'src/components/TrainForm.tsx',
  ],
  rules: {
    'no-restricted-imports': 'off',
  },
};

export default [...nextApp, legacyExclusions];
