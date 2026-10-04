import { Alert, Code, Text } from '@mantine/core';
import type { UnknownFacilityCodeError } from '../ports';

// 本番では Server Component の例外メッセージが伏せられるため、ページで捕まえてここで理由を示す
export function UnknownFacilityCodeAlert({ error }: { error: UnknownFacilityCodeError }) {
  return (
    <Alert color="red" title="この画面を開けません">
      <Text size="sm" mb="xs">
        DB に、この Admin が知らない設備コードがあります:{' '}
        {error.codes.map((code, i) => (
          <span key={code}>
            {i > 0 && ', '}
            <Code>{code}</Code>
          </span>
        ))}
      </Text>
      <Text size="sm">
        このまま編集して保存すると、その設備が消えるため、編集を止めています。
        Admin のデプロイが古い可能性があります。最新のデプロイが反映されてから開き直してください。
      </Text>
    </Alert>
  );
}
