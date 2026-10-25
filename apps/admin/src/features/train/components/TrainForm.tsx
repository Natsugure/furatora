'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ActionIcon, Button, Checkbox, Group, MultiSelect, NativeSelect,
  NumberInput, Stack, Text, TextInput,
} from '@mantine/core';
import { Trash2 } from 'lucide-react';
import { notifications } from '@mantine/notifications';
import type { OperatorOption, TrainLineOption } from '@/features/train/ports';
import { doorCountOf, equipmentDoorIssues, type EquipmentDoorIssue } from '@/features/train/domain/equipmentDoors';

// @furatora/database/schema には carLength を含まないため、admin側でローカルに定義する
type CarStructureItem = { carNumber: number; doorCount: number; carLength: number | null };
type EquipmentItem = { carNumber: number; nearDoor: number; isStandard: boolean };

type TrainData = {
  id?: string;
  name: string;
  operatorId: string;
  lineIds: string[];
  carCount: number;
  carStructure: CarStructureItem[] | null;
  freeSpaces: EquipmentItem[] | null;
  prioritySeats: EquipmentItem[] | null;
};

type Props = {
  initialData?: TrainData;
  isEdit?: boolean;
  operators: OperatorOption[];
  lines: TrainLineOption[];
};

export function TrainForm({ initialData, isEdit = false, operators, lines }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialData?.name ?? '');
  const [operatorId, setOperatorId] = useState(initialData?.operatorId ?? '');
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>(initialData?.lineIds ?? []);
  const [carCount, setCarCount] = useState(initialData?.carCount ?? 10);

  const initCarStructures = (): CarStructureItem[] => {
    const cs = initialData?.carStructure;
    if (cs && cs.length > 0) return cs;
    const count = initialData?.carCount ?? 10;
    return Array.from({ length: count }, (_, i) => ({ carNumber: i + 1, doorCount: 4, carLength: null }));
  };
  const [carStructures, setCarStructures] = useState(initCarStructures);

  const [freeSpaces, setFreeSpaces] = useState<EquipmentItem[]>(initialData?.freeSpaces ?? []);
  const [prioritySeats, setPrioritySeats] = useState<EquipmentItem[]>(initialData?.prioritySeats ?? []);
  const [submitting, setSubmitting] = useState(false);

  function addFreeSpace() {
    setFreeSpaces((prev) => [...prev, { carNumber: 1, nearDoor: 1, isStandard: true }]);
  }
  function removeFreeSpace(index: number) {
    setFreeSpaces((prev) => prev.filter((_, i) => i !== index));
  }
  function updateFreeSpace(index: number, field: keyof EquipmentItem, value: number | string | boolean) {
    setFreeSpaces((prev) => prev.map((fs, i) => (i === index ? { ...fs, [field]: value } : fs)));
  }

  function addPrioritySeat() {
    setPrioritySeats((prev) => [...prev, { carNumber: 1, nearDoor: 1, isStandard: true }]);
  }
  function removePrioritySeat(index: number) {
    setPrioritySeats((prev) => prev.filter((_, i) => i !== index));
  }
  function updatePrioritySeat(index: number, field: keyof EquipmentItem, value: number | string | boolean) {
    setPrioritySeats((prev) => prev.map((ps, i) => (i === index ? { ...ps, [field]: value } : ps)));
  }

  const freeSpaceIssues = doorIssuesOf(carStructures, freeSpaces);
  const prioritySeatIssues = doorIssuesOf(carStructures, prioritySeats);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // NumberInputからの空文字列をチェック
    const hasBlank = [...freeSpaces, ...prioritySeats].some(
      (item) => typeof item.carNumber !== 'number' || typeof item.nearDoor !== 'number'
    );
    // 範囲外のドア番号は API も拒む（trainSchema）。行のエラーを出したまま送らない
    const hasDoorIssue = freeSpaceIssues.length > 0 || prioritySeatIssues.length > 0;

    if (hasBlank || hasDoorIssue) {
      notifications.show({
        title: '更新エラー',
        message: hasBlank ? '入力項目が不足しています。' : '入力に誤りがあります。',
        color: 'red',
        autoClose: 3000,
      });
      return;
    }

    setSubmitting(true);

    const payload = {
      name,
      operatorId,
      lineIds: selectedLineIds,
      carCount,
      carStructure: carStructures.length > 0 ? carStructures : null,
      freeSpaces: freeSpaces.length > 0 ? freeSpaces : null,
      prioritySeats: prioritySeats.length > 0 ? prioritySeats : null,
    };

    const url = isEdit ? `/api/trains/${initialData!.id}` : '/api/trains';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        // 遷移するまで送信中のままにし、二重送信を防ぐ
        router.push('/trains');
        router.refresh();
        return;
      }
    } catch {
      // 通信断で reject しても、送信中のまま止めない
    }
    setSubmitting(false);
    alert('保存に失敗しました');
  }

  const lineSelectData = lines.map((l) => ({ value: l.id, label: l.name }));

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="lg" maw="42rem">
        <TextInput
          label="列車名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <NativeSelect
          label="事業者"
          data={[
            { value: '', label: '事業者を選択' },
            ...operators.map((op) => ({ value: op.id, label: op.name })),
          ]}
          value={operatorId}
          onChange={(e) => {
            setOperatorId(e.target.value);
            setSelectedLineIds([]);
          }}
          required
        />

        <MultiSelect
          label="路線"
          searchable
          data={lineSelectData}
          value={selectedLineIds}
          onChange={setSelectedLineIds}
        />

        <NumberInput
          label="両数"
          min={1}
          max={17}
          value={carCount}
          onChange={(v) => {
            const newCount = typeof v === 'number' ? v : 10;
            setCarCount(newCount);
            setCarStructures((prev) =>
              Array.from({ length: newCount }, (_, i) => ({
                carNumber: i + 1,
                doorCount: prev[i]?.doorCount ?? 4,
                carLength: prev[i]?.carLength ?? null,
              }))
            );
          }}
          required
          w={{ base: '100%', xs: 128 }}
        />

        <div>
          <Text size="sm" fw={500} mb="xs">車両構成（号車ごとのドア数・実長）</Text>
          <Text size="xs" c="dimmed" mb="xs">
            実長（メートル）は任意入力です。未指定の場合は停車位置パターンの自動算出で標準値（20.0m）を使用します。
          </Text>
          <Stack gap={4}>
            {carStructures.map((cs, i) => (
              <Group key={i} gap="sm" align="center">
                <Text size="sm" c="dimmed" w={56} ta="right">{cs.carNumber}号車</Text>
                <NumberInput
                  min={1}
                  max={6}
                  value={cs.doorCount}
                  onChange={(v) =>
                    setCarStructures((prev) =>
                      prev.map((c, j) => j === i ? { ...c, doorCount: typeof v === 'number' ? v : 4 } : c)
                    )
                  }
                  w={80}
                  size="xs"
                  suffix="ドア"
                />
                <NumberInput
                  min={0}
                  step={0.1}
                  decimalScale={2}
                  placeholder="20.0"
                  value={cs.carLength ?? ''}
                  onChange={(v) =>
                    setCarStructures((prev) =>
                      prev.map((c, j) => j === i ? { ...c, carLength: typeof v === 'number' ? v : null } : c)
                    )
                  }
                  w={100}
                  size="xs"
                  suffix=" m"
                />
              </Group>
            ))}
          </Stack>
        </div>

        <div>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500}>フリースペース</Text>
            <Button type="button" variant="subtle" size="compact-sm" onClick={addFreeSpace}>+ 追加</Button>
          </Group>
          <EquipmentRows
            items={freeSpaces}
            issues={freeSpaceIssues}
            carCount={carCount}
            carStructures={carStructures}
            onUpdate={updateFreeSpace}
            onRemove={removeFreeSpace}
          />
        </div>

        <div>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500}>優先席</Text>
            <Button type="button" variant="subtle" size="compact-sm" onClick={addPrioritySeat}>+ 追加</Button>
          </Group>
          <EquipmentRows
            items={prioritySeats}
            issues={prioritySeatIssues}
            carCount={carCount}
            carStructures={carStructures}
            onUpdate={updatePrioritySeat}
            onRemove={removePrioritySeat}
          />
        </div>

        <Group gap="sm">
          <Button type="submit" loading={submitting}>
            {isEdit ? '更新' : '登録'}
          </Button>
          <Button type="button" variant="default" onClick={() => router.push('/trains')}>
            キャンセル
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/**
 * 範囲外の号車・ドア番号を行ごとに返す（#194）。入力途中の空欄（文字列）の行の issue は
 * 空欄チェックに任せて落とす
 */
