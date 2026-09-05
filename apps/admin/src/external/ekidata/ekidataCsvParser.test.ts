import { describe, it, expect } from 'vitest';
import { ekidataCsvSource } from './ekidataCsvParser';
import type { EkidataCsvFiles } from '@/features/master-import/ports';
import type { ImportedRecords, ImportWarningCode } from '@/features/master-import/domain/importedRecords';

const COMPANY_HEADER =
  'company_cd,rr_cd,company_name,company_name_k,company_name_h,company_name_r,company_url,company_type,e_status,e_sort';
const LINE_HEADER =
  'line_cd,company_cd,line_name,line_name_k,line_name_h,line_color_c,line_color_t,line_type,lon,lat,zoom,e_status,e_sort';
const STATION_HEADER =
  'station_cd,station_g_cd,station_name,station_name_k,station_name_r,line_cd,pref_cd,post,address,lon,lat,open_ymd,close_ymd,e_status,e_sort';
const JOIN_HEADER = 'line_cd,station_cd1,station_cd2';

const company = (cd: number, name: string, status = '0') =>
  `${cd},11,${name},カナ,正式名,略称,http://example.com/,1,${status},${cd}`;

const line = (cd: number, companyCd: number, name: string, color = '0000FF', status = '0') =>
  `${cd},${companyCd},${name},カナ,${name},${color},ブルー,1,139.0,35.0,8,${status},${cd}`;

const station = (
  cd: number,
  groupCd: number,
  name: string,
  lineCd: number,
  options: { status?: string; kana?: string; lat?: string; lon?: string; closeYmd?: string } = {},
) => {
  const {
    status = '0',
    kana = 'カナ',
    lat = '35.681382',
    lon = '139.74044',
    closeYmd = '0000-00-00',
  } = options;
  return `${cd},${groupCd},${name},${kana},romaji,${lineCd},13,100-0005,千代田区丸の内一丁目9-1,${lon},${lat},1914-12-20,${closeYmd},${status},${cd}`;
};

function files(overrides: Partial<EkidataCsvFiles> = {}): EkidataCsvFiles {
  return {
    company: [COMPANY_HEADER, company(1, 'JR北海道'), company(2, 'JR東日本')].join('\n'),
    line: [LINE_HEADER, line(1001, 1, '函館線'), line(1002, 2, '東海道新幹線')].join('\n'),
    station: [
      STATION_HEADER,
      station(100101, 100101, '函館', 1001),
      station(100102, 100101, '五稜郭', 1001),
      station(100201, 100101, '東京', 1002),
    ].join('\n'),
    join: [JOIN_HEADER, '1001,100101,100102'].join('\n'),
    ...overrides,
  };
}

function parseOrThrow(input: EkidataCsvFiles): ImportedRecords {
  const result = ekidataCsvSource.parse(input);
  if (!result.ok) throw new Error(`parse failed: ${JSON.stringify(result.errors)}`);
  return result.records;
}

function warning(records: ImportedRecords, code: ImportWarningCode) {
  return records.warnings.find((w) => w.code === code);
}

describe('ekidataCsvSource.parse', () => {
  it('4種のCSVを furatora 側の形に変換する', () => {
    const records = parseOrThrow(files());

    expect(records.operators).toEqual([
      { ekidataCompanyCd: 1, name: 'JR北海道' },
      { ekidataCompanyCd: 2, name: 'JR東日本' },
    ]);
    expect(records.lines).toHaveLength(2);
    expect(records.stations).toHaveLength(3);
    expect(records.adjacencies).toEqual([
      { ekidataLineCd: 1001, ekidataStationCdA: 100101, ekidataStationCdB: 100102 },
    ]);
  });

  it('路線色に # を付けて大文字にする', () => {
    const records = parseOrThrow(files());
    expect(records.lines[0]!.color).toBe('#0000FF');
  });

  it('路線色が空なら null にする（空値では上書きしない）', () => {
    const records = parseOrThrow(
      files({ line: [LINE_HEADER, line(1001, 1, '函館線', '')].join('\n') }),
    );
    expect(records.lines[0]!.color).toBeNull();
  });

  it('lat / lon を小数6桁へ揃える', () => {
    const records = parseOrThrow(files());
    expect(records.stations[0]!.lat).toBe('35.681382');
    expect(records.stations[0]!.lon).toBe('139.740440');
  });

  it('カナが空なら null にする', () => {
    const records = parseOrThrow(
      files({
        station: [STATION_HEADER, station(100101, 100101, '函館', 1001, { kana: '' })].join('\n'),
      }),
    );
    expect(records.stations[0]!.nameKana).toBeNull();
  });
});

