'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Alert, Button, Checkbox, Group, NativeSelect, ScrollArea,
  Stack, Text, TextInput, Textarea,
} from '@mantine/core';
import type { DirectionStationOption, LineDirectionEditContext } from '@/features/line/ports';

type LineDirectionData = {
  id?: string;
  directionType: string;
  representativeStationId: string;
  displayName: string;
  displayNameEn: string;
  terminalStationIds: string[] | null;
  notes: string;
  isDefault: boolean;
};

type DirectionTypeValue = keyof LineDirectionEditContext['currentDefaults'];

type Props = {
  lineId: string;
  initialData?: LineDirectionData;
  isEdit?: boolean;
  stations: DirectionStationOption[];
  currentDefaults: LineDirectionEditContext['currentDefaults'];
};

const isDirectionType = (value: string): value is DirectionTypeValue =>
  value === 'inbound' || value === 'outbound';

function stationLabel(s: DirectionStationOption) {
  return `${s.name}${s.nameEn ? ` (${s.nameEn})` : ''}${s.code ? ` [${s.code}]` : ''}`;
}

export function LineDirectionForm({ lineId, initialData, isEdit = false, stations, currentDefaults }: Props) {
  const router = useRouter();
  const [directionType, setDirectionType] = useState(initialData?.directionType ?? 'inbound');
  // 新規作成で、その組に既定行がまだ無ければ既定にしておく（ADR-0014。無いと「上り」「下り」で表示される）
  const hasNoDefault = (type: string) => isDirectionType(type) && currentDefaults[type] === null;
  const [isDefault, setIsDefault] = useState(initialData?.isDefault ?? hasNoDefault(directionType));
  // 利用者がチェックを触ったあとは、方面タイプを切り替えても初期値を上書きしない
  const [isDefaultTouched, setIsDefaultTouched] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);
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

  function toggleTerminalStation(stationId: string) {
    setTerminalStationIds((prev) =>
      prev.includes(stationId) ? prev.filter((id) => id !== stationId) : [...prev, stationId]
    );
  }

  function changeDirectionType(value: string) {
    setDirectionType(value);
    if (!isDefaultTouched) setIsDefault(hasNoDefault(value));
  }

  // 選んだ組に自分以外の既定行があるなら、保存でそれが置き換わることを示す
  const otherDefault = isDirectionType(directionType) ? currentDefaults[directionType] : null;
  const replacedDefault = otherDefault && otherDefault.id !== initialData?.id ? otherDefault : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      directionType,
      representativeStationId,
      displayName,
      displayNameEn: displayNameEn || null,
      terminalStationIds: terminalStationIds.length > 0 ? terminalStationIds : null,
      notes: notes || null,
      isDefault,
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
      // 409 は同じ組の既定の同時変更（API がメッセージを返す）
      const body: unknown = res.status === 409 ? await res.json().catch(() => null) : null;
      const message = typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
        ? body.error
        : '保存に失敗しました';
      setError(message);
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
          label="方面タイプ"
          data={[
            { value: 'inbound', label: '上り' },
            { value: 'outbound', label: '下り' },
          ]}
          value={directionType}
          onChange={(e) => changeDirectionType(e.target.value)}
          required
        />

        <TextInput
          label="表示名（日本語）"
          placeholder="例: 渋谷方面"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />

        <TextInput
          label="表示名（英語）- 任意"
          placeholder="e.g. For Shibuya"
          value={displayNameEn}
          onChange={(e) => setDisplayNameEn(e.target.value)}
        />

        <div>
          <Checkbox
            label="この路線・方面の既定の表示名にする"
            description="ホームが登録されていない駅で、乗換案内の方面名として使われます。途中の駅名を含まない、終点方向の文言を選んでください"
            checked={isDefault}
            onChange={(e) => {
              setIsDefault(e.currentTarget.checked);
              setIsDefaultTouched(true);
            }}
          />
          {isDefault && replacedDefault && (
            <Text size="xs" c="orange" mt={4} ml={32}>
              現在の既定: {replacedDefault.displayName}（保存すると置き換わります）
            </Text>
          )}
        </div>

        <NativeSelect
          label="代表駅"
          description="この方面を表す代表的な駅（例：渋谷方面の場合は渋谷駅）"
          data={[{ value: '', label: '駅を選択' }, ...stationSelectData]}
          value={representativeStationId}
          onChange={(e) => setRepresentativeStationId(e.target.value)}
          required
        />

        <div>
          <Text size="sm" fw={500} mb="xs">終点駅 - 任意</Text>
          <Text size="xs" c="dimmed" mb="xs">
            この方面の終点となりうる駅を選択してください
          </Text>
          <ScrollArea.Autosize mah={240} type="auto" offsetScrollbars>
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
          </ScrollArea.Autosize>
        </div>

        <Textarea
          label="備考"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}

        <Group gap="sm">
          <Button type="submit" loading={submitting}>
            {isEdit ? '更新' : '登録'}
          </Button>
          <Button variant="default" onClick={() => router.push(`/lines/${lineId}/directions`)}>
            キャンセル
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
