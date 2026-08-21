import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LINE_COLOR,
  LABEL_GAP_METERS,
  MAX_CHIPS,
  MAX_LABEL_WIDTH_METERS,
  estimateTextWidth,
  layoutConcourseLabels,
  truncateToWidth,
} from './concourseLayout';
import { CONCOURSE_LABEL_FONT_SIZE } from './geometry';
import type { Bounds } from './geometry';
import type { ConcourseDTO, FacilityConnectionDTO } from './types';

const BOUNDS: Bounds = { minX: -20, maxX: 320 };

function connection(overrides: Partial<FacilityConnectionDTO> = {}): FacilityConnectionDTO {
  return {
    stationName: '新宿',
    lineNames: ['小田急線'],
    lineColors: ['#0072BC'],
    directionName: null,
    exitLabel: null,
    xRangeStart: null,
    xRangeEnd: null,
    ...overrides,
  };
}

function concourse(id: string, overrides: Partial<ConcourseDTO> = {}): ConcourseDTO {
  return { id, exits: '南口', cells: [], connections: [], ...overrides };
}

function cellsAt(...xs: (number | null)[]) {
  return xs.map((x) => ({ xPositionMeters: x, facilities: [] }));
}

describe('estimateTextWidth', () => {
  it('全角文字を1em、半角文字を0.5emとして数える', () => {
    expect(estimateTextWidth('南口', 2)).toBeCloseTo(4);
    expect(estimateTextWidth('AB', 2)).toBeCloseTo(2);
    expect(estimateTextWidth('南口A', 2)).toBeCloseTo(5);
  });

  it('空文字は幅0', () => {
    expect(estimateTextWidth('', 2)).toBe(0);
  });

  it('半角カナは半角として数える', () => {
    expect(estimateTextWidth('ｱｲ', 2)).toBeCloseTo(2);
  });
});

describe('truncateToWidth', () => {
  it('収まるテキストはそのまま返す', () => {
    expect(truncateToWidth('南口', 2, 10)).toBe('南口');
  });

  it('収まらないテキストは末尾を…で切る', () => {
    // 全角5文字=10m を 7m に収める → 「…」ぶん(2m)を残して全角2文字ぶん
    expect(truncateToWidth('東西南北中', 2, 7)).toBe('東西…');
  });

  it('切り詰めた結果も指定幅に収まる', () => {
    const result = truncateToWidth('東西南北中央線快速電車', 2, 9);
    expect(estimateTextWidth(result, 2)).toBeLessThanOrEqual(9);
  });

  it('「…」すら入らない幅では「…」だけを返す', () => {
    expect(truncateToWidth('東西南北', 2, 1)).toBe('…');
  });
});