describe('e_status の分岐', () => {
  it('廃止(2)の駅は取り込まず、廃止日を closures に残す', () => {
    const records = parseOrThrow(
      files({
        station: [
          STATION_HEADER,
          station(100101, 100101, '函館', 1001),
          station(100199, 100101, '旧駅', 1001, { status: '2', closeYmd: '2020-04-01' }),
        ].join('\n'),
      }),
    );
    expect(records.stations.map((s) => s.ekidataStationCd)).toEqual([100101]);
    expect(records.closures.stations.get(100199)).toBe('2020-04-01');
  });

  it('廃止日が 0000-00-00 なら null にする（date 列に入れられない）', () => {
    const records = parseOrThrow(
      files({
        station: [
          STATION_HEADER,
          station(100101, 100101, '函館', 1001),
          station(100199, 100101, '旧駅', 1001, { status: '2' }),
        ].join('\n'),
      }),
    );
    expect(records.closures.stations.get(100199)).toBeNull();
  });

  it('未開業(1)の駅は取り込まず、廃止扱いにもしない', () => {
    const records = parseOrThrow(
      files({
        station: [
          STATION_HEADER,
          station(100101, 100101, '函館', 1001),
          station(100198, 100198, '新駅', 1001, { status: '1' }),
        ].join('\n'),
      }),
    );
    expect(records.stations.map((s) => s.ekidataStationCd)).toEqual([100101]);
    expect(records.closures.stations.has(100198)).toBe(false);
    expect(warning(records, 'not_yet_opened_station')?.count).toBe(1);
  });

  it('廃止(2)の路線は取り込まず closures に残す。line CSV に廃止日の列は無い', () => {
    const records = parseOrThrow(
      files({
        line: [LINE_HEADER, line(1001, 1, '函館線'), line(1099, 1, '廃線', '0000FF', '2')].join(
          '\n',
        ),
        station: [STATION_HEADER, station(100101, 100101, '函館', 1001)].join('\n'),
        join: JOIN_HEADER,
      }),
    );
    expect(records.lines.map((l) => l.ekidataLineCd)).toEqual([1001]);
    expect(records.closures.lines.has(1099)).toBe(true);
    expect(records.closures.lines.get(1099)).toBeNull();
  });
});

describe('seen（CSV に載っていたコードの全体）', () => {
  it('取り込んだ・廃止・未開業・事業者不明のいずれの line_cd も seen に入る', () => {
    const records = parseOrThrow(
      files({
        company: [COMPANY_HEADER, company(1, 'JR北海道')].join('\n'),
        line: [
          LINE_HEADER,
          line(1001, 1, '函館線'), // 取り込む
          line(1099, 1, '廃線', '0000FF', '2'), // 廃止
          line(1098, 1, '未開業線', '0000FF', '1'), // 未開業
          line(1097, 999, '事業者不明線'), // company_cd が現役でない
        ].join('\n'),
        station: [STATION_HEADER, station(100101, 100101, '函館', 1001)].join('\n'),
        join: JOIN_HEADER,
      }),
    );
    expect(records.lines.map((l) => l.ekidataLineCd)).toEqual([1001]);
    expect([...records.seen.lines].sort()).toEqual([1001, 1097, 1098, 1099]);
  });

  it('取り込まなかった station_cd も seen に入る', () => {
    const records = parseOrThrow(
      files({
        station: [
          STATION_HEADER,
          station(100101, 100101, '函館', 1001),
          station(100199, 100101, '旧駅', 1001, { status: '2', closeYmd: '2020-04-01' }),
          station(100198, 100198, '新駅', 1001, { status: '1' }),
          station(100197, 100197, '路線不明駅', 9999),
        ].join('\n'),
      }),
    );
    expect(records.stations.map((s) => s.ekidataStationCd)).toEqual([100101]);
    expect([...records.seen.stations].sort()).toEqual([100101, 100197, 100198, 100199]);
  });
});

