import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DirectionType } from '@furatora/transfer-difficulty/domain';
import { TransferDifficultySection } from './TransferDifficultySection';
import type { TransferComboDTO, TransferPartnerDTO, TransferRouteDTO } from '@/features/station/domain/types';
import { renderWithMantine as render } from '@/test/renderWithMantine';

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
const personaRadio = (name: string) => within(screen.getByRole('radiogroup', { name: '移動手段' })).getByRole('radio', { name });
// MantineProvider が <style> を差し込むため、container が空かどうかでは確かめられない
function expectNothingRendered() {
  expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
}
const choosePersona = (name: string) => userEvent.click(personaRadio(name));

const ROUTED_PARTNERS = [
  partner({ combos: allCombos([route({ routeId: 'stairs', label: '階段経由', facilities: ['stairs'] })]) }),
  partner({
    connectedStationId: 't2',
    connectedStationName: '新御茶ノ水',
    lineName: '東京メトロ千代田線',
    combos: allCombos([route({ routeId: 'ev', label: 'エレベーター経由' })]),
  }),
];

describe('TransferDifficultySection', () => {
  it('評価済みの相手駅が1つも無ければ何も表示しない', () => {
    render(<TransferDifficultySection stationName="淡路町" partners={[partner()]} />);
    expectNothingRendered();
  });

  it('バリアフリールートが1本なら、そのルートを示す', () => {
    render(
      <TransferDifficultySection
        stationName="淡路町"
        partners={[partner({ combos: allCombos([route({ routeId: 'ev', label: 'エレベーター経由', minutes: 4 })], '共通の備考') })]}
      />,
    );
    const stroller = card('ベビーカー');
    expect(within(stroller).getByText('バリアフリールートあり')).toBeInTheDocument();
    expect(within(stroller).getByText('エレベーター経由')).toBeInTheDocument();
    // 所要時間は数字と「分」を別の大きさで描くので、欄の文字の全体で確かめる
    expect(within(stroller).getByText('所要時間').parentElement).toHaveTextContent('所要時間4分');
    expect(screen.getByText('共通の備考')).toBeInTheDocument();
    // 全組み合わせが同じなら方面の見出しを出さない
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
  });

  it('設備0件のルートを通れると表示せず、確認できていないと示す（ADR-0012）', () => {
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
    expect(within(card('ベビーカー')).getByText('確認できているルートでは、最も負担の少ない方法: 持ち上げて運ぶ'))
      .toBeInTheDocument();
  });

  it('霞ケ関型: 階段しかないベビーカーは「なし」＋持ち上げて運ぶ、車いすは「なし」＋係員複数名が車いすを担ぐ', async () => {
    render(
      <TransferDifficultySection
        stationName="淡路町"
        partners={[partner({ combos: allCombos([route({ routeId: 'stairs', facilities: ['stairs'] })]) })]}
      />,
    );
    expect(within(card('ベビーカー')).getByText('バリアフリールートなし')).toBeInTheDocument();
    expect(within(card('ベビーカー')).getByText('最も負担の少ない方法: 持ち上げて運ぶ')).toBeInTheDocument();
    await choosePersona('車いす');
    expect(within(card('車いす')).getByText('バリアフリールートなし')).toBeInTheDocument();
    expect(within(card('車いす')).getByText('最も負担の少ない方法: 係員複数名が車いすを担ぐ')).toBeInTheDocument();
  });

  it('そのまま通れるルートは必要な行為をタグにせず、フラグも無ければタグの段を出さない', () => {
    render(
      <TransferDifficultySection
        stationName="淡路町"
        partners={[partner({ combos: allCombos([route({ routeId: 'ev', label: 'エレベーター経由', minutes: 4 })]) })]}
      />,
    );
    const stroller = card('ベビーカー');
    expect(within(stroller).queryByText('そのまま通れる')).not.toBeInTheDocument();
    expect(within(stroller).queryByRole('group', { name: '通行条件' })).not.toBeInTheDocument();
  });

  it('そのまま通れるルートでも、フラグはタグにする', () => {
    render(
      <TransferDifficultySection
        stationName="淡路町"
        partners={[partner({ combos: allCombos([route({ routeId: 'ev', isOutdoor: true })]) })]}
      />,
    );
    const chips = within(card('ベビーカー')).getByRole('group', { name: '通行条件' });
    expect(chips).toHaveTextContent('屋外を通る');
    expect(chips).not.toHaveTextContent('そのまま通れる');
  });

  it('ペルソナごとにバリアフリールートの判定が分かれる（階段昇降機）', async () => {
    render(
      <TransferDifficultySection
        stationName="淡路町"
        partners={[partner({ combos: allCombos([route({ routeId: 'lift', facilities: ['stairLift'] })]) })]}
      />,
    );
    expect(within(card('ベビーカー')).getByText('通行可能なルートがありません')).toBeInTheDocument();
    await choosePersona('車いす');
    expect(within(card('車いす')).getByText('バリアフリールートあり')).toBeInTheDocument();
    expect(within(card('車いす')).getByText('係員が設備を操作')).toBeInTheDocument();
  });

  it('複数のバリアフリールートは最短を大きく出し、ほかは「ほかのルート」に所要時分の昇順で並べ、本数を示す', () => {
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
    // 最短は大きく出し、「ほかのルート」の一覧には入れない
    expect(within(stroller).getByText('近道')).toBeInTheDocument();
    const others = within(stroller).getByRole('list', { name: 'ほかのルート' });
    const items = within(others).getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatch(/^遠回り/);
    expect(items[1]).toMatch(/^時間不明/);
  });

  it('最短が同着なら1本を大きくせず、全部を1つの一覧に同じ大きさで並べる', () => {
    render(
      <TransferDifficultySection
        stationName="淡路町"
        partners={[
          partner({
            combos: allCombos([
              route({ routeId: 'a', label: '北口経由', minutes: 5 }),
              route({ routeId: 'b', label: '南口経由', minutes: 5 }),
            ]),
          }),
        ]}
      />,
    );
    const stroller = card('ベビーカー');
    expect(within(stroller).queryByRole('heading', { name: 'ほかのルート' })).not.toBeInTheDocument();
    const items = within(stroller).getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatch(/^北口経由/);
    expect(items[1]).toMatch(/^南口経由/);
  });

  it('バリアフリールートが1本なら「ほかのルート」を出さない', () => {
    render(
      <TransferDifficultySection
        stationName="淡路町"
        partners={[partner({ combos: allCombos([route({ routeId: 'ev', label: 'エレベーター経由', minutes: 4 })]) })]}
      />,
    );
    const stroller = card('ベビーカー');
    expect(within(stroller).getByText('エレベーター経由')).toBeInTheDocument();
    expect(within(stroller).queryByRole('heading', { name: 'ほかのルート' })).not.toBeInTheDocument();
    expect(within(stroller).queryByRole('list')).not.toBeInTheDocument();
  });

  it('バリアフリールートが1本で所要時分が不明なら、大きく出すが「所要時間」の欄を出さない', () => {
    render(
      <TransferDifficultySection
        stationName="淡路町"
        partners={[partner({ combos: allCombos([route({ routeId: 'ev', label: 'エレベーター経由' })]) })]}
      />,
    );
    const stroller = card('ベビーカー');
    expect(within(stroller).getByText('エレベーター経由')).toBeInTheDocument();
    expect(within(stroller).queryByText('所要時間')).not.toBeInTheDocument();
  });

  it('迂回度は基準ルートと BF ルートの所要時分が揃うときだけ出す', () => {
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
    expect(within(card('ベビーカー')).getByText('最短のバリアフリールート: 通常のルートより 2分長い'))
      .toBeInTheDocument();
  });

  it('最短が同着でも、迂回度の文は時間の差だけを出す（行為はタグで分かる）', async () => {
    render(
      <TransferDifficultySection
        stationName="淡路町"
        partners={[
          partner({
            combos: allCombos([
              route({ routeId: 'general', facilities: ['stairs'], minutes: 3, isBaseline: true }),
              route({ routeId: 'ev', facilities: ['elevator'], minutes: 5 }),
              route({ routeId: 'lift', facilities: ['stairLift'], minutes: 5 }),
            ]),
          }),
        ]}
      />,
    );
    await choosePersona('車いす');
    expect(
      within(card('車いす')).getByText('最短のバリアフリールート: 通常のルートより 2分長い'),
    ).toBeInTheDocument();
  });

  it('公式案内に無いルートと、その他のフラグを示す', () => {
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
    expect(within(stroller).getByText('公式案内に無いルート')).toBeInTheDocument();
    expect(within(stroller).getByText('屋外を通る')).toBeInTheDocument();
    expect(within(stroller).getByText('改札外を通る')).toBeInTheDocument();
    expect(within(stroller).getByText('係員への申し出が必要')).toBeInTheDocument();
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

  // 未評価は「ルートが0本」（docs/domain/station-master-model.md）。接続行があってもルートが無ければ未評価に数える
  it('接続行はあるがルートが0本の相手駅は、評価済みの相手駅より後に並べる', () => {
    render(
      <TransferDifficultySection
        stationName="小川町"
        partners={[
          partner({ connectedStationId: 't2', connectedStationName: '新御茶ノ水', lineName: '東京メトロ千代田線', combos: allCombos([]) }),
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

  it('接続行はあるがルートが0本の相手駅しか無ければ何も表示しない', () => {
    render(<TransferDifficultySection stationName="淡路町" partners={[partner({ combos: allCombos([]) })]} />);
    expectNothingRendered();
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
    await choosePersona('車いす');
    expect(within(card('車いす')).getByText('情報なし')).toBeInTheDocument();
  });

  describe('移動手段の切り替え', () => {
    it('移動手段を「移動手段」という名前の、1つを選ぶグループで出す', () => {
      render(<TransferDifficultySection stationName="淡路町" partners={ROUTED_PARTNERS} />);
      expect(screen.getByRole('radiogroup', { name: '移動手段' })).toBeInTheDocument();
    });

    it('最初はベビーカーを選んだ状態で、ベビーカーの評価だけを出す（REQ-7）', () => {
      render(<TransferDifficultySection stationName="淡路町" partners={ROUTED_PARTNERS} />);
      expect(personaRadio('ベビーカー')).toBeChecked();
      expect(personaRadio('車いす')).not.toBeChecked();
      expect(card('ベビーカー')).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: '車いす' })).not.toBeInTheDocument();
    });

    it('「車いす」を選ぶと、車いすの評価だけを出す（REQ-6）', async () => {
      render(<TransferDifficultySection stationName="淡路町" partners={ROUTED_PARTNERS} />);
      await choosePersona('車いす');
      expect(personaRadio('車いす')).toBeChecked();
      expect(card('車いす')).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'ベビーカー' })).not.toBeInTheDocument();
    });

    it('矢印キーで選び直せる', async () => {
      render(<TransferDifficultySection stationName="淡路町" partners={ROUTED_PARTNERS} />);
      await userEvent.click(personaRadio('ベビーカー'));
      await userEvent.keyboard('{ArrowRight}');
      expect(personaRadio('車いす')).toBeChecked();
    });

    it('移動手段を切り替えても、選んでいる乗換先は変わらない', async () => {
      render(<TransferDifficultySection stationName="淡路町" partners={ROUTED_PARTNERS} />);
      await userEvent.selectOptions(screen.getByLabelText('乗換先路線'), '東京メトロ千代田線（新御茶ノ水）');
      await choosePersona('車いす');
      expect(screen.getByLabelText('乗換先路線')).toHaveDisplayValue('東京メトロ千代田線（新御茶ノ水）');
      expect(within(card('車いす')).getByText('エレベーター経由')).toBeInTheDocument();
    });

    it('乗換先を選び直しても、選んでいる移動手段は変わらない', async () => {
      render(<TransferDifficultySection stationName="淡路町" partners={ROUTED_PARTNERS} />);
      await choosePersona('車いす');
      await userEvent.selectOptions(screen.getByLabelText('乗換先路線'), '東京メトロ千代田線（新御茶ノ水）');
      expect(personaRadio('車いす')).toBeChecked();
      expect(within(card('車いす')).getByText('エレベーター経由')).toBeInTheDocument();
    });
  });
});
