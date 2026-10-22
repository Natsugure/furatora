import { standardByDoor } from './consist';

// 図の下に出す、フリースペース・優先席のドアの一覧。

export type DoorPosition = { carNumber: number; doorNumber: number };

export type DoorListGroups = { standard: DoorPosition[]; partial: DoorPosition[] };

/**
 * 号車のドアを「全編成」「一部編成」に分ける。どちらも号車→ドアの昇順。
 *
 * 同じドアに全編成と一部編成の両方があれば全編成だけに出す（standardByDoor()）。
 * 図の freeSpaceMarks() と同じ規則にして、図と一覧を食い違わせないため。
 */
export function doorListGroups(
  cars: { carNumber: number; doors: { nearDoor: number; isStandard: boolean }[] }[],
): DoorListGroups {
  const standard: DoorPosition[] = [];
  const partial: DoorPosition[] = [];

  for (const car of [...cars].sort((a, b) => a.carNumber - b.carNumber)) {
    const doors = [...standardByDoor(car.doors).entries()].sort(([a], [b]) => a - b);
    for (const [doorNumber, isStandard] of doors) {
      (isStandard ? standard : partial).push({ carNumber: car.carNumber, doorNumber });
    }
  }

  return { standard, partial };
}