describe('参照の欠落', () => {
  // station_cd の上位桁は line_cd と一致しない（実データで137件の例外）。
  // 上位桁から導出していると、この駅が別の路線に付く
  it('station_cd の上位桁ではなく line_cd 列で路線を決める', () => {
    const records = parseOrThrow(
      files({
        station: [STATION_HEADER, station(100201, 100101, '東京', 1002)].join('\n'),
        join: JOIN_HEADER,
      }),
    );
    expect(records.stations[0]!.ekidataLineCd).toBe(1002);
  });

  it('line_cd が現役路線に無い駅は取り込まず警告にする', () => {
    const records = parseOrThrow(
      files({
        station: [
          STATION_HEADER,
          station(100101, 100101, '函館', 1001),
          station(900001, 900001, '孤児駅', 9999),
        ].join('\n'),
        join: JOIN_HEADER,
      }),
    );
    expect(records.stations).toHaveLength(1);
    expect(warning(records, 'station_with_unknown_line')?.count).toBe(1);
  });

  it('company_cd が現役事業者に無い路線は取り込まず警告にする', () => {
    const records = parseOrThrow(
      files({
        line: [LINE_HEADER, line(1001, 1, '函館線'), line(9999, 888, '孤児線')].join('\n'),
        station: [STATION_HEADER, station(100101, 100101, '函館', 1001)].join('\n'),
        join: JOIN_HEADER,
      }),
    );
    expect(records.lines.map((l) => l.ekidataLineCd)).toEqual([1001]);
    expect(warning(records, 'line_with_unknown_company')?.count).toBe(1);
  });

  it('端点が現役駅でない join 行は取り込まず警告にする', () => {
    const records = parseOrThrow(
      files({ join: [JOIN_HEADER, '1001,100101,100102', '1001,100101,999999'].join('\n') }),
    );
    expect(records.adjacencies).toHaveLength(1);
    expect(warning(records, 'adjacency_endpoint_missing')?.count).toBe(1);
  });

  it('line_cd が現役路線に無い join 行は取り込まず警告にする', () => {
    const records = parseOrThrow(
      files({ join: [JOIN_HEADER, '9999,100101,100102'].join('\n') }),
    );
    expect(records.adjacencies).toHaveLength(0);
    expect(warning(records, 'adjacency_unknown_line')?.count).toBe(1);
  });
});

describe('station_g_cd から乗換単位の駅を導く', () => {
  it('station_cd と一致する駅を代表にする', () => {
    const records = parseOrThrow(files());
    const group = records.stationGroups.find((g) => g.ekidataStationGroupCd === 100101);
    expect(group?.name).toBe('函館');
    expect(warning(records, 'dangling_station_group')).toBeUndefined();
  });

  // REQ-8.2: グループを破棄しない
  it('代表になる駅が現役に無ければ、最小の station_cd を代表にして警告する', () => {
    const records = parseOrThrow(
      files({
        station: [
          STATION_HEADER,
          station(100105, 100100, '五稜郭', 1001),
          station(100103, 100100, '函館', 1001),
        ].join('\n'),
        join: JOIN_HEADER,
      }),
    );
    const group = records.stationGroups.find((g) => g.ekidataStationGroupCd === 100100);
    expect(group?.name).toBe('函館');
    expect(warning(records, 'dangling_station_group')?.count).toBe(1);
  });

  it('グループを station_g_cd の昇順で返す', () => {
    const records = parseOrThrow(files());
    const cds = records.stationGroups.map((g) => g.ekidataStationGroupCd);
    expect(cds).toEqual([...cds].sort((a, b) => a - b));
  });
});

describe('検証エラー', () => {
  it('必須列の欠落を、ファイル名と列名で報告する（REQ-1.4）', () => {
    const result = ekidataCsvSource.parse(
      files({ station: 'station_cd,station_name\n100101,函館' }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      kind: 'missing_columns',
      file: 'station',
      columns: expect.arrayContaining(['station_g_cd', 'line_cd', 'e_status']),
    });
  });

  it('4ファイルすべてを検査してから返す', () => {
    const result = ekidataCsvSource.parse({
      company: 'company_cd\n1',
      line: 'line_cd\n1001',
      station: 'station_cd\n100101',
      join: 'line_cd\n1001',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => e.file)).toEqual(['company', 'line', 'station', 'join']);
  });

  it('列数の合わない行を malformed として報告する', () => {
    const result = ekidataCsvSource.parse({
      ...files(),
      join: [JOIN_HEADER, '1001,100101'].join('\n'),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ kind: 'malformed', file: 'join' });
  });

  it('整数でないコードを malformed として報告する', () => {
    const result = ekidataCsvSource.parse(
      files({ join: [JOIN_HEADER, 'ABC,100101,100102'].join('\n') }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ kind: 'malformed', file: 'join' });
  });
});

describe('digest', () => {
  it('同じ内容なら同じ値になる', async () => {
    expect(await ekidataCsvSource.digest(files())).toBe(await ekidataCsvSource.digest(files()));
  });

  it('1文字でも違えば別の値になる', async () => {
    const a = await ekidataCsvSource.digest(files());
    const b = await ekidataCsvSource.digest(
      files({ company: [COMPANY_HEADER, company(1, 'JR北海道'), company(2, 'JR東日本 ')].join('\n') }),
    );
    expect(a).not.toBe(b);
  });

  it('ファイル間で内容が入れ替わっても同じ値にならない', async () => {
    const base = files();
    const a = await ekidataCsvSource.digest(base);
    const b = await ekidataCsvSource.digest({ ...base, company: base.line, line: base.company });
    expect(a).not.toBe(b);
  });
});
