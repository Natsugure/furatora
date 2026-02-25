'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

type Platform = {
  id: string;
  platformNumber: string;
};

type FacilityType = {
  code: string;
  name: string;
};

type ConnectedStation = {
  id: string;
  name: string;
  code: string | null;
  lineId: string;
  lineName: string;
}

type Connection = {
  stationId: string;
  exitLabel: string;
};

type FacilitySelection = {
  typeCode: string;
  isWheelchairAccessible: boolean;
  isStrollerAccessible: boolean;
  notes: string;
};

type LocationData = {
  id?: string;
  platformId: string;
  nearPlatformCell: number | null;
  exits: string;
  notes: string;
  facilities: FacilitySelection[];
  connections?: Connection[];
};

type Props = {
  stationId: string;
  initialData?: LocationData;
  isEdit?: boolean;
};

export function FacilityForm({ stationId, initialData, isEdit = false }: Props) {
  const router = useRouter();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [facilityTypes, setFacilityTypes] = useState<FacilityType[]>([]);
  const [connectedStations, setConnectedStations] = useState<ConnectedStation[]>([]);

  const [platformId, setPlatformId] = useState(initialData?.platformId ?? '');
  const [nearPlatformCell, setNearPlatformCell] = useState<number | ''>(initialData?.nearPlatformCell ?? '');
  const [exits, setExits] = useState(initialData?.exits ?? '');
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [selectedFacilities, setSelectedFacilities] = useState<FacilitySelection[]>(
    initialData?.facilities ?? []
  );
  const [connections, setConnections] = useState<Connection[]>(initialData?.connections ?? []);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/stations/${stationId}/platforms`).then((r) => r.json()),
      fetch('/api/facility-types').then((r) => r.json()),
      fetch(`/api/stations?connectedFrom=${stationId}`).then((r) => r.json()),
    ]).then(([platformsData, typesData, stationsData]) => {
      setPlatforms(platformsData);
      setFacilityTypes(typesData);
      setConnectedStations(stationsData);
    });
  }, [stationId]);

  function toggleFacilityType(typeCode: string) {
    setSelectedFacilities((prev) => {
      const exists = prev.find((f) => f.typeCode === typeCode);
      if (exists) {
        return prev.filter((f) => f.typeCode !== typeCode);
      }
      return [...prev, { typeCode, isWheelchairAccessible: true, isStrollerAccessible: true, notes: '' }];
    });
  }

  function updateFacility(typeCode: string, field: keyof Omit<FacilitySelection, 'typeCode'>, value: boolean | string) {
    setSelectedFacilities((prev) =>
      prev.map((f) => (f.typeCode === typeCode ? { ...f, [field]: value } : f))
    );
  }

  function addConnection() {
    setConnections((prev) => [...prev, { stationId: '', exitLabel: '' }]);
  }
  function removeConnection(index: number) {
    setConnections((prev) => prev.filter((_, i) => i !== index));
  }
  function updateConnection(index: number, field: keyof Connection, value: string) {
    setConnections((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedFacilities.length === 0) {
      alert('設備タイプを1つ以上選択してください');
      return;
    }
    setSubmitting(true);

    const payload = {
      platformId,
      nearPlatformCell: nearPlatformCell === '' ? null : nearPlatformCell,
      exits: exits || null,
      notes: notes || null,
      facilities: selectedFacilities,
      connections: connections.filter((c) => c.stationId !== ''),
    };

    const url = isEdit
      ? `/api/stations/${stationId}/platform-locations/${initialData!.id}`
      : `/api/stations/${stationId}/platform-locations`;
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

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {/* Platform */}
      <div>
        <label className="block text-sm font-medium mb-1">Platform</label>
        <select
          value={platformId}
          onChange={(e) => setPlatformId(e.target.value)}
          required
          className="w-full border rounded px-3 py-2"
        >
          <option value="">Select platform</option>
          {platforms.map((p) => (
            <option key={p.id} value={p.id}>
              Platform {p.platformNumber}
            </option>
          ))}
        </select>
      </div>

      {/* Near Platform Cell */}
      <div>
        <label className="block text-sm font-medium mb-1">ホーム枠番号 (Near Platform Cell)</label>
        <input
          type="number"
          min={1}
          value={nearPlatformCell}
          onChange={(e) => setNearPlatformCell(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="e.g. 3"
          className="w-32 border rounded px-3 py-2"
        />
        <p className="text-xs text-gray-500 mt-1">設備が位置するホームの枠番号（1〜maxCarCount）。空欄でホーム全体。</p>
      </div>

      {/* Exits */}
      <div>
        <label className="block text-sm font-medium mb-1">出口 (Exits)</label>
        <input
          type="text"
          value={exits}
          onChange={(e) => setExits(e.target.value)}
          placeholder="例: A3出口・B1出口"
          className="w-full border rounded px-3 py-2"
        />
        <p className="text-xs text-gray-500 mt-1">この場所に繋がる出口を記載してください</p>
      </div>

      {/* Notes (location-level) */}
      <div>
        <label className="block text-sm font-medium mb-1">場所メモ (Location Notes)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full border rounded px-3 py-2"
        />
      </div>

      {/* Facility Types */}
      <div>
        <label className="block text-sm font-medium mb-2">設備タイプ (Facility Types)</label>
        <p className="text-xs text-gray-500 mb-3">この場所にある設備を選択してください（複数選択可）</p>
        <div className="space-y-3">
          {facilityTypes.map((ft) => {
            const selected = selectedFacilities.find((f) => f.typeCode === ft.code);
            return (
              <div key={ft.code} className="border rounded p-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!selected}
                    onChange={() => toggleFacilityType(ft.code)}
                  />
                  <span className="font-medium text-sm">{ft.name}</span>
                </label>
                {selected && (
                  <div className="mt-2 ml-6 space-y-2">
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={selected.isWheelchairAccessible}
                          onChange={(e) => updateFacility(ft.code, 'isWheelchairAccessible', e.target.checked)}
                        />
                        Wheelchair accessible
                      </label>
                      <label className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={selected.isStrollerAccessible}
                          onChange={(e) => updateFacility(ft.code, 'isStrollerAccessible', e.target.checked)}
                        />
                        Stroller accessible
                      </label>
                    </div>
                    <input
                      type="text"
                      value={selected.notes}
                      onChange={(e) => updateFacility(ft.code, 'notes', e.target.value)}
                      placeholder="設備メモ（任意）"
                      className="w-full border rounded px-2 py-1 text-sm"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {selectedFacilities.length === 0 && (
          <p className="text-sm text-red-500 mt-1">設備タイプを1つ以上選択してください</p>
        )}
      </div>

      {/* Connected Stations (乗換駅) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">乗換可能な駅 (Connected Stations)</label>
          <button
            type="button"
            onClick={addConnection}
            className="text-sm text-blue-600 hover:underline"
          >
            + 接続を追加
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-2">
          この場所を経由して乗り換え可能な駅と、対応する出口ラベルを指定してください
        </p>
        {connections.length === 0 && (
          <p className="text-sm text-gray-400 italic">接続なし</p>
        )}
        {connections.map((conn, i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <select
              value={conn.stationId}
              onChange={(e) => updateConnection(i, 'stationId', e.target.value)}
              className="flex-1 border rounded px-2 py-1.5 text-sm"
            >
              <option value="">駅を選択</option>
              {connectedStations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.lineName} ({s.name})
                </option>
              ))}
            </select>
            <input
              type="text"
              value={conn.exitLabel}
              onChange={(e) => updateConnection(i, 'exitLabel', e.target.value)}
              placeholder="出口ラベル (例: A3出口)"
              className="flex-1 border rounded px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => removeConnection(i)}
              className="text-red-500 text-sm px-1"
            >
              削除
            </button>
          </div>
        ))}
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
