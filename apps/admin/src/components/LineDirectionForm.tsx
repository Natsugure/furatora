'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

type Station = {
  id: string;
  name: string;
  nameEn: string | null;
  code: string | null;
};

type LineDirectionData = {
  id?: string;
  directionType: string;
  representativeStationId: string;
  displayName: string;
  displayNameEn: string;
  terminalStationIds: string[] | null;
  notes: string;
};

type Props = {
  lineId: string;
  initialData?: LineDirectionData;
  isEdit?: boolean;
};

export function LineDirectionForm({ lineId, initialData, isEdit = false }: Props) {
  const router = useRouter();
  const [stations, setStations] = useState<Station[]>([]);
  const [directionType, setDirectionType] = useState(initialData?.directionType ?? 'inbound');
  const [representativeStationId, setRepresentativeStationId] = useState(
    initialData?.representativeStationId ?? ''
  );
  const [displayName, setDisplayName] = useState(initialData?.displayName ?? '');
  const [displayNameEn, setDisplayNameEn] = useState(initialData?.displayNameEn ?? '');
  const [terminalStationIds, setTerminalStationIds] = useState<string[]>(
    initialData?.terminalStationIds ?? []
  );
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Fetch stations on the line
    fetch(`/api/stations?lineId=${lineId}`)
      .then((r) => r.json())
      .then(setStations);
  }, [lineId]);

  function toggleTerminalStation(stationId: string) {
    setTerminalStationIds((prev) =>
      prev.includes(stationId) ? prev.filter((id) => id !== stationId) : [...prev, stationId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      directionType,
      representativeStationId,
      displayName,
      displayNameEn: displayNameEn || null,
      terminalStationIds: terminalStationIds.length > 0 ? terminalStationIds : null,
      notes: notes || null,
    };

    const url = isEdit
      ? `/api/lines/${lineId}/directions/${initialData!.id}`
      : `/api/lines/${lineId}/directions`;
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      router.push(`/lines/${lineId}/directions`);
      router.refresh();
    } else {
      setSubmitting(false);
      alert('Failed to save');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {/* Direction Type */}
      <div>
        <label className="block text-sm font-medium mb-1">Direction Type</label>
        <select
          value={directionType}
          onChange={(e) => setDirectionType(e.target.value)}
          required
          className="w-full border rounded px-3 py-2"
        >
          <option value="inbound">Inbound (上り)</option>
          <option value="outbound">Outbound (下り)</option>
        </select>
      </div>

      {/* Display Name */}
      <div>
        <label className="block text-sm font-medium mb-1">Display Name (日本語)</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          placeholder="e.g. 渋谷方面"
          className="w-full border rounded px-3 py-2"
        />
      </div>

      {/* Display Name (English) */}
      <div>
        <label className="block text-sm font-medium mb-1">Display Name (English) - Optional</label>
        <input
          type="text"
          value={displayNameEn}
          onChange={(e) => setDisplayNameEn(e.target.value)}
          placeholder="e.g. For Shibuya"
          className="w-full border rounded px-3 py-2"
        />
      </div>

      {/* Representative Station */}
      <div>
        <label className="block text-sm font-medium mb-1">Representative Station</label>
        <select
          value={representativeStationId}
          onChange={(e) => setRepresentativeStationId(e.target.value)}
          required
          className="w-full border rounded px-3 py-2"
        >
          <option value="">Select station</option>
          {stations.map((station) => (
            <option key={station.id} value={station.id}>
              {station.name} {station.nameEn ? `(${station.nameEn})` : ''} {station.code ? `[${station.code}]` : ''}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          The main station representing this direction (e.g., Shibuya for "Shibuya-bound")
        </p>
      </div>

      {/* Terminal Stations */}
      <div>
        <label className="block text-sm font-medium mb-2">Terminal Stations - Optional</label>
        <div className="border rounded p-2 space-y-1 max-h-60 overflow-y-auto">
          {stations.length === 0 ? (
            <p className="text-sm text-gray-500">Loading stations...</p>
          ) : (
            stations.map((station) => (
              <label key={station.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={terminalStationIds.includes(station.id)}
                  onChange={() => toggleTerminalStation(station.id)}
                />
                {station.name} {station.nameEn ? `(${station.nameEn})` : ''} {station.code ? `[${station.code}]` : ''}
              </label>
            ))
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Select possible terminal stations for this direction
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
          onClick={() => router.push(`/lines/${lineId}/directions`)}
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
