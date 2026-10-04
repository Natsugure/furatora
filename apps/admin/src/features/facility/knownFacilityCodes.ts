import { isFacilityTypeCode, type FacilityTypeCode } from '@furatora/database/enums';
import { UnknownFacilityCodeError } from './ports';

/**
 * 編集画面の読み取りで、DB の設備コードがすべて稼働中のコードの知るものであることを確かめる。
 * 知らないコードがあれば UnknownFacilityCodeError を投げる（理由は UnknownFacilityCodeError を参照）
 */
export function assertKnownFacilityCodes(codes: readonly string[]): asserts codes is readonly FacilityTypeCode[] {
  const unknown = [...new Set(codes.filter((code) => !isFacilityTypeCode(code)))];
  if (unknown.length > 0) throw new UnknownFacilityCodeError(unknown);
}

/**
 * 設備の種類の選択肢から、稼働中のコードが知らないものを除く。
 * 選んでも保存の入力検証で拒否されるだけで、DB の行は失われないので、止めずに除く
 */
export function knownFacilityTypeOptions<T extends { code: string }>(
  rows: readonly T[],
): (T & { code: FacilityTypeCode })[] {
  return rows.filter((row): row is T & { code: FacilityTypeCode } => isFacilityTypeCode(row.code));
}
