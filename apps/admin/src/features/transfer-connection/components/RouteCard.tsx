'use client';

import {
  ActionIcon, Alert, Badge, Button, Card, Checkbox, Group, Input, NumberInput, Stack, Switch, Table, Text,
  Textarea, TextInput,
} from '@mantine/core';
import { Copy, Trash2 } from 'lucide-react';
import type { FacilityTypeCode } from '@furatora/transfer-difficulty/domain';
import { comboKeyOf } from '../domain/draft';
import { DIRECTIONS, type Direction, type RouteDraft } from '../domain/types';
import type { ValidationIssue } from '../domain/validate';
import { RoutePreview } from './RoutePreview';

export type DirectionAxis = {
  stationName: string;
  hints: Record<Direction, string[]>;
};

type Props = {
  route: RouteDraft;
  index: number;
  facilityTypes: { code: FacilityTypeCode; name: string }[];
  /** 行 = 自駅 S の方面、列 = 相手駅 T の方面 */
  stationAxis: DirectionAxis;
  connectedAxis: DirectionAxis;
  /** 駅対の外の接続からも参照されている場合の共有先（編集が共有先にも反映される） */
  sharedWith: string[];
  /** 既存データで紐付けごとに label / isBaseline が違っていた（保存すると揃う） */
  divergentLinks: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  onChange: (patch: Partial<Omit<RouteDraft, 'key'>>) => void;
  onToggleCombo: (combo: RouteDraft['combos'][number]) => void;
  onToggleFacility: (code: FacilityTypeCode) => void;
  onDuplicate: () => void;
  /** 共有中のルートを、この駅対だけの新しいルートにする（共有先は変わらない） */
  onDetach: () => void;
  onRemove: () => void;
};

const FLAGS = [
  { field: 'isOutdoor', label: '屋外を通る' },
  { field: 'requiresExitGate', label: '改札外を経由する' },
  { field: 'requiresStaff', label: '係員対応が必要' },
  { field: 'isOfficiallyGuided', label: '事業者が公式に案内している' },
] as const;

