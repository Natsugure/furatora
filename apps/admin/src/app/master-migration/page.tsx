import { Alert, Stack, Text, Title } from '@mantine/core';
import { MasterMigrationForm } from '@/features/master-migration/components/MasterMigrationForm';

export default function MasterMigrationPage() {
  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>マスタ突合</Title>
        <Text c="dimmed" size="sm">
          ODPT 由来の既存データ（事業者・路線・駅）に、駅データ.jp のコードを対応づける。
          既存の行は作り直さず、コード列だけを埋める。
        </Text>
      </div>
      <Alert color="blue" title="実行の順序">
        <Text size="sm">
          <strong>この画面を先に実行してから「マスタ取込」を行うこと。</strong>
          現行の17事業者は名前が駅データ.jp 側と完全に一致するため、突合前に取り込むと
          事業者名の一意制約に衝突して適用が拒否される。
        </Text>
      </Alert>
      <MasterMigrationForm />
    </Stack>
  );
}
