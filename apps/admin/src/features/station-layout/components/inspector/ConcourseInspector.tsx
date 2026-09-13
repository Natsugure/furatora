'use client';

import { useMemo } from 'react';
import {
  Button, Card, Checkbox, Collapse, Group, NativeSelect,
  NumberInput, Stack, Text, TextInput, Textarea, Title,
} from '@mantine/core';
import type { FacilityTypeOption, ConnectedStationOption } from '@/features/facility/ports';
import {
  setConcourseField, moveCell, addCell, removeCell,
  addCellFacility, removeCellFacility, updateCellFacility,
  setConnection, removeConnection,
  type ConcourseDraft,
} from '@/features/station-layout/domain/editDraft';
import { InspectorHeader } from './InspectorHeader';

type Props = {
  draft: ConcourseDraft;
  facilityTypes: FacilityTypeOption[];
  connectedStations: ConnectedStationOption[];
  onChange: (mutate: (draft: ConcourseDraft) => ConcourseDraft) => void;
  onSave: () => void;
  /** 既存コンコースのみ渡す（サーバーから削除する） */
  onDelete?: () => void;
  /** 新規・複製コンコースのみ渡す（保存前に取り消す。サーバーへは触らない） */
  onDiscard?: () => void;
  saving: boolean;
  deleting?: boolean;
  isNew: boolean;
};

/**
 * コンコース（platformLocations 1件）のテキストフォーム。旧 FacilityForm.tsx の
 * 入力項目を移植したが、送信は行わずすべて onChange 経由で StationLayoutEditor の
 * draft（座標ドラッグと同じ state）へ反映する。保存ボタンを押すまで確定しない。
 */
