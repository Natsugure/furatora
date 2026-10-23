import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PlatformDTO, TrainStopPatternDTO } from '@furatora/platform-diagram/domain';
import { PlatformDisplay } from './PlatformDisplay';

function pattern(overrides: Partial<TrainStopPatternDTO> & { trainId: string }): TrainStopPatternDTO {
  return {
    trainLabel: `列車${overrides.trainId}`,
    carCount: 2,
    cars: [
      { carNumber: 1, startMeters: 0, endMeters: 20, doorCount: 4, freeSpaceDoors: [], prioritySeatDoors: [] },
      { carNumber: 2, startMeters: 20, endMeters: 40, doorCount: 4, freeSpaceDoors: [], prioritySeatDoors: [] },
    ],
    ...overrides,
  };
}

function platform(overrides: Partial<PlatformDTO> = {}): PlatformDTO {
  return {
    id: 'p1',
    platformNumber: '2',
    lineId: 'line-1',
    lineName: '丸ノ内線',
    lineColor: '#f62e36',
    inboundDirectionId: 'd1',
    inboundDirectionName: '池袋方面',
    outboundDirectionId: null,
    outboundDirectionName: null,
    notes: null,
    physicalLength: 120,
    stopPatterns: [pattern({ trainId: 't1', carCount: 6 })],
    concourses: [],
    ...overrides,
  };
}

const toggle = () => screen.getByRole('button', { name: '2番線' });

function partition<T>(list: T[], predicate: (item: T) => boolean): [T[], T[]] {
  return [list.filter(predicate), list.filter((item) => !predicate(item))];
}

