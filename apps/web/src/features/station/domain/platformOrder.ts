import type { PlatformDTO } from '@furatora/platform-diagram/domain';
import { comparePlatformNumber } from '@furatora/transfer-difficulty/domain';

/**
 * ホームをホーム番号の数値順（'2' → '10'）に並べる（非破壊）。
 * 駅ページのホームの表示順はここだけで決める。方面タブはこの順を保って組み立てる。
 */
export function sortPlatformsByNumber(platforms: PlatformDTO[]): PlatformDTO[] {
  return [...platforms].sort(
    (a, b) =>
      comparePlatformNumber(a.platformNumber, b.platformNumber) ||
      // 1駅に同じ番号のホームがありうる（(station_id, platform_number) に一意制約が無い）。
      // 元のクエリに orderBy が無く入力の順は DB 次第なので、id で順を固定する
      a.id.localeCompare(b.id),
  );
}
