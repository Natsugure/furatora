import Link from 'next/link';
import { Card, Group, SimpleGrid, Text, Title } from '@mantine/core';
import { Building2, MapPin, Route, TrainFront } from 'lucide-react';

// 各マスタ管理ページへの導線カード（クエリを伴わないリンクのみ。Issue #93）。
// 「設備」はホーム0件の駅を含め独立ページを持たず /stations/[id]/layout
// 配下（Issue #95以降）にあるため、駅カードの説明文に含める。
// 並び順はサイドバー（Sidebar.tsx の navItems）と揃え、粒度・順序を一致させる。
const cards = [
  { href: '/trains', label: '列車', description: '停車パターンの編集', icon: TrainFront },
  { href: '/stations', label: '駅', description: 'ホーム・設備の編集', icon: MapPin },
  { href: '/lines', label: '路線', description: '方向・隣接駅の編集', icon: Route },
  { href: '/operators', label: '事業者', description: '事業者マスタの編集', icon: Building2 },
];

export default function Dashboard() {
  return (
    <div>
      <Title order={2} mb="lg">ダッシュボード</Title>
      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        {cards.map((card) => (
          // Card の polymorphic `component` prop に Link を渡すと Server Component から
          // Client Component へ関数を props として渡す形になり RSC のシリアライズに失敗する。
          // shared/list/OperatorPicker.tsx と同じく Link で Card を包む（children として渡す）
          <Link
            key={card.href}
            href={card.href}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <Card shadow="sm" padding="lg" withBorder>
              <Group gap="xs">
                <card.icon size={20} />
                <Text size="lg" fw={700}>{card.label}</Text>
              </Group>
              <Text size="sm" c="dimmed" mt="xs">{card.description}</Text>
            </Card>
          </Link>
        ))}
      </SimpleGrid>
    </div>
  );
}