describe('PlatformDisplay', () => {
  it('頭に番線・路線・編成・方面を出す', () => {
    render(<PlatformDisplay platform={platform()} />);

    expect(toggle()).toBeInTheDocument();
    expect(screen.getByText('丸ノ内線 · 6両編成')).toBeInTheDocument();
    expect(screen.getByText('池袋方面')).toBeInTheDocument();
    expect(screen.queryByText('図はまだありません')).not.toBeInTheDocument();
  });

  it('図を描ける番線は、開くと列車の図が出る', async () => {
    render(<PlatformDisplay platform={platform()} />);
    await userEvent.click(toggle());

    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('heading', { name: '列車t1' })).toBeInTheDocument();
  });

  it('ホーム長が未登録の番線は、頭に図が無いことを示す', () => {
    render(<PlatformDisplay platform={platform({ physicalLength: 0 })} />);
    expect(screen.getByText('図はまだありません')).toBeInTheDocument();
  });

  it('列車が無い番線は、編成を出さず、頭に図が無いことを示す', () => {
    render(<PlatformDisplay platform={platform({ stopPatterns: [], notes: 'ホームの注記' })} />);

    expect(screen.getByText('丸ノ内線')).toBeInTheDocument();
    expect(screen.getByText('図はまだありません')).toBeInTheDocument();
  });

  it('図を描けなくても注記があれば、開け閉めできる', () => {
    render(<PlatformDisplay platform={platform({ physicalLength: 0, notes: 'ホームの注記' })} />);
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
  });

  it('図を描けず、カードに出すものが頭しか無い番線は、開け閉めできない', () => {
    render(<PlatformDisplay platform={platform({ stopPatterns: [] })} />);

    expect(screen.getByRole('heading', { name: '2番線' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '2番線' })).not.toBeInTheDocument();
  });

  it('図を描けない番線を開くと、頭の一言は消え、中身で理由を示す', async () => {
    render(<PlatformDisplay platform={platform({ physicalLength: 0, notes: 'ホームの注記' })} />);
    await userEvent.click(toggle());

    expect(screen.queryByText('図はまだありません')).not.toBeInTheDocument();
    expect(screen.getByText('ホーム長が未登録のため図を表示できません')).toBeInTheDocument();
  });

  describe('図', () => {
    const facingText = '有楽町線（新木場方面）は同じホームの向かい側に到着';

    it('対面乗換の札を、出口・乗換のプレートと同じく図の下に出す', async () => {
      const concourse = {
        id: 'c1',
        exits: null,
        cells: [],
        connections: [
          {
            lineNames: ['有楽町線'],
            lineColors: ['#c1a470'],
            directionName: '新木場',
            exitLabel: null,
            xRangeStart: 10,
            xRangeEnd: 30,
          },
        ],
      };
      render(<PlatformDisplay platform={platform({ concourses: [concourse] })} />);
      await userEvent.click(toggle());

      // 図の中にも、帯の <title> として同じ文がある。札はそれとは別の、図の外の要素
      const [inDiagram, tag] = partition(screen.getAllByText(facingText), (el) => el.closest('svg') !== null);
      const diagram = inDiagram[0]!.closest('svg')!;
      expect(tag).toHaveLength(1);
      expect(diagram.compareDocumentPosition(tag[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('一部編成のフリースペースは、図の中で号車・ドア・一部編成であることを文で示す', async () => {
      const base = pattern({ trainId: 't1' });
      const [c1, c2] = base.cars;
      render(
        <PlatformDisplay
          platform={platform({
            stopPatterns: [{ ...base, cars: [{ ...c1!, freeSpaceDoors: [{ nearDoor: 1, isStandard: false }] }, c2!] }],
          })}
        />,
      );
      await userEvent.click(toggle());

      expect(screen.getByText('1号車 1番ドア付近のフリースペース（一部編成）')).toBeInTheDocument();
    });
  });

  describe('図の下の一覧', () => {
    const doors = (...list: [number, boolean][]) => list.map(([nearDoor, isStandard]) => ({ nearDoor, isStandard }));

    function withDoors(car1: Partial<TrainStopPatternDTO['cars'][number]>, car2: Partial<TrainStopPatternDTO['cars'][number]>) {
      const base = pattern({ trainId: 't1' });
      const [c1, c2] = base.cars;
      return platform({ stopPatterns: [{ ...base, cars: [{ ...c1!, ...car1 }, { ...c2!, ...car2 }] }] });
    }

    const items = (name: string) =>
      within(screen.getByRole('list', { name }))
        .getAllByRole('listitem')
        .map((li) => li.textContent);

    it('フリースペースを全編成と一部編成の見出しで分ける', async () => {
      render(
        <PlatformDisplay
          platform={withDoors({ freeSpaceDoors: doors([3, true], [1, false]) }, { freeSpaceDoors: doors([3, true]) })}
        />,
      );
      await userEvent.click(toggle());

      expect(items('フリースペース 全編成')).toEqual(['1号車3番ドア付近', '2号車3番ドア付近']);
      expect(items('フリースペース 一部編成')).toEqual(['1号車1番ドア付近']);
    });

    it('優先席も全編成と一部編成の見出しで分ける', async () => {
      render(
        <PlatformDisplay
          platform={withDoors({ prioritySeatDoors: doors([1, true]) }, { prioritySeatDoors: doors([4, false]) })}
        />,
      );
      await userEvent.click(toggle());

      expect(items('優先席 全編成')).toEqual(['1号車1番ドア付近']);
      expect(items('優先席 一部編成')).toEqual(['2号車4番ドア付近']);
    });

    it('一部編成のドアが無ければ、一部編成の見出しを出さない', async () => {
      render(<PlatformDisplay platform={withDoors({ freeSpaceDoors: doors([3, true]) }, {})} />);
      await userEvent.click(toggle());

      expect(screen.getByRole('heading', { name: 'フリースペース 全編成' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'フリースペース 一部編成' })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /優先席/ })).not.toBeInTheDocument();
    });

    it('一覧をランドマークにしない（列車の数だけ同じ名前のランドマークが並ぶため）', async () => {
      render(<PlatformDisplay platform={withDoors({ freeSpaceDoors: doors([3, true]) }, {})} />);
      await userEvent.click(toggle());

      expect(screen.queryByRole('region', { name: 'フリースペース 全編成' })).not.toBeInTheDocument();
    });
  });
});
