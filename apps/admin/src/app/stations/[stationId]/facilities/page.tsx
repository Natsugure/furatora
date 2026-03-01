import { notFound } from 'next/navigation';
import { db } from '@furatora/database/client';
import {
  stations,
  platformLocations,
  stationFacilities,
  platforms,
  lines,
  lineDirections,
  facilityTypes,
} from '@furatora/database/schema';
import { eq, asc, inArray } from 'drizzle-orm';
import {
  Badge, Card, Group, Stack, Table, TableTbody, TableTd, TableTh, TableThead, TableTr, Text, Title,
} from '@mantine/core';
import { DeleteButton } from '@/components/DeleteButton';
import { FacilityDuplicateButton } from '@/components/FacilityDuplicateButton';
import { LinkAnchor, LinkButton } from '@/components/LinkElements';

export default async function FacilitiesPage({
  params,
}: {
  params: Promise<{ stationId: string }>;
}) {
  const { stationId } = await params;
  const [station] = await db
    .select()
    .from(stations)
    .where(eq(stations.id, stationId));

  if (!station) notFound();

  // Fetch platforms
  const platformList = await db
    .select()
    .from(platforms)
    .where(eq(platforms.stationId, stationId))
    .orderBy(asc(platforms.platformNumber));

  // Fetch line names for platforms
  const lineIds = [...new Set(platformList.map((p) => p.lineId))];
  const lineList =
    lineIds.length > 0
      ? await Promise.all(
          lineIds.map((lid) =>
            db.select({ id: lines.id, name: lines.name }).from(lines).where(eq(lines.id, lid))
          )
        )
      : [];
  const lineNameMap = Object.fromEntries(lineList.flat().map((l) => [l.id, l.name]));

  // Fetch direction names for platforms
  const directionIds = [
    ...new Set(
      platformList
        .flatMap((p) => [p.inboundDirectionId, p.outboundDirectionId])
        .filter((id): id is string => id !== null)
    ),
  ];
  const directionList =
    directionIds.length > 0
      ? await db
          .select()
          .from(lineDirections)
          .where(inArray(lineDirections.id, directionIds))
      : [];
  const directionMap = Object.fromEntries(directionList.map((d) => [d.id, d.displayName]));

  // Get platform IDs for this station
  const platformIds = platformList.map((p) => p.id);

  // Fetch platform locations for these platforms
  const locationList =
    platformIds.length > 0
      ? await db
          .select()
          .from(platformLocations)
          .where(inArray(platformLocations.platformId, platformIds))
          .orderBy(asc(platformLocations.nearPlatformCell))
      : [];

  const locationIds = locationList.map((l) => l.id);

  // Fetch facilities for these locations
  const facilityList =
    locationIds.length > 0
      ? await db
          .select()
          .from(stationFacilities)
          .where(inArray(stationFacilities.platformLocationId, locationIds))
      : [];

  // Fetch facility types
  const typeList = await db.select().from(facilityTypes);
  const typeMap = Object.fromEntries(typeList.map((t) => [t.code, t.name]));

  // Group locations by platformId
  const locationsByPlatform = new Map<string, typeof locationList>();
  for (const location of locationList) {
    const group = locationsByPlatform.get(location.platformId) ?? [];
    group.push(location);
    locationsByPlatform.set(location.platformId, group);
  }

  // Group facilities by platformLocationId
  const facilitiesByLocation = new Map<string, typeof facilityList>();
  for (const facility of facilityList) {
    const group = facilitiesByLocation.get(facility.platformLocationId) ?? [];
    group.push(facility);
    facilitiesByLocation.set(facility.platformLocationId, group);
  }

  return (
    <div>
      <LinkAnchor href="/stations" size="sm" mb="lg" style={{ display: 'block' }}>
        &larr; 駅一覧に戻る
      </LinkAnchor>

      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2}>{station.name}</Title>
          {station.nameEn && (
            <Text size="sm" c="dimmed">{station.nameEn}</Text>
          )}
        </div>
        <Group gap="xs">
          <LinkButton href={`/stations/${stationId}/platforms/new`} variant="default">
            + 新規ホーム
          </LinkButton>
          <LinkButton href={`/stations/${stationId}/facilities/new`}>
            + 新規設備場所
          </LinkButton>
        </Group>
      </Group>

      {/* Platforms Section */}
      <Stack gap="md" mb="xl">
        <Title order={3}>ホーム</Title>
        {platformList.length === 0 ? (
          <Text size="sm" c="dimmed">ホームがまだ登録されていません。</Text>
        ) : (
          <Table striped highlightOnHover withTableBorder>
            <TableThead>
              <TableTr>
                <TableTh>ホーム</TableTh>
                <TableTh>路線</TableTh>
                <TableTh>方面</TableTh>
                <TableTh>最大両数</TableTh>
                <TableTh>操作</TableTh>
              </TableTr>
            </TableThead>
            <TableTbody>
              {platformList.map((platform) => {
                const directions = [];
                if (platform.inboundDirectionId) {
                  directions.push(directionMap[platform.inboundDirectionId] ?? '上り');
                }
                if (platform.outboundDirectionId) {
                  directions.push(directionMap[platform.outboundDirectionId] ?? '下り');
                }
                const directionText = directions.length > 0 ? directions.join(' / ') : '-';

                return (
                  <TableTr key={platform.id}>
                    <TableTd fw={500}>{platform.platformNumber}</TableTd>
                    <TableTd>{lineNameMap[platform.lineId] ?? '-'}</TableTd>
                    <TableTd>{directionText}</TableTd>
                    <TableTd>{platform.maxCarCount}</TableTd>
                    <TableTd>
                      <Group gap="xs">
                        <LinkButton
                          href={`/stations/${stationId}/platforms/${platform.id}/edit`}
                          variant="default"
                          size="compact-xs"
                        >
                          編集
                        </LinkButton>
                        <DeleteButton
                          endpoint={`/api/stations/${stationId}/platforms/${platform.id}`}
                          redirectTo={`/stations/${stationId}/facilities`}
                        />
                      </Group>
                    </TableTd>
                  </TableTr>
                );
              })}
            </TableTbody>
          </Table>
        )}
      </Stack>

      {/* Platform Locations Section - grouped by platform */}
      <Title order={3} mb="sm">設備場所</Title>
      {locationList.length === 0 ? (
        <Text size="sm" c="dimmed">設備場所がまだ登録されていません。</Text>
      ) : (
        <Stack gap="xl">
          {platformList.map((platform) => {
            const locations = locationsByPlatform.get(platform.id) ?? [];
            if (locations.length === 0) return null;

            const directions = [];
            if (platform.inboundDirectionId) directions.push(directionMap[platform.inboundDirectionId] ?? '上り');
            if (platform.outboundDirectionId) directions.push(directionMap[platform.outboundDirectionId] ?? '下り');
            const directionText = directions.length > 0 ? ` — ${directions.join(' / ')}` : '';

            return (
              <div key={platform.id}>
                <Text size="sm" fw={600} c="dimmed" mb="xs" pb={4} style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
                  {platform.platformNumber}番ホーム{directionText}
                </Text>
                <Stack gap="xs">
                  {locations.map((location) => {
                    const locFacilities = facilitiesByLocation.get(location.id) ?? [];
                    const hasLimitedAccessibility = locFacilities.some(
                      (f) => !f.isWheelchairAccessible || !f.isStrollerAccessible
                    );

                    return (
                      <Card key={location.id} withBorder padding="md">
                        <Group justify="space-between" align="flex-start">
                          <div>
                            <Group gap="xs" mb={4}>
                              {location.nearPlatformCell && (
                                <Text size="sm" c="dimmed" fw={500}>
                                  枠 #{location.nearPlatformCell}
                                </Text>
                              )}
                              {hasLimitedAccessibility && (
                                <Badge color="yellow" variant="light" size="sm">
                                  アクセス制限あり
                                </Badge>
                              )}
                            </Group>
                            {location.exits && (
                              <Text size="sm" c="dimmed" mb={4}>{location.exits}</Text>
                            )}
                            <Group gap={6} mb={4} wrap="wrap">
                              {locFacilities.map((f) => (
                                <Badge key={f.id} variant="light" color="gray" size="sm">
                                  {typeMap[f.typeCode] ?? f.typeCode}
                                  {(!f.isWheelchairAccessible || !f.isStrollerAccessible) && ' *'}
                                </Badge>
                              ))}
                            </Group>
                            {location.notes && (
                              <Text size="sm" c="gray.5" mt="xs">{location.notes}</Text>
                            )}
                          </div>
                          <Group gap="xs">
                            <LinkButton
                              href={`/stations/${stationId}/facilities/${location.id}/edit`}
                              variant="default"
                              size="compact-sm"
                            >
                              編集
                            </LinkButton>
                            <FacilityDuplicateButton
                              endpoint={`/api/stations/${stationId}/platform-locations/${location.id}/duplicate`}
                            />
                            <DeleteButton
                              endpoint={`/api/stations/${stationId}/platform-locations/${location.id}`}
                              redirectTo={`/stations/${stationId}/facilities`}
                            />
                          </Group>
                        </Group>
                      </Card>
                    );
                  })}
                </Stack>
              </div>
            );
          })}
        </Stack>
      )}
    </div>
  );
}
