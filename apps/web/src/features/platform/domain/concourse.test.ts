import { describe, it, expect } from 'vitest';
import { connectionLabels, connectionShortLabels, exitsLabel, hasDisplayableInfo } from './concourse';
import type { ConcourseDTO, FacilityConnectionDTO } from './types';

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

function concourse(overrides: Partial<ConcourseDTO> = {}): ConcourseDTO {
  return { id: 'c1', exits: null, cells: [], connections: [], ...overrides };
}

describe('exitsLabel', () => {
  it('出口名をそのまま返す', () => {
    expect(exitsLabel(concourse({ exits: '南口・新南口' }))).toBe('南口・新南口');
  });

  it('前後の空白を取り除く', () => {
    expect(exitsLabel(concourse({ exits: '  南口  ' }))).toBe('南口');
  });

  it('null・空文字・空白のみは未入力として null を返す', () => {
    expect(exitsLabel(concourse({ exits: null }))).toBeNull();
    expect(exitsLabel(concourse({ exits: '' }))).toBeNull();
    expect(exitsLabel(concourse({ exits: '   ' }))).toBeNull();
  });
});

describe('hasDisplayableInfo', () => {
  it('設備も出口名も乗換先も無ければ表示しない', () => {
    expect(hasDisplayableInfo(concourse())).toBe(false);
  });

  it('乗換先が未設定でも出口名だけで表示する', () => {
    expect(hasDisplayableInfo(concourse({ exits: '南口' }))).toBe(true);
  });

  it('出口名が未設定でも乗換先だけで表示する', () => {
    expect(hasDisplayableInfo(concourse({ connections: [connection()] }))).toBe(true);
  });

  it('出口名も乗換先も未設定でも設備があれば表示する', () => {
    expect(
      hasDisplayableInfo(concourse({ cells: [{ xPositionMeters: 10, facilities: [] }] })),
    ).toBe(true);
  });

  it('空白のみの出口名は表示のきっかけにしない', () => {
    expect(hasDisplayableInfo(concourse({ exits: '   ' }))).toBe(false);
  });
});

describe('connectionLabels', () => {
  it('接続が無ければ空配列を返す', () => {
    expect(connectionLabels(concourse())).toEqual([]);
  });

  it('路線名を連結する', () => {
    const labels = connectionLabels(
      concourse({ connections: [connection({ lineNames: ['小田急線', '京王線'] })] }),
    );
    expect(labels).toEqual(['小田急線・京王線']);
  });

  it('方面名があれば併記する', () => {
    const labels = connectionLabels(
      concourse({ connections: [connection({ directionName: '藤沢' })] }),
    );
    expect(labels).toEqual(['小田急線（藤沢方面）']);
  });

  it('exitLabel（管理画面の備考）があれば末尾に添える', () => {
    const labels = connectionLabels(
      concourse({ connections: [connection({ exitLabel: '西口地下' })] }),
    );
    expect(labels).toEqual(['小田急線［西口地下］']);
  });

  it('路線が引けない接続は駅名で代替し、空ラベルにしない', () => {
    const labels = connectionLabels(
      concourse({ connections: [connection({ lineNames: [], stationName: '新宿三丁目' })] }),
    );
    expect(labels).toEqual(['新宿三丁目']);
  });

  it('複数の接続をそれぞれ1要素として返す', () => {
    const labels = connectionLabels(
      concourse({
        connections: [
          connection({ lineNames: ['小田急線'], directionName: '藤沢' }),
          connection({ lineNames: ['京王線'], exitLabel: '中央口' }),
        ],
      }),
    );
    expect(labels).toEqual(['小田急線（藤沢方面）', '京王線［中央口］']);
  });
});

describe('connectionShortLabels', () => {
  it('接続が無ければ空配列を返す', () => {
    expect(connectionShortLabels(concourse())).toEqual([]);
  });

  it('1路線ならそのまま返す', () => {
    expect(
      connectionShortLabels(concourse({ connections: [connection({ lineNames: ['小田急線'] })] })),
    ).toEqual(['小田急線']);
  });

  it('2路線までは連結する', () => {
    expect(
      connectionShortLabels(
        concourse({ connections: [connection({ lineNames: ['小田急線', '京王線'] })] }),
      ),
    ).toEqual(['小田急線・京王線']);
  });

  it('3路線以上は「先頭路線ほかN」に畳む', () => {
    expect(
      connectionShortLabels(
        concourse({
          connections: [connection({ lineNames: ['JR山手線', 'JR中央線', '小田急線', '京王線'] })],
        }),
      ),
    ).toEqual(['JR山手線ほか3']);
  });

  it('路線が引けない接続は駅名で代替する', () => {
    expect(
      connectionShortLabels(
        concourse({ connections: [connection({ lineNames: [], stationName: '新宿三丁目' })] }),
      ),
    ).toEqual(['新宿三丁目']);
  });

  it('方面名・備考は落とす（全文は connectionLabels 側にある）', () => {
    expect(
      connectionShortLabels(
        concourse({
          connections: [connection({ directionName: '藤沢', exitLabel: '西口地下' })],
        }),
      ),
    ).toEqual(['小田急線']);
  });

  it('複数の接続をそれぞれ1要素として返す', () => {
    expect(
      connectionShortLabels(
        concourse({
          connections: [
            connection({ lineNames: ['小田急線'] }),
            connection({ lineNames: ['JR山手線', 'JR中央線', 'JR埼京線'] }),
          ],
        }),
      ),
    ).toEqual(['小田急線', 'JR山手線ほか2']);
  });
});
