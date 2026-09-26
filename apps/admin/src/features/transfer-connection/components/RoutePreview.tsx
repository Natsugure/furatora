import { Badge, Group, Stack, Text } from '@mantine/core';
import {
  PERSONA_LABEL, REQUIREMENT_LABEL, isBarrierFree, requirementFor,
  type FacilityTypeCode, type Persona,
} from '@furatora/transfer-difficulty/domain';

const PERSONAS: readonly Persona[] = ['stroller', 'wheelchair'];

// ルートの設備から、ペルソナごとの「必要な行為」を導出して読み取り専用で示す（Issue #124 REQ-21・22）。
// 入力者が「この設備の選び方だと、利用者にはこう見える」と解釈のずれに気づけるようにするもの。
// 導出は packages/transfer-difficulty の requirementFor が唯一の実装で、Web（#125）と同じ規則を使う。
export function RoutePreview({ facilities }: { facilities: readonly FacilityTypeCode[] }) {
  // 【設備0件は導出しない】設備0件は「設備未入力」（ADR-0012）。空集合を「そのまま通れる」と
  // 読ませると、利用者に誤ってバリアフリーだと伝える方向の誤りになる
  if (facilities.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        プレビュー: 設備が未入力です（必要な行為は導出せず、バリアフリールートにも数えません）
      </Text>
    );
  }

  return (
    <Stack gap={4}>
      <Text size="sm" fw={500}>プレビュー（設備から導出。保存されません）</Text>
      {PERSONAS.map((persona) => {
        const requirement = requirementFor(persona, facilities);
        return (
          <Group key={persona} gap="xs">
            <Text size="sm">
              {PERSONA_LABEL[persona]}: {requirement ? REQUIREMENT_LABEL[requirement] : ''}
            </Text>
            {isBarrierFree(requirement) && <Badge color="green" variant="light">バリアフリールート</Badge>}
          </Group>
        );
      })}
    </Stack>
  );
}
