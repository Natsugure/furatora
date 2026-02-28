'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Button, Checkbox, Group, NativeSelect, ScrollArea,
  Stack, Text, TextInput, Textarea,
} from '@mantine/core';

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

function stationLabel(s: Station) {
  return `${s.name}${s.nameEn ? ` (${s.nameEn})` : ''}${s.code ? ` [${s.code}]` : ''}`;
}

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

  const stationSelectData = stations.map((s) => ({
    value: s.id,
    label: stationLabel(s),
  }));

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="lg" maw="42rem">
        <NativeSelect
          label="Direction Type"
          data={[
            { value: 'inbound', label: 'Inbound (上り)' },
            { value: 'outbound', label: 'Outbound (下り)' },
          ]}
          value={directionType}
          onChange={(e) => setDirectionType(e.target.value)}
          required
        />

        <TextInput
          label="Display Name (日本語)"
          placeholder="e.g. 渋谷方面"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />

        <TextInput
          label="Display Name (English) - Optional"
          placeholder="e.g. For Shibuya"
          value={displayNameEn}
          onChange={(e) => setDisplayNameEn(e.target.value)}
        />

        <NativeSelect
          label="Representative Station"
          description="The main station representing this direction (e.g., Shibuya for &quot;Shibuya-bound&quot;)"
          data={[{ value: '', label: 'Select station' }, ...stationSelectData]}
          value={representativeStationId}
          onChange={(e) => setRepresentativeStationId(e.target.value)}
          required
        />

        <div>
          <Text size="sm" fw={500} mb="xs">Terminal Stations - Optional</Text>
          <Text size="xs" c="dimmed" mb="xs">
            Select possible terminal stations for this direction
          </Text>
          <ScrollArea.Autosize mah={240} type="auto" offsetScrollbars>
            {stations.length === 0 ? (
              <Text size="sm" c="dimmed">Loading stations...</Text>
            ) : (
              <Stack gap="xs">
                {stations.map((station) => (
                  <Checkbox
                    key={station.id}
                    label={stationLabel(station)}
                    checked={terminalStationIds.includes(station.id)}
                    onChange={() => toggleTerminalStation(station.id)}
                  />
                ))}
              </Stack>
            )}
          </ScrollArea.Autosize>
        </div>

        <Textarea
          label="Notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <Group gap="sm">
          <Button type="submit" loading={submitting}>
            {isEdit ? 'Update' : 'Create'}
          </Button>
          <Button variant="default" onClick={() => router.push(`/lines/${lineId}/directions`)}>
            Cancel
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
