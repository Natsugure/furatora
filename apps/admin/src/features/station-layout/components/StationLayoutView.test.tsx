import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { StationLayoutView } from './StationLayoutView';
import type { LayoutPlatformDetailDTO, LayoutConcourseDTO, StationLayoutContext } from '@/features/station-layout/ports';
import type { TrainOptionDTO } from '@/features/stop-pattern/domain/types';

// StationLayoutView は StationLayoutEditor（Client Component）を常に描画する。
// useRouter() が App Router のコンテキストを要求するためモックする
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// 座標を持たないコンコース。図には描けず「位置未登録の設備・乗換」に出る
const undrawableConcourse: LayoutConcourseDTO = {
  id: 'concourse-1',
  exits: '3番出口',
  notes: null,
  cells: [
    {
      id: 'cell-1',
      xPositionMeters: null,
      facilities: [
        {
          id: 'f-1', typeCode: 'elevator', typeName: 'エレベーター',
          isWheelchairAccessible: true, isStrollerAccessible: true, notes: null,
        },
      ],
    },
  ],
  connections: [],
};

function buildPlatform(overrides: Partial<LayoutPlatformDetailDTO>): LayoutPlatformDetailDTO {
  return {
    id: 'platform-1',
    platformNumber: '1',
    lineId: 'line-1',
    lineName: '銀座線',
    lineColor: '#ff9500',
    inboundDirectionId: null,
    inboundDirectionName: null,
    outboundDirectionId: null,
    outboundDirectionName: null,
    platformSide: null,
    notes: '階段は1か所のみ',
    physicalLength: 200,
    stopPatterns: [],
    concourses: [undrawableConcourse],
    selectedPatternId: null,
    ...overrides,
  };
}

function buildContext(platform: LayoutPlatformDetailDTO, trains: TrainOptionDTO[] = []): StationLayoutContext {
  return {
    stationName: '渋谷',
    platforms: [
      { id: 'platform-1', platformNumber: '1' },
      { id: 'platform-2', platformNumber: '2' },
    ],
    platform,
    lines: [],
    facilityTypes: [],
    connectedStations: [],
    trains,
  };
}

function renderView(platform: LayoutPlatformDetailDTO, trains: TrainOptionDTO[] = []) {
  return render(
    <MantineProvider>
      <StationLayoutView stationId="station-1" context={buildContext(platform, trains)} />
    </MantineProvider>,
  );
}

describe('StationLayoutView', () => {
  // 図を描けない状態でも、座標未入力のデータと備考は見えていなければならない（web の PlatformDisplay と同じ）
  // 「3番出口」はコンコース一覧（StationLayoutEditor）のボタンラベルにも出るため、
  // 「位置未登録の設備・乗換」セクションにスコープして検証する
  it('ホーム長が未入力でも、位置未登録の設備と備考を表示する', () => {
    renderView(buildPlatform({ physicalLength: 0 }));

    expect(screen.getByText('ホーム長が未登録のため図を表示できません')).toBeInTheDocument();
    const undrawableSection = within(screen.getByTestId('undrawable-section'));
    expect(undrawableSection.getByText('位置未登録の設備・乗換')).toBeInTheDocument();
    expect(undrawableSection.getByText('3番出口')).toBeInTheDocument();
    expect(undrawableSection.getByText('エレベーター')).toBeInTheDocument();
    expect(screen.getByText('階段は1か所のみ')).toBeInTheDocument();
  });

  it('停車パターンが無くても、位置未登録の設備と備考を表示する', () => {
    renderView(buildPlatform({ physicalLength: 200, stopPatterns: [], selectedPatternId: null }));

    expect(screen.getByText('列車情報がありません')).toBeInTheDocument();
    const undrawableSection = within(screen.getByTestId('undrawable-section'));
    expect(undrawableSection.getByText('位置未登録の設備・乗換')).toBeInTheDocument();
    expect(undrawableSection.getByText('3番出口')).toBeInTheDocument();
    expect(screen.getByText('階段は1か所のみ')).toBeInTheDocument();
  });

  // バグ報告: 1路線に2ホーム以上あるとき、あるホームで列車Aの停車位置を登録すると、
  // 別のホームで列車Aを選択できなくなる。StationLayoutEditor に platform.id 単位の
  // key が無く、ホーム切替（同一route内でのsearchParams変更）で React が
  // インスタンスを使い回すため、useState(platform.stopPatterns) 由来の
  // patternBaselines が前のホームの値のまま残ることが原因
  it('ホームを切り替えると、前のホームで登録済みだった列車も新しいホームでは選択できる', async () => {
    const user = userEvent.setup();
    const trains: TrainOptionDTO[] = [
      { id: 'train-a', name: '列車A', carCount: 1, cars: [{ carNumber: 1, carLength: null, doorCount: 4 }] },
      { id: 'train-b', name: '列車B', carCount: 1, cars: [{ carNumber: 1, carLength: null, doorCount: 4 }] },
    ];

    const platform1 = buildPlatform({
      id: 'platform-1',
      stopPatterns: [{
        patternId: 'pattern-a',
        trainId: 'train-a',
        trainLabel: '列車A',
        carCount: 1,
        cars: [{
          carNumber: 1, startMeters: 0, endMeters: 100, doorCount: 4, freeSpaceDoors: [], prioritySeatDoors: [],
        }],
      }],
      selectedPatternId: 'pattern-a',
    });
    const platform2 = buildPlatform({
      id: 'platform-2', platformNumber: '2', stopPatterns: [], selectedPatternId: null,
    });

    const { rerender } = render(
      <MantineProvider>
        <StationLayoutView stationId="station-1" context={buildContext(platform1, trains)} />
      </MantineProvider>,
    );
    expect(screen.getAllByText('列車A').length).toBeGreaterThan(0);

    // ホーム2へ切替。実際のアプリではURL遷移でStationLayoutViewごと再レンダーされる
    rerender(
      <MantineProvider>
        <StationLayoutView stationId="station-1" context={buildContext(platform2, trains)} />
      </MantineProvider>,
    );

    await user.click(screen.getByRole('button', { name: '+ 停車位置を追加' }));
    const trainSelect = screen.getByRole('combobox', { name: '列車' });
    expect(within(trainSelect).getByRole('option', { name: '列車A（1両）' })).toBeInTheDocument();
  });
});
