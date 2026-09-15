import { describe, it, expect } from 'vitest';
import { parseStationListState, stationDetailHref, stationLayoutHref, stationListHref } from './listState';

describe('parseStationListState', () => {
  it('事業者・路線・検索語・ソート・ページを取り出す', () => {
    const state = parseStationListState({
      // params.test.ts と同じ、RFC4122準拠のUUID（バージョン4・バリアント'a'）を使う
      operatorId: '550e8400-e29b-41d4-a716-446655440000',
      lineId: '650e8400-e29b-41d4-a716-446655440001',
      q: '東京',
      sort: 'name',
      order: 'desc',
      page: '3',
    });
    expect(state).toEqual({
      operatorId: '550e8400-e29b-41d4-a716-446655440000',
      lineId: '650e8400-e29b-41d4-a716-446655440001',
      q: '東京',
      sort: 'name',
      order: 'desc',
      page: 3,
    });
  });

  it('未指定・不正値は空文字/既定値にフォールバックする', () => {
    const state = parseStationListState({ operatorId: 'not-a-uuid' });
    expect(state).toEqual({
      operatorId: '', lineId: '', q: null, sort: 'line', order: 'asc', page: 1,
    });
  });
});

describe('stationListHref', () => {
  it('絞り込み状態をクエリとして一覧へのhrefにする', () => {
    const href = stationListHref({ operatorId: 'X', lineId: 'Y', q: '東京', sort: 'name', order: 'desc', page: 3 });
    expect(href).toBe('/stations?operatorId=X&lineId=Y&q=%E6%9D%B1%E4%BA%AC&sort=name&order=desc&page=3');
  });

  it('既定値（sort=line, order=asc）はクエリに出さない', () => {
    const href = stationListHref({ sort: 'line', order: 'asc', page: 1 });
    expect(href).toBe('/stations');
  });
});

describe('stationDetailHref', () => {
  it('指定したbaseに一覧の状態を載せる', () => {
    const href = stationDetailHref('/stations/abc/edit', { operatorId: 'X', page: 2 });
    expect(href).toBe('/stations/abc/edit?operatorId=X&page=2');
  });

  it('状態が空ならbaseのみを返す', () => {
    const href = stationDetailHref('/stations/abc/edit', {});
    expect(href).toBe('/stations/abc/edit');
  });
});

describe('stationLayoutHref', () => {
  it('既定値（sort=line, order=asc, page=1）はクエリに出さない', () => {
    const href = stationLayoutHref('abc', { operatorId: 'X', sort: 'line', order: 'asc', page: 1 });
    expect(href).toBe('/stations/abc/layout?operatorId=X');
  });

  it('patchを一覧の状態に重ねてクエリにする', () => {
    const href = stationLayoutHref('abc', { operatorId: 'X', sort: 'name', order: 'desc', page: 2 }, { platformId: 'p1' });
    expect(href).toBe('/stations/abc/layout?operatorId=X&sort=name&order=desc&page=2&platformId=p1');
  });
});