function doorIssuesOf(carStructures: CarStructureItem[], items: EquipmentItem[]): EquipmentDoorIssue[] {
  return equipmentDoorIssues(carStructures, items).filter(({ index }) =>
    typeof items[index]?.carNumber === 'number' && typeof items[index]?.nearDoor === 'number',
  );
}

type EquipmentRowsProps = {
  items: EquipmentItem[];
  issues: EquipmentDoorIssue[];
  carCount: number;
  carStructures: CarStructureItem[];
  onUpdate: (index: number, field: keyof EquipmentItem, value: number | string | boolean) => void;
  onRemove: (index: number) => void;
};

/** フリースペース・優先席の行。空欄は赤枠、範囲外は文で示す */
function EquipmentRows({ items, issues, carCount, carStructures, onUpdate, onRemove }: EquipmentRowsProps) {
  const messageOf = (index: number, field: EquipmentDoorIssue['field']) =>
    issues.find((issue) => issue.index === index && issue.field === field)?.message;

  return (
    <Stack gap="xs">
      {items.map((item, i) => (
        <Group key={i} gap="sm" align="flex-start" wrap="wrap">
          {/* 号車もドア番号と同じく、範囲外を丸めずにエラーを出す */}
          <NumberInput label="号車" min={1} max={carCount}
            clampBehavior="none"
            value={item.carNumber}
            onChange={(v) => onUpdate(i, 'carNumber', v)}
            w={80} size="xs"
            error={messageOf(i, 'carNumber') ?? (typeof item.carNumber === 'string' && item.carNumber === '')}
          />
          {/* 範囲外を上限に丸めると、押した覚えのない別のドアが黙って保存される。
              丸めずにエラーを出し、送信を止める（max は矢印キー・増減ボタンの上限） */}
          <NumberInput label="ドア番号" min={1}
            max={doorCountOf(carStructures, item.carNumber)}
            clampBehavior="none"
            value={item.nearDoor}
            onChange={(v) => onUpdate(i, 'nearDoor', v)}
            w={80} size="xs"
            error={messageOf(i, 'nearDoor') ?? (typeof item.nearDoor === 'string' && item.nearDoor === '')}
          />
          <Checkbox label="全編成装備" checked={item.isStandard}
            onChange={(e) => onUpdate(i, 'isStandard', e.currentTarget.checked)}
            size="sm" mt="lg"
          />
          <ActionIcon variant="filled" color="red" size="sm" onClick={() => onRemove(i)} mt="lg">
            <Trash2 style={{ width: '70%', height: '70%' }}/>
          </ActionIcon>
        </Group>
      ))}
    </Stack>
  );
}
