import { notFound } from 'next/navigation';
import { Text, Title } from '@mantine/core';
import { BackLink } from '@/components/LinkElements';
import { transferPairEditPageQuery } from '@/di';
import { TransferPairEditor } from '@/features/transfer-connection/components/TransferPairEditor';
import { parseUuidParam } from '@/shared/list/params';

type Props = {
  params: Promise<{ stationId: string; connectedStationId: string }>;
};

// 駅対（自駅 S・相手駅 T）の乗換難易度の編集（Issue #124）。
// 方面の組み合わせ4通りの接続とそのルートを、1画面でまとめて編集する。
export default async function TransferPairEditPage({ params }: Props) {
  const { stationId, connectedStationId } = await params;
  // 不正な id を DB に渡すと uuid のパースエラーで 500 になる（#108）。存在しない駅対として扱う
  if (!parseUuidParam(stationId) || !parseUuidParam(connectedStationId)) {
    notFound();
  }

  const context = await transferPairEditPageQuery.getContext(stationId, connectedStationId);
  if (!context) {
    notFound();
  }

  return (
    <div>
      <BackLink href={`/stations/${stationId}/edit`}>駅の編集に戻る</BackLink>

      <Title order={2} mb="xs">
        乗換難易度: {context.stationName} ↔ {context.connectedStationName}
      </Title>
      <Text size="sm" c="dimmed" mb="lg">
        {context.lineName ?? '路線不明'} ↔ {context.connectedLineName ?? '路線不明'}
      </Text>

      <TransferPairEditor context={context} />
    </div>
  );
}
