import { Stack, Text, Title } from '@mantine/core';
import { MasterImportForm } from '@/features/master-import/components/MasterImportForm';

export default function MasterImportPage() {
  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>マスタ取込</Title>
        <Text c="dimmed" size="sm">
          駅データ.jp（会員版）の4種のCSVから、事業者・路線・駅・乗換情報を更新する。
          差分を確認してから適用する2段階で、承認するまでDBは変更されない。
        </Text>
      </div>
      <MasterImportForm />
    </Stack>
  );
}
