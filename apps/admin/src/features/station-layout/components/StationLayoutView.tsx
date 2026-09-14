import { Stack, Text, Title } from '@mantine/core';
import { LinkAnchor } from '@/components/LinkElements';
import type { StationLayoutContext } from '@/features/station-layout/ports';
import { NewPlatformPrompt } from './NewPlatformPrompt';
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
 * （未保存確認モーダルがタブ遷移をまたいで単一のdirty stateを共有する必要があるため）。
 * ここに残すのは静的表示（戻るリンク・駅名・notes）と、ホームが1件も無い駅向けの
 * 新規ホーム追加導線（NewPlatformPrompt。StationLayoutEditor は platform.id 前提の
 * props を要求するためホーム0件時は描画できない）。
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
        <NewPlatformPrompt stationId={stationId} lines={context.lines} />
      ) : (
        <Stack gap="lg">
          <StationLayoutEditor
            // platform.id が変わるとコンポーネントが再生成され、useState などがリセットされる
            // key が無いとホーム切替（同一route内でのsearchParams変更）でもReactが同一インスタンスを再利用し、
            // 前のホームのstateが残ったままになる
            key={platform.id}
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
