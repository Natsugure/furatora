import { describe, it, expect } from 'vitest';
import {
  comboKeyOf,
  comboOfConnection,
  endpointsOfCombo,
  normalizeTransferEndpoints,
  type TransferEndpoint,
} from './normalize';
import { COMBO_KEYS } from './types';

const LOW = '00000000-0000-0000-0000-000000000001';
const HIGH = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

const lowIn: TransferEndpoint = { stationId: LOW, directionType: 'inbound' };
const lowOut: TransferEndpoint = { stationId: LOW, directionType: 'outbound' };
const highIn: TransferEndpoint = { stationId: HIGH, directionType: 'inbound' };
const highOut: TransferEndpoint = { stationId: HIGH, directionType: 'outbound' };

describe('normalizeTransferEndpoints', () => {
  it('昇順で渡すとそのまま返る', () => {
    expect(normalizeTransferEndpoints(lowIn, highOut)).toEqual({ a: lowIn, b: highOut });
  });

  it('逆順で渡しても昇順に正規化される', () => {
    expect(normalizeTransferEndpoints(highOut, lowIn)).toEqual({ a: lowIn, b: highOut });
  });

  it('(x,y) と (y,x) は同じ結果になる', () => {
    expect(normalizeTransferEndpoints(lowOut, highIn)).toEqual(
      normalizeTransferEndpoints(highIn, lowOut),
    );
  });

  it('駅が違えば方面に関係なく駅で順序が決まる', () => {
    // 方面は inbound < outbound だが、駅の大小が優先される
    expect(normalizeTransferEndpoints(highIn, lowOut)).toEqual({ a: lowOut, b: highIn });
  });

  it('同一駅・方面違い（#82 以降に正当になる接続）は方面で順序が決まる', () => {
    expect(normalizeTransferEndpoints(lowOut, lowIn)).toEqual({ a: lowIn, b: lowOut });
    expect(normalizeTransferEndpoints(lowIn, lowOut)).toEqual({ a: lowIn, b: lowOut });
  });

  it('stationId の大文字小文字に依らず DB（小文字16進のバイト順）と同じ順序になる', () => {
    // 文字列のまま比較すると 'B' (0x42) < 'a' (0x61) で upperB が先になるが、
    // uuid としては 0xa < 0xb なので lowerA が先でなければ DB の check と食い違う
    const lowerA = { stationId: 'aaaaaaaa-0000-0000-0000-000000000000', directionType: 'inbound' } as const;
    const upperB = { stationId: 'BBBBBBBB-0000-0000-0000-000000000000', directionType: 'inbound' } as const;
    expect(normalizeTransferEndpoints(upperB, lowerA)).toEqual({ a: lowerA, b: upperB });
  });

  it('返す stationId は入力のまま（大文字小文字を変えない）', () => {
    const upper = { stationId: 'AAAAAAAA-0000-0000-0000-000000000000', directionType: 'inbound' } as const;
    expect(normalizeTransferEndpoints(upper, highIn).a.stationId).toBe(upper.stationId);
  });

  it('両端点が等しければそのまま返る（排除は DB の check の責務）', () => {
    expect(normalizeTransferEndpoints(lowIn, lowIn)).toEqual({ a: lowIn, b: lowIn });
  });
});

const S = '22222222-2222-4222-8222-222222222222';
const T = '11111111-1111-4111-8111-111111111111';

describe('comboKeyOf', () => {
  it('S の方面 : T の方面 の順でキーを作る', () => {
    expect(comboKeyOf('inbound', 'outbound')).toBe('inbound:outbound');
  });
});

describe('endpointsOfCombo / comboOfConnection（S/T と DB の A/B の変換）', () => {
  it('S が T より大きい uuid のとき、A = T・B = S になる', () => {
    const { a, b } = endpointsOfCombo(S, T, 'inbound:outbound');
    expect(a).toEqual({ stationId: T, directionType: 'outbound' });
    expect(b).toEqual({ stationId: S, directionType: 'inbound' });
  });

  it('S が T より小さい uuid のとき、A = S・B = T のまま', () => {
    const { a, b } = endpointsOfCombo(T, S, 'inbound:outbound');
    expect(a).toEqual({ stationId: T, directionType: 'inbound' });
    expect(b).toEqual({ stationId: S, directionType: 'outbound' });
  });

  it('DB の行から S 基準の組み合わせに戻せる（往復で一致）', () => {
    for (const combo of COMBO_KEYS) {
      const { a, b } = endpointsOfCombo(S, T, combo);
      const row = {
        stationAId: a.stationId,
        directionA: a.directionType,
        stationBId: b.stationId,
        directionB: b.directionType,
      };
      expect(comboOfConnection(row, S)).toBe(combo);
    }
  });

  it('大文字の uuid でも S を判定できる', () => {
    const { a, b } = endpointsOfCombo(S, T, 'outbound:inbound');
    const row = {
      stationAId: a.stationId.toUpperCase(),
      directionA: a.directionType,
      stationBId: b.stationId.toUpperCase(),
      directionB: b.directionType,
    };
    expect(comboOfConnection(row, S)).toBe('outbound:inbound');
  });
});