export function RouteCard({
  route, index, facilityTypes, stationAxis, connectedAxis, sharedWith, divergentLinks,
  errors, warnings, onChange, onToggleCombo, onToggleFacility, onDuplicate, onDetach, onRemove,
}: Props) {
  return (
    <Card withBorder padding="md" data-testid={`route-card-${index}`}>
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Group gap="xs">
            <Text fw={600}>ルート {index + 1}</Text>
            {route.routeId === null && <Badge color="blue" variant="light">新規</Badge>}
            {sharedWith.length > 0 && (
              <Badge color="grape" variant="light">共有中: {sharedWith.join('、')}</Badge>
            )}
          </Group>
          <Group gap="xs">
            <Button size="xs" variant="default" leftSection={<Copy size={14} />} onClick={onDuplicate}>
              複製して方面を分ける
            </Button>
            <ActionIcon color="red" variant="subtle" aria-label="このルートを削除" onClick={onRemove}>
              <Trash2 size={16} />
            </ActionIcon>
          </Group>
        </Group>

        {sharedWith.length > 0 && (
          <Alert color="grape" variant="light">
            <Stack gap="xs" align="flex-start">
              <Text size="sm">
                このルートは他の駅対の接続からも参照されています。ルート本体（所要時分・フラグ・設備・備考）の
                編集は共有先にも反映されます。
              </Text>
              <Button size="xs" variant="default" onClick={onDetach}>この駅対だけ切り離す</Button>
            </Stack>
          </Alert>
        )}
        {divergentLinks && (
          <Alert color="orange" variant="light">
            このルートは、方面の組み合わせごとに名前（label）または基準ルートの指定が異なっていました。
            最初の組み合わせの値を表示しています。保存すると全組み合わせでそろいます。
          </Alert>
        )}

        <Group align="flex-end" grow>
          <TextInput
            label="ルートの名前（label）"
            placeholder="例: 北改札経由 / 地上経由"
            required
            value={route.label}
            onChange={(e) => onChange({ label: e.currentTarget.value })}
          />
          <NumberInput
            label="所要時分（分）"
            placeholder="不明なら空欄"
            min={0}
            allowDecimal={false}
            allowNegative={false}
            value={route.minutes ?? ''}
            onChange={(v) => onChange({ minutes: v === '' ? null : Number(v) })}
          />
        </Group>

        <Switch
          label="基準ルート（一般利用者が案内される経路）"
          checked={route.isBaseline}
          onChange={(e) => onChange({ isBaseline: e.currentTarget.checked })}
        />

        <Input.Wrapper
          label="通る設備の種類（すべて通るものを選ぶ）"
          description="同じ段差に対する代替手段（階段と階段昇降機）は同じルートに入れず、別のルートにします。段差が無いルートは「同一フロア」を選びます。何も選ばないと「設備が未入力」として扱われます。"
        >
          <Group mt="xs" gap="md">
            {facilityTypes.map((type) => (
              <Checkbox
                key={type.code}
                value={type.code}
                label={type.name}
                checked={route.facilities.includes(type.code)}
                onChange={() => onToggleFacility(type.code)}
              />
            ))}
          </Group>
        </Input.Wrapper>

        <RoutePreview facilities={route.facilities} />

        <Stack gap={4}>
          <Text size="sm" fw={500}>経路の性質</Text>
          <Group gap="md">
            {FLAGS.map(({ field, label }) => (
              <Checkbox
                key={field}
                label={label}
                checked={route[field]}
                onChange={(e) => onChange({ [field]: e.currentTarget.checked })}
              />
            ))}
          </Group>
        </Stack>

        <Textarea
          label="ルートの備考"
          description="設備の質・時間帯制約など、上の項目で表せないことを書きます。「〇〇駅のほうが便利」のような出発地・目的地に依存する比較は書かないでください。"
          autosize
          minRows={2}
          value={route.notes}
          onChange={(e) => onChange({ notes: e.currentTarget.value })}
        />

        <Stack gap={4}>
          <Text size="sm" fw={500}>適用する方面の組み合わせ</Text>
          <Text size="xs" c="dimmed">
            既定は全方面共通（4つすべて）。方面によって条件が変わる場合は、ルートを複製して
            チェックを割り振ってください。
          </Text>
          <Table withTableBorder withColumnBorders w="auto" maw="36rem">
            <Table.Thead>
              <Table.Tr>
                <Table.Th />
                {DIRECTIONS.map((t) => (
                  <Table.Th key={t}>
                    {connectedAxis.stationName} {t}
                    <HintText hints={connectedAxis.hints[t]} />
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {DIRECTIONS.map((s) => (
                <Table.Tr key={s}>
                  <Table.Th>
                    {stationAxis.stationName} {s}
                    <HintText hints={stationAxis.hints[s]} />
                  </Table.Th>
                  {DIRECTIONS.map((t) => {
                    const combo = comboKeyOf(s, t);
                    return (
                      <Table.Td key={t}>
                        <Checkbox
                          aria-label={`${stationAxis.stationName} ${s} × ${connectedAxis.stationName} ${t}`}
                          checked={route.combos.includes(combo)}
                          onChange={() => onToggleCombo(combo)}
                        />
                      </Table.Td>
                    );
                  })}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>

        {errors.length > 0 && (
          <Alert color="red" title="保存できない項目があります">
            {errors.map((issue, i) => (
              <Text key={`${issue.code}-${i}`} size="sm">{issue.message}</Text>
            ))}
          </Alert>
        )}
        {warnings.length > 0 && (
          <Alert color="yellow" title="確認してください">
            {warnings.map((issue, i) => (
              <Text key={`${issue.code}-${i}`} size="sm">{issue.message}</Text>
            ))}
          </Alert>
        )}
      </Stack>
    </Card>
  );
}

// 方面の補助表示。同一 (路線, 方面) に同義行があるため一覧で出す（解決規則は #130）
function HintText({ hints }: { hints: string[] }) {
  if (hints.length === 0) return null;
  return <Text size="xs" c="dimmed" fw={400}>{hints.join('／')}</Text>;
}
