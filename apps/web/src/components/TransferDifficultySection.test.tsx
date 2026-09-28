import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DirectionType } from '@furatora/transfer-difficulty/domain';
import { TransferDifficultySection } from './TransferDifficultySection';
import type { TransferComboDTO, TransferPartnerDTO, TransferRouteDTO } from '@/features/station/domain/types';

function route(overrides: Partial<TransferRouteDTO> & { routeId: string }): TransferRouteDTO {
  return {
    label: overrides.routeId,
    isBaseline: false,
    minutes: null,
    isOutdoor: false,
    requiresExitGate: false,
    requiresStaff: false,
    isOfficiallyGuided: true,
    notes: null,
    facilities: ['elevator'],
    ...overrides,
  };
}

const DIRECTIONS: DirectionType[] = ['inbound', 'outbound'];
const allCombos = (routes: TransferRouteDTO[], notes: string | null = null): TransferComboDTO[] =>
  DIRECTIONS.flatMap((s) => DIRECTIONS.map((t) => ({ stationDirection: s, connectedDirection: t, notes, routes })));

function partner(overrides: Partial<TransferPartnerDTO> = {}): TransferPartnerDTO {
  return {
    connectedStationId: 't1',
    connectedStationName: '小川町',
    lineName: '都営新宿線',
    lineColor: '#6CBB5A',
    stationLineName: '東京メトロ丸ノ内線',
    directionLabels: {
      station: { inbound: '荻窪方面', outbound: '池袋方面' },
      connected: { inbound: '新宿方面', outbound: '本八幡方面' },
    },
    combos: [],
    ...overrides,
  };
}

const card = (name: string) => screen.getByRole('region', { name });

