// 駅一覧の状態（事業者・路線・検索語・ソート・ページ）を、一覧ページと詳細ページの
// 双方で扱うためのユーティリティ。
//
// ADR-0009: 一覧の絞り込み・並び替え・ページングは URL クエリを唯一の状態源とする。
// この方針を詳細ページ（edit / layout / publish）まで延長し、一覧の行リンクに現在の
// 状態を載せ、詳細ページから一覧へ戻るときに同じ状態を復元できるようにする。
//
// 新しいロジックは持たず、shared/list/params.ts・shared/list/href.ts の薄いラッパに
// 徹する（それぞれ検証済み・テスト済みのため）。

import { parseListParams, parseUuidParam } from '@/shared/list/params';
import { buildListHref, type ListHrefState } from '@/shared/list/href';
import { STATION_LIST_SORT_KEYS, type StationListSort } from '@/features/station/ports';

export const STATION_LIST_PER_PAGE = 50;
export const STATION_LIST_DEFAULTS: ListHrefState = { sort: 'line', order: 'asc', page: 1 };
export const STATION_LIST_BASE_PATH = '/stations';

/**
 * searchParams から駅一覧の状態を取り出す。一覧ページ自身と、一覧から遷移した
 * 詳細ページ（edit / layout / publish）の両方から呼ぶ。
 */
export function parseStationListState(
  raw: Record<string, string | string[] | undefined>,
): ListHrefState {
  const operatorId = parseUuidParam(raw.operatorId) ?? '';
  const lineId = parseUuidParam(raw.lineId) ?? '';
  const params = parseListParams<StationListSort>(raw, {
    sortKeys: STATION_LIST_SORT_KEYS,
    defaultSort: 'line',
    perPage: STATION_LIST_PER_PAGE,
  });

  return {
    operatorId, lineId, q: params.q, sort: params.sort, order: params.order, page: params.page,
  };
}

/** 一覧の行から詳細ページ（edit / layout / publish）へ飛ぶ href。一覧の状態を載せる */
export function stationDetailHref(base: string, state: ListHrefState): string {
  return buildListHref(base, state, {}, { defaults: STATION_LIST_DEFAULTS });
}

/** 詳細ページから駅一覧へ戻る href。state は parseStationListState() の戻り値を渡す */
export function stationListHref(state: ListHrefState): string {
  return stationDetailHref(STATION_LIST_BASE_PATH, state);
}

/**
 * edit / publish page の定型処理: searchParams から一覧状態を取り出し、
 * 「駅一覧に戻る」href を組み立てるところまでを1回で行う。
 */
export function resolveStationListBack(
  raw: Record<string, string | string[] | undefined>,
): { listState: ListHrefState; backHref: string } {
  const listState = parseStationListState(raw);
  return { listState, backHref: stationListHref(listState) };
}

/** 駅レイアウトページ（タブ切替・保存後リダイレクト等）へのhref。一覧の状態を載せる */
export function stationLayoutHref(
  stationId: string,
  state: ListHrefState,
  patch: ListHrefState = {},
): string {
  return buildListHref(`/stations/${stationId}/layout`, state, patch);
}
