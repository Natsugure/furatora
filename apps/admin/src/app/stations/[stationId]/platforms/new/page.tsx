import { notFound } from 'next/navigation';
import { db } from '@furatora/database/client';
import { stations } from '@furatora/database/schema';
import { eq } from 'drizzle-orm';
import { Title } from '@mantine/core';
import { PlatformForm } from '@/components/PlatformForm';

export default async function NewPlatformPage({
  params,
}: {
  params: Promise<{ stationId: string }>;
}) {
  const { stationId } = await params;
  const [station] = await db.select().from(stations).where(eq(stations.id, stationId));

  if (!station) notFound();

  return (
    <div>
      <Title order={2} mb="lg">新規ホーム - {station.name}</Title>
      <PlatformForm stationId={stationId} />
    </div>
  );
}
