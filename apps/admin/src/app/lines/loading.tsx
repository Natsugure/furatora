import { Skeleton, Stack, Title } from '@mantine/core';

export default function Loading() {
  return (
    <div>
      <Title order={2} mb="lg">Lines</Title>
      <Stack gap={2}>
        <Skeleton height={44} radius={0} />
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} height={48} radius={0} />
        ))}
      </Stack>
    </div>
  );
}
