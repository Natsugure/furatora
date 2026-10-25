import type { PlatformDTO } from '@furatora/platform-diagram/domain';

/**
 * ホームをホーム番号の数値順（'2' → '10'）に並べる（非破壊）。
 * 駅ページのホームの表示順はここだけで決める。方面タブはこの順を保って組み立てる。
 */
export function sortPlatformsByNumber(platforms: PlatformDTO[]): PlatformDTO[] {
  return [...platforms].sort((a, b) =>
    a.platformNumber.localeCompare(b.platformNumber, 'ja', { numeric: true }),
  );
}
