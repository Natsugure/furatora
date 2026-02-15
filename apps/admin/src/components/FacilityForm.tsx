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

type Station = {
  id: string;
  name: string;
  nameEn: string | null;
  code: string | null;
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

type FacilityData = {
  id?: string;
  platformId: string;
  typeCode: string;
  nearPlatformCell: number | null;
  exits: string;
  isWheelchairAccessible: boolean;
  isStrollerAccessible: boolean;
  notes: string;
  connections?: Connection[];
};

type Props = {
  stationId: string;
  initialData?: FacilityData;
  isEdit?: boolean;
};

export function FacilityForm({ stationId, initialData, isEdit = false }: Props) {
  const router = useRouter();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [facilityTypes, setFacilityTypes] = useState<FacilityType[]>([]);
  const [connectedStations, setConnectedStations] = useState<ConnectedStation[]>([]);
  const [platformId, setPlatformId] = useState(initialData?.platformId ?? '');
  const [typeCode, setTypeCode] = useState(initialData?.typeCode ?? '');
  const [nearPlatformCell, setNearPlatformCell] = useState<number | ''>(initialData?.nearPlatformCell ?? '');
  const [exits, setExits] = useState(initialData?.exits ?? '');
  const [isWheelchairAccessible, setIsWheelchairAccessible] = useState(initialData?.isWheelchairAccessible ?? true);
  const [isStrollerAccessible, setIsStrollerAccessible] = useState(initialData?.isStrollerAccessible ?? true);
  const [notes, setNotes] = useState(initialData?.notes ?? '');
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
    setSubmitting(true);

    const payload = {
      platformId,
      typeCode,
      nearPlatformCell: nearPlatformCell === '' ? null : nearPlatformCell,
      exits: exits || null,
      isWheelchairAccessible,
      isStrollerAccessible,
      notes: notes || null,
      connections: connections.filter((c) => c.stationId !== ''),
    };

    const url = isEdit
      ? `/api/stations/${stationId}/facilities/${initialData!.id}`
      : `/api/stations/${stationId}/facilities`;
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

      {/* Facility Type */}
      <div>
        <label className="block text-sm font-medium mb-1">Type</label>
        <select
          value={typeCode}
          onChange={(e) => setTypeCode(e.target.value)}
          required
          className="w-full border rounded px-3 py-2"
        >
          <option value="">Select type</option>
          {facilityTypes.map((ft) => (
            <option key={ft.code} value={ft.code}>
              {ft.name}
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
        <p className="text-xs text-gray-500 mt-1">設備が位置するホームの枠番号（1〜maxCarCount）</p>
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
        <p className="text-xs text-gray-500 mt-1">この設備に繋がる出口を記載してください</p>
      </div>

      {/* Accessibility */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Accessibility</label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isWheelchairAccessible}
            onChange={(e) => setIsWheelchairAccessible(e.target.checked)}
          />
          <span className="text-sm">Wheelchair accessible</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isStrollerAccessible}
            onChange={(e) => setIsStrollerAccessible(e.target.checked)}
          />
          <span className="text-sm">Stroller accessible</span>
        </label>
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
          この設備を経由して乗り換え可能な駅と、対応する出口ラベルを指定してください
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
