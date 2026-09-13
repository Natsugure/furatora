import { Stack, Text, Title } from '@mantine/core';
import { LinkAnchor } from '@/components/LinkElements';
import type { StationLayoutContext } from '@/features/station-layout/ports';
import { StationLayoutEditor } from './StationLayoutEditor';

type Props = {
  stationId: string;
  context: StationLayoutContext;
};

/**
 * 駅レイアウト統合ページの本体。Server Component。
 *
 * タブ・図・編集レイヤ・インスペクタ・未保存パネル・「位置未登録の設備・乗換」
 * セクションはすべて StationLayoutEditor（Client Component）に委譲する
 * （未保存確認モーダルがタブ遷移をまたいで単一のdirty stateを共有する必要があり、
 * PR4で「位置を入力」導線が操作を伴うようになったため。design.md参照）。
 * ここに残すのは静的表示のみ: 戻るリンク・駅名・notes。
 */
export function StationLayoutView({ stationId, context }: Props) {
  const { platform } = context;

  return (
    <div>
      <LinkAnchor href="/stations" size="sm" mb="lg" style={{ display: 'block' }}>
        &larr; 駅一覧に戻る
      </LinkAnchor>

      <Title order={2} mb="lg">{context.stationName}</Title>

      {!platform ? (
        <Text c="dimmed">ホームがまだ登録されていません。</Text>
      ) : (
        <Stack gap="lg">
          <StationLayoutEditor
            stationId={stationId}
            platforms={context.platforms}
            platform={platform}
            lines={context.lines}
            facilityTypes={context.facilityTypes}
            connectedStations={context.connectedStations}
            trains={context.trains}
          />
          {platform.notes && (
            <Text size="sm" c="yellow.8" bg="yellow.0" p="sm" style={{ borderRadius: 8 }}>
              {platform.notes}
            </Text>
          )}
        </Stack>
      )}
    </div>
  );
}
