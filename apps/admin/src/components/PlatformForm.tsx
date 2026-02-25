'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import type { CarStopPosition } from '@furatora/database/schema';

type Line = { id: string; name: string };
type LineDirection = {
  id: string;
  directionType: string;
  displayName: string;
  representativeStationId: string;
};

type PlatformData = {
  id?: string;
  platformNumber: string;
  lineId: string;
  inboundDirectionId: string | null;
  outboundDirectionId: string | null;
  maxCarCount: number;
  carStopPositions: CarStopPosition[] | null;
  platformSide: string | null;
  notes: string;
};

type Props = {
  stationId: string;
  initialData?: PlatformData;
  isEdit?: boolean;
};

export function PlatformForm({ stationId, initialData, isEdit = false }: Props) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [directions, setDirections] = useState<LineDirection[]>([]);
  const [platformNumber, setPlatformNumber] = useState(initialData?.platformNumber ?? '');
  const [lineId, setLineId] = useState(initialData?.lineId ?? '');
  const [inboundDirectionId, setInboundDirectionId] = useState<string>(
    initialData?.inboundDirectionId ?? ''
  );
  const [outboundDirectionId, setOutboundDirectionId] = useState<string>(
    initialData?.outboundDirectionId ?? ''
  );
  const [maxCarCount, setMaxCarCount] = useState(initialData?.maxCarCount ?? 10);
  const [carStopPositions, setCarStopPositions] = useState<CarStopPosition[]>(
    initialData?.carStopPositions ?? []
  );
  const [platformSide, setPlatformSide] = useState<string>(
    initialData?.platformSide ?? ''
  );
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/lines')
      .then((r) => r.json())
      .then(setLines);
  }, []);

  useEffect(() => {
    if (lineId) {
      fetch(`/api/lines/${lineId}/directions`)
        .then((r) => r.json())
        .then(setDirections);
    } else {
      Promise.resolve([]).then(setDirections);
    }
  }, [lineId]);

  function addStopPosition() {
    setCarStopPositions((prev) => [
      ...prev,
      { carCount: 8, referenceCarNumber: 1, referencePlatformCell: 1, direction: 'ascending' as const },
    ]);
  }
  function removeStopPosition(index: number) {
    setCarStopPositions((prev) => prev.filter((_, i) => i !== index));
  }
  function updateStopPositionNumber(index: number, field: 'carCount' | 'referenceCarNumber' | 'referencePlatformCell', value: number) {
    setCarStopPositions((prev) =>
      prev.map((sp, i) => (i === index ? { ...sp, [field]: value } : sp))
    );
  }
  function updateStopPositionDirection(index: number, value: 'ascending' | 'descending') {
    setCarStopPositions((prev) =>
      prev.map((sp, i) => (i === index ? { ...sp, direction: value } : sp))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      platformNumber,
      lineId,
      inboundDirectionId: inboundDirectionId || null,
      outboundDirectionId: outboundDirectionId || null,
      maxCarCount,
      carStopPositions: carStopPositions.length > 0 ? carStopPositions : null,
      platformSide: platformSide || null,
      notes: notes || null,
    };

    const url = isEdit
      ? `/api/stations/${stationId}/platforms/${initialData!.id}`
      : `/api/stations/${stationId}/platforms`;
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      router.push(`/stations/${stationId}/facilities`);
      router.refresh();
    } else {
      setSubmitting(false);
      alert('Failed to save');
    }
  }

  const inboundDirections = directions.filter((d) => d.directionType === 'inbound');
  const outboundDirections = directions.filter((d) => d.directionType === 'outbound');

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {/* Platform Number */}
      <div>
        <label className="block text-sm font-medium mb-1">Platform Number</label>
        <input
          type="text"
          value={platformNumber}
          onChange={(e) => setPlatformNumber(e.target.value)}
          required
          placeholder="e.g. 1, 2a"
          className="w-32 border rounded px-3 py-2"
        />
      </div>

      {/* Line */}
      <div>
        <label className="block text-sm font-medium mb-1">Line</label>
        <select
          value={lineId}
          onChange={(e) => {
            setLineId(e.target.value);
            setInboundDirectionId('');
            setOutboundDirectionId('');
          }}
          required
          className="w-full border rounded px-3 py-2"
        >
          <option value="">Select line</option>
          {lines.map((line) => (
            <option key={line.id} value={line.id}>
              {line.name}
            </option>
          ))}
        </select>
      </div>

      {/* Inbound Direction */}
      {lineId && (
        <div>
          <label className="block text-sm font-medium mb-1">
            Inbound Direction (上り方面) - Optional
          </label>
          <select
            value={inboundDirectionId}
            onChange={(e) => setInboundDirectionId(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">None</option>
            {inboundDirections.map((dir) => (
              <option key={dir.id} value={dir.id}>
                {dir.displayName}
              </option>
            ))}
          </select>
          {inboundDirections.length === 0 && lineId && (
            <p className="text-xs text-gray-500 mt-1">
              No inbound directions defined for this line. Please create one first.
            </p>
          )}
        </div>
      )}

      {/* Outbound Direction */}
      {lineId && (
        <div>
          <label className="block text-sm font-medium mb-1">
            Outbound Direction (下り方面) - Optional
          </label>
          <select
            value={outboundDirectionId}
            onChange={(e) => setOutboundDirectionId(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">None</option>
            {outboundDirections.map((dir) => (
              <option key={dir.id} value={dir.id}>
                {dir.displayName}
              </option>
            ))}
          </select>
          {outboundDirections.length === 0 && lineId && (
            <p className="text-xs text-gray-500 mt-1">
              No outbound directions defined for this line. Please create one first.
            </p>
          )}
        </div>
      )}

      {/* Max Car Count */}
      <div>
        <label className="block text-sm font-medium mb-1">Maximum Car Count</label>
        <input
          type="number"
          min={1}
          value={maxCarCount}
          onChange={(e) => setMaxCarCount(Number(e.target.value))}
          required
          className="w-32 border rounded px-3 py-2"
        />
      </div>

      {/* Car Stop Positions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Car Stop Positions</label>
          <button
            type="button"
            onClick={addStopPosition}
            className="text-sm text-blue-600 hover:underline"
          >
            + Add Position
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-2">
          編成両数ごとに停車位置を定義します。基準号車とその停車枠番号、進行方向を指定してください。
        </p>
        {carStopPositions.map((sp, i) => (
          <div key={i} className="border rounded p-3 mb-2 bg-gray-50">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">編成両数:</span>
                <input
                  type="number"
                  min={1}
                  max={maxCarCount}
                  value={sp.carCount}
                  onChange={(e) => updateStopPositionNumber(i, 'carCount', Number(e.target.value))}
                  className="w-16 border rounded px-2 py-1 text-sm"
                />
                <span className="text-xs text-gray-400">両</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">基準号車:</span>
                <input
                  type="number"
                  min={1}
                  max={sp.carCount}
                  value={sp.referenceCarNumber}
                  onChange={(e) => updateStopPositionNumber(i, 'referenceCarNumber', Number(e.target.value))}
                  className="w-16 border rounded px-2 py-1 text-sm"
                />
                <span className="text-xs text-gray-400">号車</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">停車枠:</span>
                <input
                  type="number"
                  min={1}
                  max={maxCarCount}
                  value={sp.referencePlatformCell}
                  onChange={(e) => updateStopPositionNumber(i, 'referencePlatformCell', Number(e.target.value))}
                  className="w-16 border rounded px-2 py-1 text-sm"
                />
                <span className="text-xs text-gray-400">番</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">進行方向:</span>
                <select
                  value={sp.direction}
                  onChange={(e) => updateStopPositionDirection(i, e.target.value as 'ascending' | 'descending')}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="ascending">ascending (1号車→小枠番号側)</option>
                  <option value="descending">descending (1号車→大枠番号側)</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => removeStopPosition(i)}
                className="text-red-500 text-sm ml-auto"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Platform Side */}
      <div>
        <label className="block text-sm font-medium mb-1">ホーム位置 (Platform Side)</label>
        <select
          value={platformSide}
          onChange={(e) => setPlatformSide(e.target.value)}
          className="w-48 border rounded px-3 py-2"
        >
          <option value="">未設定（デフォルト: 下）</option>
          <option value="bottom">bottom（列車の下側）</option>
          <option value="top">top（列車の上側）</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          可視化で列車図の上下どちらにホーム帯を表示するか
        </p>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full border rounded px-3 py-2"
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
          onClick={() => router.push(`/stations/${stationId}/facilities`)}
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
