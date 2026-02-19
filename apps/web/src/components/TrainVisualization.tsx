import type { CarStopPosition, FreeSpace, PrioritySeat } from '@stroller-transit-app/database/schema';

type Train = {
  id: string;
  name: string;
  carCount: number;
  freeSpaces: FreeSpace[] | null;
  prioritySeats: PrioritySeat[] | null;
};

type FacilityConnection = {
  stationName: string;
  lineNames: string[];
  exitLabel: string | null;
};

type Facility = {
  id: string;
  typeCode: string;
  typeName: string;
  nearPlatformCell: number | null;
  exits: string | null;
  isWheelchairAccessible: boolean | null;
  isStrollerAccessible: boolean | null;
  connections: FacilityConnection[];
};

type Props = {
  train: Train;
  platformMaxCarCount: number;
  carStopPositions: CarStopPosition[] | null;
  facilities: Facility[];
  platformSide: 'top' | 'bottom' | null;
};

const FACILITY_ICONS: Record<string, string> = {
  elevator: '/icons/elevator.png',
  escalator: '/icons/escalator.png',
  stairs: '/icons/stairs.png',
  ramp: '/icons/wheelchair_ramp.png',
  stairLift: '/icons/stair_lift.png',
  sameFloor: '/icons/wheelchair.png',
};

