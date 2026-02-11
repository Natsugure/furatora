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

type FacilityData = {
  id?: string;
  platformId: string;
  typeCode: string;
  nearCarNumber: number | null;
  description: string;
  isWheelchairAccessible: boolean;
  isStrollerAccessible: boolean;
  notes: string;
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
  const [platformId, setPlatformId] = useState(initialData?.platformId ?? '');
  const [typeCode, setTypeCode] = useState(initialData?.typeCode ?? '');
  const [nearCarNumber, setNearCarNumber] = useState<number | ''>(initialData?.nearCarNumber ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [isWheelchairAccessible, setIsWheelchairAccessible] = useState(initialData?.isWheelchairAccessible ?? true);
  const [isStrollerAccessible, setIsStrollerAccessible] = useState(initialData?.isStrollerAccessible ?? true);
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/stations/${stationId}/platforms`).then((r) => r.json()),
      fetch('/api/facility-types').then((r) => r.json()),
    ]).then(([platformsData, typesData]) => {
      setPlatforms(platformsData);
      setFacilityTypes(typesData);
    });
  }, [stationId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      platformId,
      typeCode,
      nearCarNumber: nearCarNumber === '' ? null : nearCarNumber,
      description: description || null,
      isWheelchairAccessible,
      isStrollerAccessible,
      notes: notes || null,
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
