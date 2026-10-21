import { describe, it, expect } from 'vitest';
import { doorListGroups } from './doorList';

describe('doorListGroups', () => {
  it('全編成と一部編成に分ける', () => {
    const groups = doorListGroups([
      {
        carNumber: 1,
        doors: [
          { nearDoor: 3, isStandard: true },
          { nearDoor: 1, isStandard: false },
        ],
      },
    ]);

    expect(groups).toEqual({
      standard: [{ carNumber: 1, doorNumber: 3 }],
      partial: [{ carNumber: 1, doorNumber: 1 }],
    });
  });

  it('入力の順によらず、号車→ドアの昇順に並べる', () => {
    const groups = doorListGroups([
      { carNumber: 2, doors: [{ nearDoor: 1, isStandard: true }] },
      {
        carNumber: 1,
        doors: [
          { nearDoor: 3, isStandard: true },
          { nearDoor: 2, isStandard: true },
        ],
      },
    ]);

    expect(groups.standard).toEqual([
      { carNumber: 1, doorNumber: 2 },
      { carNumber: 1, doorNumber: 3 },
      { carNumber: 2, doorNumber: 1 },
    ]);
  });

  it('同じドアに全編成と一部編成の両方があれば、全編成だけに出す', () => {
    const groups = doorListGroups([
      {
        carNumber: 1,
        doors: [
          { nearDoor: 2, isStandard: false },
          { nearDoor: 2, isStandard: true },
        ],
      },
    ]);

    expect(groups).toEqual({ standard: [{ carNumber: 1, doorNumber: 2 }], partial: [] });
  });

  it('同じドアの重複は1つにする', () => {
    const groups = doorListGroups([
      {
        carNumber: 1,
        doors: [
          { nearDoor: 2, isStandard: false },
          { nearDoor: 2, isStandard: false },
        ],
      },
    ]);

    expect(groups).toEqual({ standard: [], partial: [{ carNumber: 1, doorNumber: 2 }] });
  });

  it('ドアが無ければ両方空', () => {
    expect(doorListGroups([{ carNumber: 1, doors: [] }])).toEqual({ standard: [], partial: [] });
    expect(doorListGroups([])).toEqual({ standard: [], partial: [] });
  });
});
