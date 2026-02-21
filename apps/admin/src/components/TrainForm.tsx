'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import type { CarStructure, FreeSpace, PrioritySeat } from '@railease-navi/database/schema';

type Operator = { id: string; name: string };
type Line = { id: string; name: string; nameEn: string ; operatorId: string };

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
  const [limitedToPlatformIdsText, setLimitedToPlatformIdsText] = useState(
    initialData?.limitedToPlatformIds ? JSON.stringify(initialData.limitedToPlatformIds, null, 2) : ''
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/operators').then((r) => r.json()).then(setOperators);
    fetch('/api/lines').then((r) => r.json()).then(setAllLines);
  }, []);

  const filteredLines = allLines.filter((l) => 
    l.name.toLowerCase().includes(searchLinesText.toLowerCase()) ||
    l.nameEn?.toLowerCase().includes(searchLinesText.toLowerCase())
  ); 

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    let limitedToPlatformIds: string[] | null = null;
    if (limitedToPlatformIdsText.trim()) {
      try {
        limitedToPlatformIds = JSON.parse(limitedToPlatformIdsText);
      } catch {
        alert('走行制限ホームIDのJSON形式が不正です');
        setSubmitting(false);
        return;
      }
    }

    const payload = {
      name,
      operatorId,
      lineIds: selectedLineIds,
      carCount,
      carStructure: carStructures.length > 0 ? carStructures : null,
      freeSpaces: freeSpaces.length > 0 ? freeSpaces : null,
      prioritySeats: prioritySeats.length > 0 ? prioritySeats : null,
      limitedToPlatformIds,
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
        <label className="block text-sm font-medium mb-1">
          走行制限ホームID
          <span className="ml-1 text-xs text-gray-500 font-normal">(JSON配列。区間限定運用のみ。制限なしの場合は空欄)</span>
        </label>
        <textarea
          value={limitedToPlatformIdsText}
          onChange={(e) => setLimitedToPlatformIdsText(e.target.value)}
          placeholder={'["platform-uuid-1", "platform-uuid-2"]'}
          rows={3}
          className="w-full border rounded px-3 py-2 font-mono text-sm"
        />
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
