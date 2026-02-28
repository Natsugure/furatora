import { db } from '@furatora/database/client';
import { operators, lines, stations, trains, stationFacilities } from '@furatora/database/schema';
import { count } from 'drizzle-orm';
import { Card, SimpleGrid, Text, Title } from '@mantine/core';

async function fetchCounts() {
  const [operatorCount] = await db.select({ count: count() }).from(operators);
  const [lineCount] = await db.select({ count: count() }).from(lines);
  const [stationCount] = await db.select({ count: count() }).from(stations);
  const [trainCount] = await db.select({ count: count() }).from(trains);
  const [facilityCount] = await db.select({ count: count() }).from(stationFacilities);

  return {
    operators: operatorCount.count,
    lines: lineCount.count,
    stations: stationCount.count,
    trains: trainCount.count,
    facilities: facilityCount.count,
  };
}

export default async function Dashboard() {
  const counts = await fetchCounts();

  const cards = [
    { label: 'Operators', value: counts.operators },
    { label: 'Lines', value: counts.lines },
    { label: 'Stations', value: counts.stations },
    { label: 'Trains', value: counts.trains },
    { label: 'Facilities', value: counts.facilities },
  ];

  return (
    <div>
      <Title order={2} mb="lg">Dashboard</Title>
      <SimpleGrid cols={{ base: 2, md: 3, lg: 5 }}>
        {cards.map((card) => (
          <Card key={card.label} shadow="sm" padding="lg" withBorder ta="center">
            <Text size="xl" fw={700}>{card.value}</Text>
            <Text size="sm" c="dimmed" mt="xs">{card.label}</Text>
          </Card>
        ))}
      </SimpleGrid>
    </div>
  );
}