export function ConcourseInspector({
  draft, facilityTypes, connectedStations, onChange, onSave, onDelete, onDiscard, saving, deleting, isNew,
}: Props) {
  const connectedById = useMemo(
    () => new Map(draft.connections.map((c) => [c.stationId, c])),
    [draft.connections],
  );

  function addNewCell() {
    onChange((d) => addCell(d, crypto.randomUUID()));
  }

  return (
    <Card withBorder padding="lg">
      <InspectorHeader
        title={isNew ? '新規コンコース' : 'コンコースを編集'}
        onDiscard={onDiscard}
        onDelete={onDelete}
        deleting={deleting}
      />

      <Stack gap="lg" maw="42rem">
        <TextInput
          label="出口"
          description="この場所に繋がる出口を記載してください"
          placeholder="例: A3出口・B1出口"
          value={draft.exits ?? ''}
          onChange={(e) => onChange((d) => setConcourseField(d, 'exits', e.target.value || null))}
        />

        <Textarea
          label="場所メモ"
          rows={2}
          value={draft.notes ?? ''}
          onChange={(e) => onChange((d) => setConcourseField(d, 'notes', e.target.value || null))}
        />

        <div>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500}>アクセス点</Text>
            <Button type="button" variant="subtle" size="compact-sm" onClick={addNewCell}>
              + アクセス点を追加
            </Button>
          </Group>
          <Text size="xs" c="dimmed" mb="sm">
            ホーム上の設備位置（ホーム端からのメートル距離）ごとにアクセス点を登録してください。
            図上のドラッグでも位置を調整できます。
          </Text>
          {draft.cells.length === 0 && (
            <Text size="sm" c="red" mt="xs">アクセス点を1つ以上追加してください</Text>
          )}
          <Stack gap="sm">
            {draft.cells.map((cell, cellIndex) => (
              <Card key={cell.id} withBorder padding="md">
                <Group justify="space-between" mb="sm">
                  <Title order={5}>アクセス点 {cellIndex + 1}</Title>
                  {draft.cells.length > 1 && (
                    <Button
                      type="button"
                      variant="subtle"
                      color="red"
                      size="compact-sm"
                      onClick={() => onChange((d) => removeCell(d, cell.id))}
                    >
                      削除
                    </Button>
                  )}
                </Group>

                <NumberInput
                  label="ホーム端からの距離"
                  description="ホーム端（x=0）からの距離。範囲外（負の値やホーム長を超える値）も入力できます。空欄でホーム全体。"
                  step={0.1}
                  decimalScale={2}
                  placeholder="例: 42.5"
                  value={cell.xPositionMeters ?? ''}
                  onChange={(v) => onChange((d) => moveCell(d, cell.id, typeof v === 'number' ? v : null))}
                  suffix=" m"
                  w={160}
                  mb="sm"
                />

                <Text size="sm" fw={500} mb="xs">設備タイプ</Text>
                <Stack gap="xs">
                  {facilityTypes.map((ft) => {
                    const selected = cell.facilities.find((f) => f.typeCode === ft.code);
                    return (
                      <Card key={ft.code} withBorder padding="sm">
                        <Checkbox
                          label={ft.name}
                          checked={!!selected}
                          onChange={() => onChange((d) => (
                            selected ? removeCellFacility(d, cell.id, ft.code) : addCellFacility(d, cell.id, ft.code)
                          ))}
                          fw={500}
                        />
                        <Collapse in={!!selected}>
                          <Stack gap="xs" mt="sm" ml="xl">
                            <Group gap="lg">
                              <Checkbox
                                label="車いす対応"
                                checked={selected?.isWheelchairAccessible ?? false}
                                onChange={(e) => {
                                  const checked = e.currentTarget.checked;
                                  onChange((d) => updateCellFacility(d, cell.id, ft.code, { isWheelchairAccessible: checked }));
                                }}
                                size="sm"
                              />
                              <Checkbox
                                label="ベビーカー対応"
                                checked={selected?.isStrollerAccessible ?? false}
                                onChange={(e) => {
                                  const checked = e.currentTarget.checked;
                                  onChange((d) => updateCellFacility(d, cell.id, ft.code, { isStrollerAccessible: checked }));
                                }}
                                size="sm"
                              />
                            </Group>
                            <TextInput
                              placeholder="設備メモ（任意）"
                              value={selected?.notes ?? ''}
                              onChange={(e) => onChange((d) => (
                                updateCellFacility(d, cell.id, ft.code, { notes: e.target.value || null })
                              ))}
                              size="sm"
                            />
                          </Stack>
                        </Collapse>
                      </Card>
                    );
                  })}
                </Stack>
                {cell.facilities.length === 0 && (
                  <Text size="sm" c="red" mt="xs">設備タイプを1つ以上選択してください</Text>
                )}
              </Card>
            ))}
          </Stack>
        </div>

        <div>
          <Text size="sm" fw={500} mb="xs">乗換可能な駅</Text>
          <Text size="xs" c="dimmed" mb="xs">
            この場所を経由して乗り換え可能な駅にチェックを入れてください
          </Text>
          {connectedStations.length === 0 && (
            <Text size="sm" c="dimmed" fs="italic">接続可能な駅がありません</Text>
          )}
          <Stack gap={0} bg="white" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-sm)' }}>
            {connectedStations.map((station, i) => {
              const connection = connectedById.get(station.id);
              const checked = !!connection;
              const lineLabel = station.lines.length > 0 ? station.lines.map((l) => l.name).join(' / ') : '(路線不明)';
              return (
                <div
                  key={station.id}
                  style={{
                    borderBottom: i < connectedStations.length - 1 ? '1px solid var(--mantine-color-gray-3)' : undefined,
                    padding: '10px 14px',
                    opacity: checked ? 1 : 0.5,
                  }}
                >
                  <Group gap="sm" align="flex-start">
                    <Checkbox
                      checked={checked}
                      onChange={(e) => {
                        const nextChecked = e.currentTarget.checked;
                        onChange((d) => (nextChecked ? setConnection(d, station.id, {}) : removeConnection(d, station.id)));
                      }}
                      mt={2}
                    />
                    <Stack gap="xs" style={{ flex: 1 }}>
                      <div>
                        <Text size="sm" fw={500}>{lineLabel}</Text>
                        <Text size="xs" c="dimmed">{station.name}</Text>
                      </div>
                      <Group gap="xs" grow>
                        <NativeSelect
                          data={[
                            { value: '', label: 'ホームを選択（任意）' },
                            ...station.platforms.map((p) => ({ value: p.id, label: `${p.platformNumber}番ホーム` })),
                          ]}
                          value={connection?.connectedPlatformId ?? ''}
                          onChange={(e) => onChange((d) => setConnection(d, station.id, { connectedPlatformId: e.target.value || null }))}
                          disabled={!checked}
                          size="xs"
                        />
                        <NativeSelect
                          data={[
                            { value: '', label: '方面を選択（任意）' },
                            ...station.directions.map((dir) => ({ value: dir.id, label: dir.displayName })),
                          ]}
                          value={connection?.directionId ?? ''}
                          onChange={(e) => onChange((d) => setConnection(d, station.id, { directionId: e.target.value || null }))}
                          disabled={!checked}
                          size="xs"
                        />
                      </Group>
                      <TextInput
                        placeholder="備考（任意）"
                        value={connection?.exitLabel ?? ''}
                        onChange={(e) => onChange((d) => setConnection(d, station.id, { exitLabel: e.target.value || null }))}
                        disabled={!checked}
                        size="xs"
                      />
                      {connection?.connectedPlatformId && (
                        <Group gap="xs" grow>
                          <NumberInput
                            label="対面乗り換え帯 開始"
                            description="自ホーム座標系（ホーム端=0）での範囲"
                            step={0.1}
                            decimalScale={2}
                            value={connection.xRangeStart ?? ''}
                            onChange={(v) => onChange((d) => setConnection(d, station.id, { xRangeStart: typeof v === 'number' ? v : null }))}
                            disabled={!checked}
                            suffix=" m"
                            size="xs"
                          />
                          <NumberInput
                            label="対面乗り換え帯 終了"
                            step={0.1}
                            decimalScale={2}
                            value={connection.xRangeEnd ?? ''}
                            onChange={(v) => onChange((d) => setConnection(d, station.id, { xRangeEnd: typeof v === 'number' ? v : null }))}
                            disabled={!checked}
                            suffix=" m"
                            size="xs"
                          />
                        </Group>
                      )}
                    </Stack>
                  </Group>
                </div>
              );
            })}
          </Stack>
        </div>

        <Group gap="sm">
          <Button type="button" loading={saving} onClick={onSave}>
            保存
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
