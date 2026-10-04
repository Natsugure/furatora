import { describe, it, expect } from 'vitest';
import { assertKnownFacilityCodes, knownFacilityTypeOptions } from './knownFacilityCodes';
import { UnknownFacilityCodeError } from './ports';

describe('assertKnownFacilityCodes', () => {
  it('知っているコードだけなら何もしない', () => {
    expect(() => assertKnownFacilityCodes(['elevator', 'stairs'])).not.toThrow();
    expect(() => assertKnownFacilityCodes([])).not.toThrow();
  });

  it('知らないコードがあれば、重複を除いたコードを持つ UnknownFacilityCodeError を投げる', () => {
    try {
      assertKnownFacilityCodes(['elevator', 'unknownStep', 'unknownStep', 'newLift']);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(UnknownFacilityCodeError);
      expect((error as UnknownFacilityCodeError).codes).toEqual(['unknownStep', 'newLift']);
    }
  });
});

describe('knownFacilityTypeOptions', () => {
  it('知らないコードの選択肢を除く', () => {
    const result = knownFacilityTypeOptions([
      { code: 'elevator', name: 'エレベーター' },
      { code: 'newLift', name: '新しい昇降機' },
    ]);

    expect(result).toEqual([{ code: 'elevator', name: 'エレベーター' }]);
  });
});
