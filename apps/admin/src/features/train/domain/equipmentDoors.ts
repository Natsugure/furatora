// 列車の設備（フリースペース・優先席）の号車・ドア番号の範囲（Issue #194）。
// 不変条件: 設備の nearDoor は、その号車（carStructure にある carNumber）の 1..doorCount に入る
// （docs/domain/train-stop-patterns.md「列車の設備」）。範囲外だと、ホームの図はドアを号車の外に描き、
// 図の下の一覧と食い違う。trainSchema（API）と TrainForm（行ごとのエラー）が同じこの関数で判定する。

export type EquipmentDoorIssue = {
  /** equipments の添字 */
  index: number;
  field: 'carNumber' | 'nearDoor';
  message: string;
};

type CarStructure = readonly { carNumber: number; doorCount: number }[] | null | undefined;

/** 号車のドア数。車両構成に無い号車なら undefined */
export function doorCountOf(carStructure: CarStructure, carNumber: number): number | undefined {
  return carStructure?.find((car) => car.carNumber === carNumber)?.doorCount;
}

/** 設備の号車とドア番号が、車両構成の範囲内にあるかを確かめる。1 行に出す issue は 1 つまで */
export function equipmentDoorIssues(
  carStructure: CarStructure,
  equipments: readonly { carNumber: number; nearDoor: number }[],
): EquipmentDoorIssue[] {
  const issues: EquipmentDoorIssue[] = [];
  equipments.forEach((equipment, index) => {
    const doorCount = doorCountOf(carStructure, equipment.carNumber);
    if (doorCount === undefined) {
      issues.push({ index, field: 'carNumber', message: `${equipment.carNumber}号車は車両構成にありません` });
    } else if (equipment.nearDoor < 1 || equipment.nearDoor > doorCount) {
      issues.push({ index, field: 'nearDoor', message: `${equipment.carNumber}号車のドアは1〜${doorCount}番です` });
    }
  });
  return issues;
}
