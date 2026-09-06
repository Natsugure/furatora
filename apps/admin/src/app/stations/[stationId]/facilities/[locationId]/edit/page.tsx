import { notFound } from 'next/navigation';
import { Title } from '@mantine/core';
import { FacilityForm } from '@/features/facility/components/FacilityForm';
import { facilityEditPageQuery } from '@/di';

export default async function EditLocationPage({
  params,
}: {
  params: Promise<{ stationId: string; locationId: string }>;
}) {
  const { stationId, locationId } = await params;
  const context = await facilityEditPageQuery.getEditContext(stationId, locationId);

  if (!context?.location) notFound();

  return (
    <div>
      <Title order={2} mb="lg">設備場所を編集 - {context.stationName}</Title>
      <FacilityForm
        stationId={stationId}
        isEdit
        initialData={context.location}
        platforms={context.platforms}
        facilityTypes={context.facilityTypes}
        connectedStations={context.connectedStations}
      />
    </div>
  );
}
