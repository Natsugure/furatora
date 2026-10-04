import { notFound } from 'next/navigation';
import { BackLink } from '@/components/LinkElements';
import { parseUuidParam } from '@/shared/list/params';
import { StationLayoutView } from '@/features/station-layout/components/StationLayoutView';
import { resolveStationListBack } from '@/features/station/listState';
import { stationLayoutPageQuery } from '@/di';
import { UnknownFacilityCodeAlert } from '@/features/facility/components/UnknownFacilityCodeAlert';
import { UnknownFacilityCodeError } from '@/features/facility/ports';

/**
 * 駅レイアウト統合ページ。ホームタブ・図・設備編集を1画面に統合する。
 * `?platformId=&patternId=` は選択中のホーム・停車パターンを指す。
 */
export default async function StationLayoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ stationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { stationId } = await params;
  // パスの stationId は UUID でなければ 404。検証せずに渡すと Postgres の uuid 型エラーで 500 になる
  if (!parseUuidParam(stationId)) notFound();

  const raw = await searchParams;
  // 不正値は500にせず先頭にフォールバックさせる
  const platformId = parseUuidParam(raw.platformId);
  const patternId = parseUuidParam(raw.patternId);

  const { listState, backHref } = resolveStationListBack(raw);

  let context: Awaited<ReturnType<typeof stationLayoutPageQuery.getContext>>;
  try {
    context = await stationLayoutPageQuery.getContext(stationId, { platformId, patternId });
  } catch (error) {
    if (!(error instanceof UnknownFacilityCodeError)) throw error;
    return (
      <div>
        <BackLink href={backHref}>駅一覧に戻る</BackLink>
        <UnknownFacilityCodeAlert error={error} />
      </div>
    );
  }
  if (!context) notFound();

  return (
    <StationLayoutView
      stationId={stationId}
      context={context}
      listState={listState}
      backHref={backHref}
    />
  );
}
