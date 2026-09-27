import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { FACILITY_TYPE_CODES } from '@furatora/transfer-difficulty/domain';
import { COMBO_KEYS, type RouteDraft } from '../domain/types';
import { RouteCard } from './RouteCard';

const facilityTypes = FACILITY_TYPE_CODES.map((code) => ({
  code,
  name: { sameFloor: '同一階層', elevator: 'エレベーター', ramp: 'スロープ', wheelchairEscalator: '車いす対応エスカレーター', escalator: 'エスカレーター', stairLift: '階段昇降機', stairs: '階段' }[code],
}));

function draft(over: Partial<RouteDraft> = {}): RouteDraft {
  return {
    key: 'k',
    routeId: null,
    label: '地上経由',
    isBaseline: true,
    minutes: null,
    isOutdoor: false,
    requiresExitGate: false,
    requiresStaff: false,
    isOfficiallyGuided: false,
    notes: '',
    facilities: [],
    combos: [...COMBO_KEYS],
    ...over,
  };
}

function setup(route: RouteDraft, extra: Partial<Parameters<typeof RouteCard>[0]> = {}) {
  const handlers = {
    onChange: vi.fn(),
    onToggleCombo: vi.fn(),
    onToggleFacility: vi.fn(),
    onDuplicate: vi.fn(),
    onDetach: vi.fn(),
    onRemove: vi.fn(),
  };
  render(
    <MantineProvider>
      <RouteCard
        route={route}
        index={0}
        facilityTypes={facilityTypes}
        stationAxis={{ stationName: '淡路町（丸ノ内線）', hints: { inbound: [], outbound: [] } }}
        connectedAxis={{ stationName: '小川町（新宿線）', hints: { inbound: [], outbound: [] } }}
        sharedWith={[]}
        divergentLinks={false}
        errors={[]}
        warnings={[]}
        {...handlers}
        {...extra}
      />
    </MantineProvider>,
  );
  return handlers;
}

describe('RouteCard', () => {
  it('設備の種類は7種のチェックボックスで、押すとその種類の切替が呼ばれる', async () => {
    const handlers = setup(draft());
    for (const type of facilityTypes) {
      expect(screen.getByRole('checkbox', { name: type.name })).toBeInTheDocument();
    }
    await userEvent.click(screen.getByRole('checkbox', { name: '階段' }));
    expect(handlers.onToggleFacility).toHaveBeenCalledWith('stairs');
  });

  it('選択中の設備がチェックされる', () => {
    setup(draft({ facilities: ['elevator', 'ramp'] }));
    expect(screen.getByRole('checkbox', { name: 'エレベーター' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'スロープ' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '階段' })).not.toBeChecked();
  });

  it('設備を選ぶとプレビューに導出結果が出る', () => {
    setup(draft({ facilities: ['stairLift'] }));
    expect(screen.getByText('ベビーカー: 通れない')).toBeInTheDocument();
    expect(screen.getByText('車いす: 係員を呼ぶ')).toBeInTheDocument();
  });

  it('設備0件では「設備が未入力」と出て、必要な行為は出ない', () => {
    setup(draft({ facilities: [] }));
    expect(screen.getByText(/設備が未入力です/)).toBeInTheDocument();
    expect(screen.queryByText(/そのまま通れる/)).not.toBeInTheDocument();
  });

  it('入力ガイドとして、代替手段は別ルートにすることと sameFloor の選び方を示す', () => {
    setup(draft());
    expect(screen.getByText(/代替手段（階段と階段昇降機）は同じルートに入れず、別のルートにします/)).toBeInTheDocument();
    expect(screen.getByText(/「同一フロア」を選びます/)).toBeInTheDocument();
  });

  it('適用先の 2×2 は、押すとその組み合わせの切替が呼ばれる', async () => {
    const handlers = setup(draft({ combos: [] }));
    await userEvent.click(
      screen.getByRole('checkbox', { name: '淡路町（丸ノ内線） outbound × 小川町（新宿線） inbound' }),
    );
    expect(handlers.onToggleCombo).toHaveBeenCalledWith('outbound:inbound');
  });

  it('共有中のルートには共有先と切り離しボタンが出て、押すと onDetach が呼ばれる', async () => {
    const handlers = setup(draft({ routeId: 'r1' }), { sharedWith: ['御茶ノ水（丸ノ内線） ↔ 御茶ノ水（中央・総武線）'] });
    expect(screen.getByText(/共有中: 御茶ノ水（丸ノ内線）/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'この駅対だけ切り離す' }));
    expect(handlers.onDetach).toHaveBeenCalled();
  });

  it('共有していないルートには切り離しボタンが出ない', () => {
    setup(draft({ routeId: 'r1' }));
    expect(screen.queryByRole('button', { name: 'この駅対だけ切り離す' })).not.toBeInTheDocument();
  });

  it('警告と検証エラーをカード内に表示する', () => {
    setup(draft(), {
      errors: [{ code: 'label_required', message: 'ルートの名前（label）を入力してください' }],
      warnings: [{ code: 'alternative_facilities', message: '階段と階段昇降機は代替手段です' }],
    });
    expect(screen.getByText('ルートの名前（label）を入力してください')).toBeInTheDocument();
    expect(screen.getByText('階段と階段昇降機は代替手段です')).toBeInTheDocument();
  });
});
