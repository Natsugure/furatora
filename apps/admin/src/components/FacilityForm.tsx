'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

type Connection = {
  connectedStationId: string;
  description: string;
};

type Station = {
  id: string;
  name: string;
  nameEn: string | null;
  code: string | null;
};

type FacilityData = {
  id?: string;
  type: string;
  nearCarNumber: number | null;
  description: string;
  isAccessible: boolean;
  notes: string;
  connections: Connection[];
};

type Props = {
  stationId: string;
  initialData?: FacilityData;
  isEdit?: boolean;
};

export function FacilityForm({ stationId, initialData, isEdit = false }: Props) {
  const router = useRouter();
  const [allStations, setAllStations] = useState<Station[]>([]);
  const [type, setType] = useState(initialData?.type ?? 'elevator');
  const [nearCarNumber, setNearCarNumber] = useState<number | ''>(initialData?.nearCarNumber ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [isAccessible, setIsAccessible] = useState(initialData?.isAccessible ?? true);
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [connections, setConnections] = useState<Connection[]>(initialData?.connections ?? []);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/stations')
      .then((r) => r.json())
      .then(setAllStations);
  }, []);

  function addConnection() {
    setConnections((prev) => [...prev, { connectedStationId: '', description: '' }]);
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
      type,
      nearCarNumber: nearCarNumber === '' ? null : nearCarNumber,
      description: description || null,
      isAccessible,
      notes: notes || null,
      connections: connections.filter((c) => c.connectedStationId),
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
      {/* Type */}
      <div>
        <label className="block text-sm font-medium mb-1">Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full border rounded px-3 py-2"
        >
          <option value="elevator">Elevator</option>
          <option value="escalator">Escalator</option>
          <option value="stairs">Stairs</option>
        </select>
      </div>

      {/* Near Car Number */}
      <div>
        <label className="block text-sm font-medium mb-1">Near Car Number</label>
        <input
          type="number"
          min={1}
          value={nearCarNumber}
          onChange={(e) => setNearCarNumber(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="e.g. 3"
          className="w-32 border rounded px-3 py-2"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Concourse to Platform"
          className="w-full border rounded px-3 py-2"
        />
      </div>

      {/* Accessible */}
      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isAccessible}
            onChange={(e) => setIsAccessible(e.target.checked)}
          />
          <span className="text-sm font-medium">Accessible (stroller / wheelchair)</span>
        </label>
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

      {/* Connections */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Connections (reachable stations)</label>
          <button
            type="button"
            onClick={addConnection}
            className="text-sm text-blue-600 hover:underline"
          >
            + Add Connection
          </button>
        </div>
        {connections.map((conn, i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <select
              value={conn.connectedStationId}
              onChange={(e) => updateConnection(i, 'connectedStationId', e.target.value)}
              className="flex-1 border rounded px-2 py-1 text-sm"
            >
              <option value="">Select station</option>
              {allStations
                .filter((s) => s.id !== stationId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.nameEn ? `(${s.nameEn})` : ''} {s.code ? `[${s.code}]` : ''}
                  </option>
                ))}
            </select>
            <input
              type="text"
              value={conn.description}
              onChange={(e) => updateConnection(i, 'description', e.target.value)}
              placeholder="Description"
              className="w-48 border rounded px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => removeConnection(i)}
              className="text-red-500 text-sm"
            >
              Remove
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
