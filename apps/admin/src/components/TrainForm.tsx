'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import type { CarStructure, FreeSpace, PrioritySeat } from '@furatora/database/schema';

type Operator = { id: string; name: string };
type Line = { id: string; name: string; nameEn: string; operatorId: string };
type PickerStation = { id: string; name: string };
type PickerPlatform = { id: string; platformNumber: number };

type TrainData = {
  id?: string;
  name: string;
  operatorId: string;
  lineIds: string[];
  carCount: number;
  carStructure: CarStructure[] | null;
  freeSpaces: FreeSpace[] | null;
  prioritySeats: PrioritySeat[] | null;
  limitedToPlatformIds: string[] | null;
};

type Props = {
  initialData?: TrainData;
  isEdit?: boolean;
};

export function TrainForm({ initialData, isEdit = false }: Props) {
  const router = useRouter();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [allLines, setAllLines] = useState<Line[]>([]);
  const [name, setName] = useState(initialData?.name ?? '');
  const [searchLinesText, setSearchLinesText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [operatorId, setOperatorId] = useState(initialData?.operatorId ?? '');
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>(initialData?.lineIds ?? []);
  const [carCount, setCarCount] = useState(initialData?.carCount ?? 10);

  const initCarStructures = (): { carNumber: number; doorCount: number }[] => {
    const cs = initialData?.carStructure;
    if (cs && cs.length > 0) return cs;
    const count = initialData?.carCount ?? 10;
    return Array.from({ length: count }, (_, i) => ({ carNumber: i + 1, doorCount: 4 }));
  };
  const [carStructures, setCarStructures] = useState(initCarStructures);

  const [freeSpaces, setFreeSpaces] = useState<FreeSpace[]>(initialData?.freeSpaces ?? []);
  const [prioritySeats, setPrioritySeats] = useState<PrioritySeat[]>(initialData?.prioritySeats ?? []);
  const [limitedToPlatformIds, setLimitedToPlatformIds] = useState<string[]>(initialData?.limitedToPlatformIds ?? []);
  const [platformLabels, setPlatformLabels] = useState<Record<string, string>>({});
  const [pickerLineId, setPickerLineId] = useState<string | null>(null);
  const [pickerStationId, setPickerStationId] = useState<string | null>(null);
  const [pickerPlatformId, setPickerPlatformId] = useState<string | null>(null);
  const [pickerStations, setPickerStations] = useState<PickerStation[]>([]);
  const [pickerPlatforms, setPickerPlatforms] = useState<PickerPlatform[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/operators').then((r) => r.json()).then(setOperators);
    fetch('/api/lines').then((r) => r.json()).then(setAllLines);
    const initialIds = initialData?.limitedToPlatformIds;
    if (initialIds && initialIds.length > 0) {
      fetch(`/api/platforms?ids=${initialIds.join(',')}`)
        .then(r => r.json() as Promise<{ id: string; platformNumber: number; stationName: string; lineName: string }[]>)
        .then(data => {
          const labels: Record<string, string> = {};
          for (const p of data) {
            labels[p.id] = `${p.lineName} > ${p.stationName} > ${p.platformNumber}番ホーム`;
          }
          setPlatformLabels(labels);
        });
    }
  }, []);

  const filteredLines = allLines.filter((l) =>
    l.name.toLowerCase().includes(searchLinesText.toLowerCase()) ||
    l.nameEn?.toLowerCase().includes(searchLinesText.toLowerCase())
  );

  const pickerAvailableLines = allLines.filter(l => selectedLineIds.includes(l.id));

  const dropdownRef=useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function toggleLine(lineId: string) {
    setSelectedLineIds((prev) =>
      prev.includes(lineId) ? prev.filter((id) => id !== lineId) : [...prev, lineId]
    );
  }

  function addFreeSpace() {
    setFreeSpaces((prev) => [...prev, { carNumber: 1, nearDoor: 1,  isStandard: true }]);
  }
  function removeFreeSpace(index: number) {
    setFreeSpaces((prev) => prev.filter((_, i) => i !== index));
  }
  function updateFreeSpace(index: number, field: keyof FreeSpace, value: number | boolean) {
    setFreeSpaces((prev) => prev.map((fs, i) => (i === index ? { ...fs, [field]: value } : fs)));
  }

  function addPrioritySeat() {
    setPrioritySeats((prev) => [...prev, { carNumber: 1, nearDoor: 1, isStandard: true }]);
  }
  function removePrioritySeat(index: number) {
    setPrioritySeats((prev) => prev.filter((_, i) => i !== index));
  }
  function updatePrioritySeat(index: number, field: keyof PrioritySeat, value: number | boolean) {
    setPrioritySeats((prev) => prev.map((ps, i) => (i === index ? { ...ps, [field]: value } : ps)));
  }

  function selectPickerLine(lineId: string) {
    setPickerLineId(lineId);
    setPickerStationId(null);
    setPickerPlatformId(null);
    setPickerStations([]);
    setPickerPlatforms([]);
    fetch(`/api/stations?lineId=${lineId}`)
      .then(r => r.json() as Promise<PickerStation[]>)
      .then(setPickerStations);
  }

  function selectPickerStation(stationId: string) {
    setPickerStationId(stationId);
    setPickerPlatformId(null);
    setPickerPlatforms([]);
    fetch(`/api/stations/${stationId}/platforms`)
      .then(r => r.json() as Promise<PickerPlatform[]>)
      .then(setPickerPlatforms);
  }

  function addPickerPlatform() {
    if (!pickerPlatformId || limitedToPlatformIds.includes(pickerPlatformId)) return;
    const platformId = pickerPlatformId;
    const line = allLines.find(l => l.id === pickerLineId);
    const station = pickerStations.find(s => s.id === pickerStationId);
    const platform = pickerPlatforms.find(p => p.id === platformId);
    const label = `${line?.name ?? ''} > ${station?.name ?? ''} > ${platform?.platformNumber ?? ''}番ホーム`;
    setLimitedToPlatformIds(prev => [...prev, platformId]);
    setPlatformLabels(prev => ({ ...prev, [platformId]: label }));
  }

  function removeLimitedPlatform(id: string) {
    setLimitedToPlatformIds(prev => prev.filter(p => p !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      name,
      operatorId,
      lineIds: selectedLineIds,
      carCount,
      carStructure: carStructures.length > 0 ? carStructures : null,
      freeSpaces: freeSpaces.length > 0 ? freeSpaces : null,
      prioritySeats: prioritySeats.length > 0 ? prioritySeats : null,
      limitedToPlatformIds: limitedToPlatformIds.length > 0 ? limitedToPlatformIds : null,
    };

    const url = isEdit ? `/api/trains/${initialData!.id}` : '/api/trains';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      router.push('/trains');
      router.refresh();
    } else {
      setSubmitting(false);
      alert('Failed to save');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full border rounded px-3 py-2"
        />
      </div>

      {/* Operator */}
      <div>
        <label className="block text-sm font-medium mb-1">Operator</label>
        <select
          value={operatorId}
          onChange={(e) => {
            setOperatorId(e.target.value);
            setSelectedLineIds([]);
          }}
          required
          className="w-full border rounded px-3 py-2"
        >
          <option value="">Select operator</option>
          {operators.map((op) => (
            <option key={op.id} value={op.id}>{op.name}</option>
          ))}
        </select>
      </div>

      {/* Lines (multi-select) */}
      <div className="relative">
        <label className="block text-sm font-medium mb-1">Lines</label>
        {/* Displayed selectedLines */}
        <div className="flex flex-wrap gap-2">
          {selectedLineIds.map(id => {
            const line = allLines.find(l => l.id === id);
            return (
              <span key={line?.id} className="bg-blue-100 px-2 py-1 rounded">
                {line?.name}
              </span>
            );
          })}
        </div>

        <input
          value={searchLinesText}
          onChange={(e) => setSearchLinesText(e.target.value)}
          onFocus={() => setIsOpen(true)}
          type="text"
          className="w-full border rounded px-2 py-2 text-sm"
        />
        {isOpen && (
          <div ref={dropdownRef} className="absolute z-10 max-h-60 overflow-auto bg-[var(--background)] shadow-lg w-full">
            {filteredLines.map(line => (
              <div onClick={() => toggleLine(line.id)} key={line.id}>
              <input 
                type="checkbox"
                checked={selectedLineIds.includes(line.id)} 
                onChange={(e) => e.stopPropagation()}
              />
              {line.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Car Count */}
      <div>
        <label className="block text-sm font-medium mb-1">Car Count</label>
        <input
          type="number"
          min={1}
          value={carCount}
          onChange={(e) => {
            const newCount = Number(e.target.value);
            setCarCount(newCount);
            setCarStructures((prev) =>
              Array.from({ length: newCount }, (_, i) => ({
                carNumber: i + 1,
                doorCount: prev[i]?.doorCount ?? 4,
              }))
            );
          }}
          required
          className="w-32 border rounded px-3 py-2"
        />
      </div>

      {/* Car Structure */}
      <div>
        <label className="block text-sm font-medium mb-2">Car Structure (号車ごとのドア数)</label>
        <div className="space-y-1">
          {carStructures.map((cs, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-sm text-gray-500 w-14 text-right">{cs.carNumber}号車</span>
              <input
                type="number"
                min={1}
                max={10}
                value={cs.doorCount}
                onChange={(e) =>
                  setCarStructures((prev) =>
                    prev.map((c, j) => j === i ? { ...c, doorCount: Number(e.target.value) } : c)
                  )
                }
                className="w-20 border rounded px-2 py-1 text-sm"
              />
              <span className="text-sm text-gray-500">枚</span>
            </div>
          ))}
        </div>
      </div>

      {/* Free Spaces */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium">Free Spaces</label>
          <button type="button" onClick={addFreeSpace} className="text-sm text-blue-600 hover:underline">+ Add</button>
        </div>
        {freeSpaces.map((fs, i) => (
          <div key={i} className="flex items-center gap-2 mb-1">
            <span className="text-sm text-gray-500 w-16">Car #</span>
            <input
              type="number" min={1} max={carCount} value={fs.carNumber}
              onChange={(e) => updateFreeSpace(i, 'carNumber', Number(e.target.value))}
              className="w-20 border rounded px-2 py-1 text-sm"
            />
            <span className="text-sm text-gray-500 w-16">Door #</span>
            <input
              type="number" min={1} value={fs.nearDoor}
              onChange={(e) => updateFreeSpace(i, 'nearDoor', Number(e.target.value))}
              className="w-20 border rounded px-2 py-1 text-sm"
            />
            <span className="text-sm text-gray-500 w-16">isStandard</span>
            <input
              type="checkbox"
              checked={fs.isStandard}
              onChange={(e) => updateFreeSpace(i, 'isStandard', e.target.checked)}
            />
            <button type="button" onClick={() => removeFreeSpace(i)} className="ml-auto mr-2 text-red-500 text-sm">Remove</button>
          </div>
        ))}
      </div>

      {/* Priority Seats */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium">Priority Seats</label>
          <button type="button" onClick={addPrioritySeat} className="text-sm text-blue-600 hover:underline">+ Add</button>
        </div>
        {prioritySeats.map((ps, i) => (
          <div key={i} className="flex items-center gap-2 mb-1">
            <span className="text-sm text-gray-500 w-16">Car #</span>
            <input
              type="number" min={1} max={carCount} value={ps.carNumber}
              onChange={(e) => updatePrioritySeat(i, 'carNumber', Number(e.target.value))}
              className="w-20 border rounded px-2 py-1 text-sm"
            />
            <span className="text-sm text-gray-500 w-16">Door #</span>
            <input
              type="number" min={1} value={ps.nearDoor}
              onChange={(e) => updatePrioritySeat(i, 'nearDoor', Number(e.target.value))}
              className="w-20 border rounded px-2 py-1 text-sm"
            />
            <span className="text-sm text-gray-500 w-16">isStandard</span>
            <input
              type="checkbox"
              checked={ps.isStandard}
              onChange={(e) => updatePrioritySeat(i, 'isStandard', e.target.checked)}
            />
            <button type="button" onClick={() => removePrioritySeat(i)} className="ml-auto mr-2 text-red-500 text-sm">Remove</button>
          </div>
        ))}
      </div>

      {/* Limited To Platform IDs */}
      <div>
        <label className="block text-sm font-medium mb-2">
          走行制限ホーム
          <span className="ml-1 text-xs text-gray-500 font-normal">(区間限定運用のみ。制限なしの場合は空欄)</span>
        </label>

        {/* Column picker */}
        {pickerAvailableLines.length > 0 ? (
          <>
            <div className="flex border rounded text-sm mb-2 divide-x h-48">
              {/* Column 1: Lines */}
              <div className="w-1/3 overflow-y-auto">
                {pickerAvailableLines.map(line => (
                  <button
                    key={line.id}
                    type="button"
                    onClick={() => selectPickerLine(line.id)}
                    className={`w-full text-left px-3 py-1.5 hover:bg-gray-100 ${pickerLineId === line.id ? 'bg-blue-100 text-blue-700 font-medium' : ''}`}
                  >
                    {line.name}
                  </button>
                ))}
              </div>

              {/* Column 2: Stations */}
              <div className="w-1/3 overflow-y-auto">
                {pickerStations.map(station => (
                  <button
                    key={station.id}
                    type="button"
                    onClick={() => selectPickerStation(station.id)}
                    className={`w-full text-left px-3 py-1.5 hover:bg-gray-100 ${pickerStationId === station.id ? 'bg-blue-100 text-blue-700 font-medium' : ''}`}
                  >
                    {station.name}
                  </button>
                ))}
              </div>

              {/* Column 3: Platforms */}
              <div className="w-1/3 overflow-y-auto">
                {pickerPlatforms.map(platform => (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => setPickerPlatformId(platform.id)}
                    className={`w-full text-left px-3 py-1.5 hover:bg-gray-100 ${pickerPlatformId === platform.id ? 'bg-blue-100 text-blue-700 font-medium' : ''}`}
                  >
                    {platform.platformNumber}番ホーム
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={addPickerPlatform}
              disabled={!pickerPlatformId || limitedToPlatformIds.includes(pickerPlatformId)}
              className="mb-3 px-3 py-1.5 text-sm bg-blue-600 text-white rounded disabled:opacity-40 hover:bg-blue-700"
            >
              追加
            </button>
          </>
        ) : (
          <p className="text-sm text-gray-400 mb-3">路線を選択してからホームを追加してください</p>
        )}

        {/* Added platforms list */}
        {limitedToPlatformIds.length === 0 ? (
          <p className="text-sm text-gray-400">走行制限なし</p>
        ) : (
          <ul className="space-y-1">
            {limitedToPlatformIds.map(id => (
              <li key={id} className="flex items-center justify-between text-sm bg-gray-50 border rounded px-3 py-1.5">
                <span>{platformLabels[id] ?? id}</span>
                <button
                  type="button"
                  onClick={() => removeLimitedPlatform(id)}
                  className="text-red-500 hover:text-red-700 text-xs ml-4 flex-shrink-0"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Submit */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Saving...' : isEdit ? 'Update' : 'Create'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/trains')}
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
