import { NextResponse } from 'next/server';
import { stationPublishingRepository } from '@/di';
import { stationPublicationSchema } from '@/features/station-publishing/schema';
import { LineSlugMissingError, SlugTakenError } from '@/features/station-publishing/ports';

/**
 * 駅の公開・非公開を切り替える（TASK-5.2）。
 *
 * 既存の `PUT /api/stations/[stationId]` に相乗りさせない。あの route の
 * `stationUpdateSchema` は `publishedAt` を持たず `.set()` が全10列を無条件に
 * 上書きするため、公開切り替えのたびに slug や nameEn を巻き込む
 * （docs/spec/tasks.md TASK-5.2 参照）。
 *
 * `published_requires_slug` の CHECK 違反を実行時の500にしない。
 * slug の有無は repository が書き込み前に検証する。
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ stationId: string }> }
) {
  try {
    const { stationId } = await params;
    const body = await request.json();
    const parsed = stationPublicationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const updated = parsed.data.action === 'publish'
      ? await stationPublishingRepository.publish(stationId, parsed.data.slug)
      : await stationPublishingRepository.unpublish(stationId);

    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof LineSlugMissingError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof SlugTakenError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