describe('TransferDifficultySection', () => {
  it('評価済みの相手駅が1つも無ければ何も表示しない', () => {
    const { container } = render(<TransferDifficultySection stationName="淡路町" partners={[partner()]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('バリアフリールートが1本なら、そのルートと必要な行為を示す', () => {
    render(
      <TransferDifficultySection
        stationName="淡路町"
        partners={[partner({ combos: allCombos([route({ routeId: 'ev', label: 'エレベーター経由', minutes: 4 })], '共通の備考') })]}
      />,
    );
    const stroller = card('ベビーカー');
    expect(within(stroller).getByText('バリアフリールートあり')).toBeInTheDocument();
    expect(within(stroller).getByText('エレベーター経由')).toBeInTheDocument();
    expect(within(stroller).getByText('4分')).toBeInTheDocument();
    expect(within(stroller).getByText('そのまま通れる')).toBeInTheDocument();
    expect(screen.getByText('共通の備考')).toBeInTheDocument();
    // 全組み合わせが同じなら方面の見出しを出さない
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
  });

  it('設備0件のルートを「そのまま通れる」と表示せず、確認できていないと示す（ADR-0012）', () => {
    render(
      <TransferDifficultySection
        stationName="淡路町"
        partners={[partner({ combos: allCombos([route({ routeId: 'general', label: '一般経路', facilities: [], isBaseline: true })]) })]}
      />,
    );
    const stroller = card('ベビーカー');
    expect(within(stroller).getByText('バリアフリールートを確認できていません')).toBeInTheDocument();
    // 未入力のルートの存在・名前は利用者に出さない（#135）
    expect(screen.queryByText(/一般経路/)).not.toBeInTheDocument();
    expect(screen.queryByText(/未入力/)).not.toBeInTheDocument();
    expect(screen.queryByText('そのまま通れる')).not.toBeInTheDocument();
    expect(screen.queryByText('バリアフリールートなし')).not.toBeInTheDocument();
  });

  it('確認できていない状態の最も軽い行為は「確認できているルートでは」と限定する', () => {
    render(
      <TransferDifficultySection
        stationName="淡路町"
        partners={[
          partner({
            combos: allCombos([
              route({ routeId: 'general', facilities: [], isBaseline: true }),
              route({ routeId: 'stairs', facilities: ['stairs'] }),
            ]),
          }),
        ]}
      />,
    );
    expect(within(card('ベビーカー')).getByText('確認できているルートでは、最も軽い方法: 持ち上げる'))
      .toBeInTheDocument();
  });

  it('霞ケ関型: 階段しかないベビーカーは「なし」＋持ち上げる、車いすは「なし」＋駅員複数名の介助', () => {
    render(
      <TransferDifficultySection
        stationName="淡路町"
        partners={[partner({ combos: allCombos([route({ routeId: 'stairs', facilities: ['stairs'] })]) })]}
      />,
    );
    expect(within(card('ベビーカー')).getByText('バリアフリールートなし')).toBeInTheDocument();
    expect(within(card('ベビーカー')).getByText('最も軽い方法: 持ち上げる')).toBeInTheDocument();
    expect(within(card('車いす')).getByText('最も軽い方法: 駅員複数名の介助')).toBeInTheDocument();
  });

  it('ペルソナごとにバリアフリールートの判定が分かれる（階段昇降機）', () => {
    render(
      <TransferDifficultySection
        stationName="淡路町"
        partners={[partner({ combos: allCombos([route({ routeId: 'lift', facilities: ['stairLift'] })]) })]}
      />,
    );
    expect(within(card('ベビーカー')).getByText('通行可能なルートがありません')).toBeInTheDocument();
    expect(within(card('車いす')).getByText('バリアフリールートあり')).toBeInTheDocument();
    expect(within(card('車いす')).getByText('係員を呼ぶ')).toBeInTheDocument();
  });

  it('複数のバリアフリールートは所要時分の昇順で並べ、本数を示す', () => {
    render(
      <TransferDifficultySection
        stationName="淡路町"
        partners={[
          partner({
            combos: allCombos([
              route({ routeId: 'slow', label: '遠回り', minutes: 8 }),
              route({ routeId: 'unknown', label: '時間不明' }),
              route({ routeId: 'fast', label: '近道', minutes: 3 }),
            ]),
          }),
        ]}
      />,
    );
    const stroller = card('ベビーカー');
    expect(within(stroller).getByText('バリアフリールートあり（3本）')).toBeInTheDocument();
    const items = within(stroller).getAllByRole('listitem').map((li) => li.textContent);
    expect(items[0]).toMatch(/^近道/);
    expect(items[1]).toMatch(/^遠回り/);
    expect(items[2]).toMatch(/^時間不明/);
  });

  it('迂回度は基準ルートと BF ルートの所要時分が揃うときだけ、必要な行為と並べて出す', () => {
    render(
      <TransferDifficultySection
        stationName="淡路町"
        partners={[
          partner({
            combos: allCombos([
              route({ routeId: 'general', facilities: ['stairs'], minutes: 3, isBaseline: true }),
              route({ routeId: 'ev', facilities: ['elevator'], minutes: 5 }),
            ]),
          }),
        ]}
      />,
    );
    expect(within(card('ベビーカー')).getByText('最短のバリアフリールート: 一般的なルートより 2分長い（そのまま通れる）'))
      .toBeInTheDocument();
  });

  it('公式案内に載っていないルートと、その他のフラグを示す', () => {
    render(
      <TransferDifficultySection
        stationName="淡路町"
        partners={[
          partner({
            combos: allCombos([
              route({ routeId: 'ev', isOfficiallyGuided: false, isOutdoor: true, requiresExitGate: true, requiresStaff: true }),
            ]),
          }),
        ]}
      />,
    );
    const stroller = card('ベビーカー');
    expect(within(stroller).getByText('駅の構内図・公式案内に載っていないルート')).toBeInTheDocument();
    expect(within(stroller).getByText('屋外を通る')).toBeInTheDocument();
    expect(within(stroller).getByText('改札外を通る')).toBeInTheDocument();
    expect(within(stroller).getByText('係員の対応が必要')).toBeInTheDocument();
  });

  it('方面でルートが分かれる接続は、方面の見出しごとに表示する', () => {
    const ev = route({ routeId: 'ev', label: 'エレベーターのみ' });
    const esc = route({ routeId: 'esc', label: '車いす対応エスカレーター経由', facilities: ['elevator', 'wheelchairEscalator'] });
    render(
      <TransferDifficultySection
        stationName="淡路町"
        partners={[
          partner({
            combos: [
              { stationDirection: 'inbound', connectedDirection: 'inbound', notes: null, routes: [ev] },
              { stationDirection: 'inbound', connectedDirection: 'outbound', notes: null, routes: [ev] },
              { stationDirection: 'outbound', connectedDirection: 'inbound', notes: null, routes: [esc] },
              { stationDirection: 'outbound', connectedDirection: 'outbound', notes: null, routes: [esc] },
            ],
          }),
        ]}
      />,
    );
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      '東京メトロ丸ノ内線 荻窪方面',
      '東京メトロ丸ノ内線 池袋方面',
    ]);
  });

  it('評価済みの相手駅を先に並べ、最初はそれを表示する', () => {
    render(
      <TransferDifficultySection
        stationName="小川町"
        partners={[
          partner({ connectedStationId: 't2', connectedStationName: '新御茶ノ水', lineName: '東京メトロ千代田線' }),
          partner({ connectedStationName: '淡路町', lineName: '東京メトロ丸ノ内線', combos: allCombos([route({ routeId: 'ev' })]) }),
        ]}
      />,
    );
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      '東京メトロ丸ノ内線（淡路町）',
      '東京メトロ千代田線（新御茶ノ水）',
    ]);
    expect(within(card('ベビーカー')).getByText('バリアフリールートあり')).toBeInTheDocument();
  });

  it('未評価の相手駅を選ぶと「情報なし」を示す', async () => {
    render(
      <TransferDifficultySection
        stationName="淡路町"
        partners={[
          partner({ combos: allCombos([route({ routeId: 'ev' })]) }),
          partner({ connectedStationId: 't2', connectedStationName: '御茶ノ水', lineName: 'JR中央線(快速)' }),
        ]}
      />,
    );
    // 相手駅の駅名が自駅と違うときは、路線名に駅名を添える
    await userEvent.selectOptions(screen.getByLabelText('乗換先路線'), 'JR中央線(快速)（御茶ノ水）');
    expect(within(card('ベビーカー')).getByText('情報なし')).toBeInTheDocument();
    expect(within(card('車いす')).getByText('情報なし')).toBeInTheDocument();
  });
});