export function TrainVisualization({
  train,
  platformMaxCarCount,
  carStopPositions,
  facilities,
  platformSide,
}: Props) {
  // この列車の編成に対応する停車位置情報を取得
  const stopPosition = carStopPositions?.find(
    (pos) => pos.carCount === train.carCount
  );

  // 列車の各車両の位置を計算（platformMaxCarCount基準）
  // carPositions[i] = 号車番号(i+1)が停車するホーム枠番号
  const carPositions = Array.from({ length: train.carCount }, (_, i) => {
    if (!stopPosition) {
      return i + 1;
    }
    const { referenceCarNumber, referencePlatformCell, direction } = stopPosition;
    const carNumber = i + 1;
    if (direction === 'ascending') {
      return referencePlatformCell + (carNumber - referenceCarNumber);
    } else {
      return referencePlatformCell - (carNumber - referenceCarNumber);
    }
  });

  // フリースペースの位置をセット化（標準装備のみ）
  const freeSpacePositions = new Set(
    train.freeSpaces?.filter((fs) => fs.isStandard).map((fs) => fs.carNumber) || []
  );

  // 優先席の位置をセット化
  const prioritySeatPositions = new Set(
    train.prioritySeats?.map((ps) => ps.carNumber) || []
  );

  // ホーム全体の長さ（maxCarCount基準）
  const platformCells = Array.from({ length: platformMaxCarCount }, (_, i) => i + 1);

  // ホーム枠番号 → 設備リスト のマップを構築
  // nearPlatformCell はホーム枠番号を直接指定する
  const facilitiesByCell: Record<number, Facility[]> = {};
  for (const facility of facilities) {
    if (facility.nearPlatformCell !== null) {
      const cell = facility.nearPlatformCell;
      if (cell >= 1 && cell <= platformMaxCarCount) {
        if (!facilitiesByCell[cell]) facilitiesByCell[cell] = [];
        facilitiesByCell[cell].push(facility);
      }
    }
  }

  // 占有セルを昇順に並べた配列（左→右の視覚順）
  const occupiedCells = [...carPositions].sort((a, b) => a - b);

  const direction = stopPosition?.direction ?? 'ascending';
  const effectivePlatformSide = platformSide ?? 'bottom';

  // 先頭車両(1号車)のclip-path（横レイアウト）: ascending=左向き台形, descending=右向き台形
  const leadingCarClipPath =
    direction === 'ascending'
      ? 'polygon(15% 0%, 100% 0%, 100% 100%, 15% 100%, 0% 50%)'
      : 'polygon(0% 0%, 85% 0%, 100% 50%, 85% 100%, 0% 100%)';

  // 先頭車両(1号車)のclip-path（縦レイアウト）: ascending=上向き, descending=下向き
  const verticalLeadingCarClipPath =
    direction === 'ascending'
      ? 'polygon(0% 20%, 50% 0%, 100% 20%, 100% 100%, 0% 100%)'
      : 'polygon(0% 0%, 100% 0%, 100% 80%, 50% 100%, 0% 80%)';

  // 設備テキストラベル行（exits + 乗換路線名）
  // flex-1 でセル幅に合わせて配置し、アイコン帯の上または下に表示する
  const facilityLabelRow = (
    <div className="flex gap-1 py-0.5">
      {platformCells.map((cellNumber) => {
        const cellFacilities = facilitiesByCell[cellNumber] ?? [];
        const labels: string[] = [];
        for (const f of cellFacilities) {
          if (f.exits) labels.push(f.exits);
          for (const conn of f.connections) {
            if (conn.lineNames.length > 0) labels.push(conn.lineNames.join('・'));
          }
        }
        return (
          <div
            key={cellNumber}
            className="flex-1 flex flex-col items-center gap-px text-[9px] leading-tight text-gray-500"
          >
            {labels.map((label, i) => (
              <span key={i} className="text-center break-all">{label}</span>
            ))}
          </div>
        );
      })}
    </div>
  );

  // ホームの帯（設備アイコン付き）
  // セル区切りは表示せず、1本の帯としてレンダリング。
  // 設備アイコンはセル中央 ((cellNumber - 0.5) / platformMaxCarCount * 100%) に絶対配置。
  const platformStrip = (
    <div className="relative h-15 bg-stone-200">
      {platformCells.map((cellNumber) => {
        const cellFacilities = facilitiesByCell[cellNumber] ?? [];
        if (cellFacilities.length === 0) return null;
        const leftPercent = ((cellNumber - 0.5) / platformMaxCarCount) * 100;
        return (
          <div
            key={cellNumber}
            className="absolute top-0 bottom-0 flex items-center gap-0.5 -translate-x-1/2"
            style={{ left: `${leftPercent}%` }}
          >
            {cellFacilities.map((f, idx) =>
              FACILITY_ICONS[f.typeCode] ? (
                <img
                  key={idx}
                  src={FACILITY_ICONS[f.typeCode]}
                  alt={f.typeName}
                  title={f.exits || f.typeName}
                  className="w-6 h-6"
                />
              ) : (
                <span
                  key={idx}
                  title={f.exits || f.typeName}
                  className="text-sm leading-none"
                >
                  📍
                </span>
              )
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
      {/* 列車名 */}
      <div className="mb-3">
        <h5 className="font-semibold text-gray-900 text-sm">{train.name}</h5>
        <p className="text-xs text-gray-500">{train.carCount}両編成</p>
      </div>

      {/* ホーム + 列車の可視化 */}
      <div className="mb-2">
        {/* 縦レイアウト（モバイル: md未満）
            platformSide top → ホーム帯が左、ラベルが右
            platformSide bottom → ホーム帯が右、ラベルが左 */}
        <div className="md:hidden flex flex-col gap-0.5">
          {platformCells.map((cellNumber) => {
            const isTrainCar = carPositions.includes(cellNumber);
            const displayCarNumber = isTrainCar ? occupiedCells.indexOf(cellNumber) + 1 : null;
            const physicalCarNumber = isTrainCar ? carPositions.indexOf(cellNumber) + 1 : null;
            const hasFreeSpace = physicalCarNumber ? freeSpacePositions.has(physicalCarNumber) : false;
            const hasPrioritySeat = physicalCarNumber ? prioritySeatPositions.has(physicalCarNumber) : false;
            const isLeadingCar = isTrainCar && cellNumber === carPositions[0];
            const bgColor = isTrainCar
              ? hasFreeSpace ? '#bfdbfe' : hasPrioritySeat ? '#fde68a' : '#d1d5db'
              : '#f9fafb';
            const cellFacilities = facilitiesByCell[cellNumber] ?? [];
            const labels: string[] = [];
            for (const f of cellFacilities) {
              if (f.exits) labels.push(f.exits);
              for (const conn of f.connections) {
                if (conn.lineNames.length > 0) labels.push(conn.lineNames.join('・'));
              }
            }

            // 縦レイアウト: 横1:縦3 = w-12(48px) × h-36(144px)
            const carCell = (
              <div
                className="w-12 flex-shrink-0 h-36 border border-gray-300 flex items-center justify-center font-mono"
                style={{
                  backgroundColor: bgColor,
                  clipPath: isLeadingCar ? verticalLeadingCarClipPath : undefined,
                  borderRadius: isLeadingCar ? 0 : undefined,
                }}
              >
                {isTrainCar && displayCarNumber && (
                  <div className="text-center">
                    <div className="font-bold text-base">{displayCarNumber}</div>
                    {hasFreeSpace && <div className="text-xs text-blue-700">🚼</div>}
                    {!hasFreeSpace && hasPrioritySeat && <div className="text-xs text-amber-700">🪑</div>}
                  </div>
                )}
              </div>
            );

            // ホーム帯: 横幅を2倍（w-16 = 64px）
            const stripCell = (
              <div className="w-16 flex-shrink-0 h-36 bg-stone-200 flex flex-col items-center justify-center gap-1">
                {cellFacilities.map((f, idx) =>
                  FACILITY_ICONS[f.typeCode] ? (
                    <img key={idx} src={FACILITY_ICONS[f.typeCode]} alt={f.typeName} title={f.exits || f.typeName} className="w-7 h-7" />
                  ) : (
                    <span key={idx} className="text-base leading-none">📍</span>
                  )
                )}
              </div>
            );

            // ラベル: flex-1で残り幅を使いきり、余白・折り返しつきで多く表示
            const labelCell = (
              <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5 text-xs leading-snug text-gray-600 px-2 py-1">
                {labels.map((label, i) => (
                  <span key={i} className="break-words">{label}</span>
                ))}
              </div>
            );

            return (
              <div key={cellNumber} className="flex items-stretch gap-0.5">
                {effectivePlatformSide === 'top' ? (
                  <>{labelCell}{stripCell}{carCell}</>
                ) : (
                  <>{carCell}{stripCell}{labelCell}</>
                )}
              </div>
            );
          })}
        </div>

        {/* 横レイアウト（デスクトップ: md以上） */}
        <div className="hidden md:block">
          {effectivePlatformSide === 'top' && (
            <>
              {facilityLabelRow}
              {platformStrip}
            </>
          )}

          <div className="flex items-center gap-1 my-1">
            {platformCells.map((cellNumber) => {
              const isTrainCar = carPositions.includes(cellNumber);
              const displayCarNumber = isTrainCar ? occupiedCells.indexOf(cellNumber) + 1 : null;
              const physicalCarNumber = isTrainCar ? carPositions.indexOf(cellNumber) + 1 : null;
              const hasFreeSpace = physicalCarNumber ? freeSpacePositions.has(physicalCarNumber) : false;
              const hasPrioritySeat = physicalCarNumber ? prioritySeatPositions.has(physicalCarNumber) : false;
              const isLeadingCar = isTrainCar && cellNumber === carPositions[0];
              const bgColor = isTrainCar
                ? hasFreeSpace ? '#bfdbfe' : hasPrioritySeat ? '#fde68a' : '#d1d5db'
                : '#f9fafb';

              return (
                <div
                  key={cellNumber}
                  className="relative flex-1 h-12 border border-gray-300 flex items-center justify-center text-xs font-mono"
                  style={{
                    backgroundColor: bgColor,
                    clipPath: isLeadingCar && isTrainCar ? leadingCarClipPath : undefined,
                    borderRadius: isLeadingCar && isTrainCar ? 0 : undefined,
                  }}
                >
                  {isTrainCar && displayCarNumber && (
                    <div className="text-center">
                      <div className="font-bold">{displayCarNumber}</div>
                      {hasFreeSpace && <div className="text-[10px] text-blue-700">🚼</div>}
                      {!hasFreeSpace && hasPrioritySeat && <div className="text-[10px] text-amber-700">🪑</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {effectivePlatformSide === 'bottom' && (
            <>
              {platformStrip}
              {facilityLabelRow}
            </>
          )}
        </div>
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200">
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 bg-blue-200 rounded" />
          <span>フリースペース</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 bg-amber-200 rounded" />
          <span>優先席</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 bg-stone-300" />
          <span>ホーム</span>
        </div>
      </div>

      {/* フリースペース詳細 */}
      {train.freeSpaces && train.freeSpaces.length > 0 && (
        <div className="mt-3 p-2.5 bg-blue-50 border border-blue-100 rounded-lg text-xs">
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

      {/* 優先席詳細 */}
      {train.prioritySeats && train.prioritySeats.length > 0 && (
        <div className="mt-2 p-2.5 bg-amber-50 border border-amber-100 rounded-lg text-xs">
          <strong className="text-amber-900">優先席:</strong>
          <ul className="mt-1 space-y-0.5">
            {train.prioritySeats.map((ps, idx) => (
              <li key={idx} className="text-amber-800">
                {ps.carNumber}号車 {ps.nearDoor}番ドア付近
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