describe('layoutConcourseLabels', () => {
  describe('対象の絞り込み', () => {
    it('座標を持つセルが1つも無いコンコースは除外する', () => {
      const layout = layoutConcourseLabels([concourse('c1', { cells: cellsAt(null, null) })], BOUNDS);
      expect(layout.labels).toEqual([]);
      expect(layout.rowCount).toBe(0);
    });

    it('セルを1つも持たないコンコースは除外する', () => {
      expect(layoutConcourseLabels([concourse('c1')], BOUNDS).labels).toEqual([]);
    });

    it('出口名も乗換先も無いコンコースは除外する', () => {
      const layout = layoutConcourseLabels(
        [concourse('c1', { exits: null, cells: cellsAt(10) })],
        BOUNDS,
      );
      expect(layout.labels).toEqual([]);
    });

    it('空白のみの出口名は表示のきっかけにしない', () => {
      const layout = layoutConcourseLabels(
        [concourse('c1', { exits: '   ', cells: cellsAt(10) })],
        BOUNDS,
      );
      expect(layout.labels).toEqual([]);
    });

    it('出口名が無くても乗換先があれば対象にする', () => {
      const layout = layoutConcourseLabels(
        [concourse('c1', { exits: null, cells: cellsAt(10), connections: [connection()] })],
        BOUNDS,
      );
      expect(layout.labels).toHaveLength(1);
      expect(layout.labels[0].exitText).toBeNull();
      expect(layout.labels[0].transferText).toBe('小田急線');
    });
  });

  describe('ブラケットのアンカー', () => {
    it('アクセス点が1つならブラケットは点に潰れる', () => {
      const [label] = layoutConcourseLabels([concourse('c1', { cells: cellsAt(42) })], BOUNDS).labels;

      expect(label.tickXs).toEqual([42]);
      expect(label.bracketStartX).toBe(42);
      expect(label.bracketEndX).toBe(42);
      expect(label.labelX).toBeCloseTo(42);
    });

    it('アクセス点が複数ならブラケットが最小〜最大を張り、ラベルは中点に来る', () => {
      const [label] = layoutConcourseLabels(
        [concourse('c1', { cells: cellsAt(80, 20, 50) })],
        BOUNDS,
      ).labels;

      expect(label.bracketStartX).toBe(20);
      expect(label.bracketEndX).toBe(80);
      expect(label.labelX).toBeCloseTo(50);
    });

    it('縦ヒゲのxは昇順・重複除去され、座標なしのセルは含まない', () => {
      const [label] = layoutConcourseLabels(
        [concourse('c1', { cells: cellsAt(50, null, 20, 50) })],
        BOUNDS,
      ).labels;

      expect(label.tickXs).toEqual([20, 50]);
    });
  });

  describe('ラベルのテキスト', () => {
    it('出口名と短縮した乗換先を持ち、<title>には全文が入る', () => {
      const [label] = layoutConcourseLabels(
        [
          concourse('c1', {
            exits: '南口',
            cells: cellsAt(50),
            connections: [
              connection({ lineNames: ['JR山手線', 'JR中央線', '京王線'], directionName: '藤沢' }),
            ],
          }),
        ],
        BOUNDS,
      ).labels;

      expect(label.exitText).toBe('南口');
      expect(label.transferText).toBe('JR山手線ほか2');
      expect(label.title).toContain('南口');
      // <title> には方面名まで含む全文が残る
      expect(label.title).toContain('JR山手線・JR中央線・京王線（藤沢方面）');
    });

    it('長すぎる乗換テキストは…で省略され、全文は<title>に残る', () => {
      const longNames = ['京王相模原線', '小田急多摩線', '横浜市営地下鉄ブルーライン'];
      const [label] = layoutConcourseLabels(
        [
          concourse('c1', {
            exits: null,
            cells: cellsAt(50),
            connections: longNames.map((n) => connection({ lineNames: [n] })),
          }),
        ],
        BOUNDS,
      ).labels;

      expect(label.transferText).toMatch(/…$/);
      expect(label.transferLineWidth).toBeLessThanOrEqual(MAX_LABEL_WIDTH_METERS);
      expect(label.title).toContain('横浜市営地下鉄ブルーライン');
    });

    it('長すぎる出口名も…で省略される', () => {
      const [label] = layoutConcourseLabels(
        [concourse('c1', { exits: '南口'.repeat(30), cells: cellsAt(50) })],
        BOUNDS,
      ).labels;

      expect(label.exitText).toMatch(/…$/);
      expect(estimateTextWidth(label.exitText!, CONCOURSE_LABEL_FONT_SIZE)).toBeLessThanOrEqual(
        MAX_LABEL_WIDTH_METERS,
      );
    });
  });

  describe('路線カラーチップ', () => {
    it('接続の路線カラーをチップとして持つ', () => {
      const [label] = layoutConcourseLabels(
        [
          concourse('c1', {
            cells: cellsAt(50),
            connections: [connection({ lineColors: ['#0072BC', '#DD0077'] })],
          }),
        ],
        BOUNDS,
      ).labels;

      expect(label.lineColors).toEqual(['#0072BC', '#DD0077']);
    });

    it('路線カラー未設定は既定色に置き換える', () => {
      const [label] = layoutConcourseLabels(
        [concourse('c1', { cells: cellsAt(50), connections: [connection({ lineColors: [null] })] })],
        BOUNDS,
      ).labels;

      expect(label.lineColors).toEqual([DEFAULT_LINE_COLOR]);
    });

    it('チップは上限件数までに絞る', () => {
      const colors = ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666'];
      const [label] = layoutConcourseLabels(
        [concourse('c1', { cells: cellsAt(50), connections: [connection({ lineColors: colors })] })],
        BOUNDS,
      ).labels;

      expect(label.lineColors).toHaveLength(MAX_CHIPS);
      expect(label.lineColors).toEqual(colors.slice(0, MAX_CHIPS));
    });

    it('乗換先が無ければチップも幅も持たない', () => {
      const [label] = layoutConcourseLabels([concourse('c1', { cells: cellsAt(50) })], BOUNDS).labels;

      expect(label.lineColors).toEqual([]);
      expect(label.chipsWidth).toBe(0);
      expect(label.transferLineWidth).toBe(0);
    });
  });

  describe('段の割り当て', () => {
    it('十分に離れた2件はどちらも0段目に置く', () => {
      const layout = layoutConcourseLabels(
        [
          concourse('c1', { exits: '南口', cells: cellsAt(10) }),
          concourse('c2', { exits: '北口', cells: cellsAt(200) }),
        ],
        BOUNDS,
      );

      expect(layout.labels.map((l) => l.row)).toEqual([0, 0]);
      expect(layout.rowCount).toBe(1);
    });

    it('重なる2件は段を分ける', () => {
      const layout = layoutConcourseLabels(
        [
          concourse('c1', { exits: '南口', cells: cellsAt(10) }),
          concourse('c2', { exits: '北口', cells: cellsAt(12) }),
        ],
        BOUNDS,
      );

      expect(layout.labels.map((l) => l.row)).toEqual([0, 1]);
      expect(layout.rowCount).toBe(2);
    });

    it('相互に重なる3件は3段になる', () => {
      const layout = layoutConcourseLabels(
        [
          concourse('c1', { exits: '南口', cells: cellsAt(10) }),
          concourse('c2', { exits: '北口', cells: cellsAt(11) }),
          concourse('c3', { exits: '東口', cells: cellsAt(12) }),
        ],
        BOUNDS,
      );

      expect(layout.labels.map((l) => l.row)).toEqual([0, 1, 2]);
      expect(layout.rowCount).toBe(3);
    });

    it('同じ段に置かれたラベルどうしは間隔を空けて重ならない', () => {
      const layout = layoutConcourseLabels(
        [
          concourse('c1', { exits: '南口', cells: cellsAt(10) }),
          concourse('c2', { exits: '北口', cells: cellsAt(12) }),
          concourse('c3', { exits: '東口', cells: cellsAt(60) }),
        ],
        BOUNDS,
      );

      for (const row of new Set(layout.labels.map((l) => l.row))) {
        const inRow = layout.labels.filter((l) => l.row === row);
        for (let i = 1; i < inRow.length; i++) {
          const prevRight = inRow[i - 1].labelX + inRow[i - 1].labelWidth / 2;
          const currLeft = inRow[i].labelX - inRow[i].labelWidth / 2;
          expect(currLeft - prevRight).toBeGreaterThanOrEqual(LABEL_GAP_METERS);
        }
      }
    });

    it('先に空いた段へ詰める（段数を無駄に増やさない）', () => {
      const layout = layoutConcourseLabels(
        [
          concourse('c1', { exits: '南口', cells: cellsAt(10) }),
          concourse('c2', { exits: '北口', cells: cellsAt(12) }),
          concourse('c3', { exits: '東口', cells: cellsAt(60) }),
        ],
        BOUNDS,
      );

      expect(layout.rowCount).toBe(2);
      expect(layout.labels.find((l) => l.concourseId === 'c3')!.row).toBe(0);
    });

    it('ラベルはx昇順で返す（登録順によらない）', () => {
      const layout = layoutConcourseLabels(
        [
          concourse('c1', { exits: '南口', cells: cellsAt(200) }),
          concourse('c2', { exits: '北口', cells: cellsAt(10) }),
        ],
        BOUNDS,
      );

      expect(layout.labels.map((l) => l.concourseId)).toEqual(['c2', 'c1']);
    });
  });

  describe('viewBox 内へのクランプ', () => {
    it('右端に寄ったコンコースのラベルが viewBox からはみ出さない', () => {
      const [label] = layoutConcourseLabels(
        [concourse('c1', { exits: '中央東改札口', cells: cellsAt(BOUNDS.maxX) })],
        BOUNDS,
      ).labels;

      expect(label.labelX - label.labelWidth / 2).toBeGreaterThanOrEqual(BOUNDS.minX);
      expect(label.labelX + label.labelWidth / 2).toBeLessThanOrEqual(BOUNDS.maxX);
      // ブラケット自体はアクセス点の位置から動かさない
      expect(label.bracketStartX).toBe(BOUNDS.maxX);
    });

    it('左端に寄ったコンコースのラベルが viewBox からはみ出さない', () => {
      const [label] = layoutConcourseLabels(
        [concourse('c1', { exits: '中央西改札口', cells: cellsAt(BOUNDS.minX) })],
        BOUNDS,
      ).labels;

      expect(label.labelX - label.labelWidth / 2).toBeGreaterThanOrEqual(BOUNDS.minX);
    });

    it('viewBox より広いラベルは中央に置く（クランプ範囲が反転しても壊れない）', () => {
      const narrow: Bounds = { minX: 0, maxX: 10 };
      const [label] = layoutConcourseLabels(
        [concourse('c1', { exits: '中央東改札口', cells: cellsAt(2) })],
        narrow,
      ).labels;

      expect(label.labelX).toBeCloseTo(5);
    });
  });
});
