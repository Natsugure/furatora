import { describe, it, expect, beforeAll } from 'vitest';

// @furatora/database/client はモジュール読み込み時に DATABASE_URL を要求する
// （neon-http クライアントの構築のみで、ネットワークへは繋がない）。ダミー値で十分である。
beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/db';
});

describe('facilitiesByRoute', () => {
  it('ルートごとに設備をまとめる', async () => {
    const { facilitiesByRoute } = await import('./transferPartnerRows');

    const result = facilitiesByRoute([
      { routeId: 'r1', typeCode: 'elevator' },
      { routeId: 'r1', typeCode: 'stairs' },
      { routeId: 'r2', typeCode: 'sameFloor' },
    ]);

    expect(result.get('r1')).toEqual(['elevator', 'stairs']);
    expect(result.get('r2')).toEqual(['sameFloor']);
  });

  it('稼働中のコードが知らない設備コードを含むルートは、既知の設備があっても設備を空（未入力）にする', async () => {
    const { facilitiesByRoute } = await import('./transferPartnerRows');

    // 未知のコードの前後どちらに既知の設備があっても空になる
    const result = facilitiesByRoute([
      { routeId: 'r1', typeCode: 'elevator' },
      { routeId: 'r1', typeCode: 'unknownStep' },
      { routeId: 'r2', typeCode: 'unknownStep' },
      { routeId: 'r2', typeCode: 'elevator' },
      { routeId: 'r3', typeCode: 'elevator' },
    ]);

    expect(result.get('r1')).toEqual([]);
    expect(result.get('r2')).toEqual([]);
    expect(result.get('r3')).toEqual(['elevator']);
  });

  it('知らない設備コードだけのルートも設備を空（未入力）にする', async () => {
    const { facilitiesByRoute } = await import('./transferPartnerRows');

    const result = facilitiesByRoute([{ routeId: 'r1', typeCode: 'unknownStep' }]);

    expect(result.get('r1')).toEqual([]);
  });
});
