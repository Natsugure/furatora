import type { CarStopPosition, FreeSpace } from '@stroller-transit-app/database/schema';

type Train = {
  id: string;
  name: string;
  carCount: number;
  freeSpaces: FreeSpace[] | null;
};

type Props = {
  train: Train;
  platformMaxCarCount: number;
  carStopPositions: CarStopPosition[] | null;
};

export function TrainVisualization({
  train,
  platformMaxCarCount,
  carStopPositions,
}: Props) {
  // この列車の編成に対応する停車位置情報を取得
  const stopPosition = carStopPositions?.find(
    (pos) => pos.carCount === train.carCount
  );

  // 停車位置が定義されていない場合は、先頭に揃える
  const frontCarPosition = stopPosition?.frontCarPosition ?? 1;

  // 列車の各車両の位置を計算（platformMaxCarCount基準）
  const carPositions = Array.from({ length: train.carCount }, (_, i) => {
    return frontCarPosition + i;
  });

  // フリースペースの位置をマップ化（標準装備のみ表示）
  const freeSpacePositions = new Set(
    train.freeSpaces
      ?.filter((fs) => fs.isStandard)
      .map((fs) => fs.carNumber) || []
  );

  // ホーム全体の長さ（maxCarCount基準）
  const platformCells = Array.from(
    { length: platformMaxCarCount },
    (_, i) => i + 1
  );

  return (
    <div className="border border-gray-300 rounded p-4 bg-gray-50">
      {/* Train name */}
      <div className="mb-3">
        <h5 className="font-semibold text-gray-800">{train.name}</h5>
        <p className="text-xs text-gray-600">
          {train.carCount}両編成
          {stopPosition &&
            ` (${frontCarPosition}号車位置〜${frontCarPosition + train.carCount - 1}号車位置に停車)`}
        </p>
      </div>

      {/* Platform visualization */}
      <div className="mb-2">
        <div className="flex items-center gap-1 mb-1">
          {platformCells.map((cellNumber) => {
            const isTrainCar = carPositions.includes(cellNumber);
            const trainCarNumber = isTrainCar
              ? carPositions.indexOf(cellNumber) + 1
              : null;
            const hasFreeSpace = trainCarNumber
              ? freeSpacePositions.has(trainCarNumber)
              : false;

            return (
              <div
                key={cellNumber}
                className="relative flex-1 h-12 border border-gray-300 rounded flex items-center justify-center text-xs font-mono"
                style={{
                  backgroundColor: isTrainCar
                    ? hasFreeSpace
                      ? '#bfdbfe' // blue-200
                      : '#d1d5db' // gray-300
                    : '#f9fafb', // gray-50
                }}
              >
                {isTrainCar && trainCarNumber && (
                  <div className="text-center">
                    <div className="font-bold">{trainCarNumber}</div>
                    {hasFreeSpace && (
                      <div className="text-[10px] text-blue-700">🚼</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Platform position labels */}
        <div className="flex items-center gap-1 text-[10px] text-gray-500">
          {platformCells.map((cellNumber) => (
            <div key={cellNumber} className="flex-1 text-center">
              {cellNumber}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-600 mt-3">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-gray-300 border border-gray-300 rounded" />
          <span>列車</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-blue-200 border border-gray-300 rounded" />
          <span>フリースペース</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-gray-50 border border-gray-300 rounded" />
          <span>空きスペース</span>
        </div>
      </div>

      {/* Free space details */}
      {train.freeSpaces && train.freeSpaces.length > 0 && (
        <div className="mt-3 p-2 bg-blue-50 rounded text-xs">
          <strong className="text-blue-900">フリースペース詳細:</strong>
          <ul className="mt-1 space-y-0.5">
            {train.freeSpaces.map((fs, idx) => (
              <li key={idx} className="text-blue-800">
                {fs.carNumber}号車 {fs.nearDoor}番ドア付近
                {fs.isStandard ? ' (全編成装備)' : ' (一部編成のみ)'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
