import { describe, expect, it } from 'vitest';
import { pairSaveInputSchema } from './schema';

const UUID = '550e8400-e29b-41d4-a716-446655440000';

const route = (over: Record<string, unknown> = {}) => ({
  routeId: null,
  label: '地上経由',
  isBaseline: true,
  minutes: null,
  isOutdoor: false,
  requiresExitGate: false,
  requiresStaff: false,
  isOfficiallyGuided: false,
  notes: null,
  facilities: ['elevator'],
  combos: ['inbound:inbound', 'outbound:outbound'],
  ...over,
});

describe('pairSaveInputSchema', () => {
  it('正常な入力をパースできる', () => {
    const result = pairSaveInputSchema.safeParse({
      routes: [route(), route({ routeId: UUID, label: 'B', minutes: 3, notes: 'メモ' })],
      connectionNotes: { 'inbound:inbound': '備考', 'outbound:outbound': null },
    });
    expect(result.success).toBe(true);
  });

  it('ルート0本（未評価）もパースできる', () => {
    expect(pairSaveInputSchema.safeParse({ routes: [], connectionNotes: {} }).success).toBe(true);
  });

  it('設備0件（設備未入力）もパースできる', () => {
    expect(pairSaveInputSchema.safeParse({ routes: [route({ facilities: [] })], connectionNotes: {} }).success).toBe(true);
  });

  it('routeId が UUID でないと失敗する', () => {
    expect(pairSaveInputSchema.safeParse({ routes: [route({ routeId: 'x' })], connectionNotes: {} }).success).toBe(false);
  });

  it('未知の設備コードは失敗する（旧スネークケースも不可）', () => {
    expect(pairSaveInputSchema.safeParse({ routes: [route({ facilities: ['stair_lift'] })], connectionNotes: {} }).success).toBe(false);
  });

  it('未知の方面の組み合わせは失敗する', () => {
    expect(pairSaveInputSchema.safeParse({ routes: [route({ combos: ['up:down'] })], connectionNotes: {} }).success).toBe(false);
    expect(pairSaveInputSchema.safeParse({ routes: [route()], connectionNotes: { 'up:down': 'x' } }).success).toBe(false);
  });

  it('必須項目が欠けていると失敗する', () => {
    const withoutLabel: Record<string, unknown> = route();
    delete withoutLabel.label;
    expect(pairSaveInputSchema.safeParse({ routes: [withoutLabel], connectionNotes: {} }).success).toBe(false);
  });

  it('routes が無いと失敗する', () => {
    expect(pairSaveInputSchema.safeParse({ connectionNotes: {} }).success).toBe(false);
  });
});
