import { db } from '@furatora/database/client';
import { operators } from '@furatora/database/schema';
import { asc } from 'drizzle-orm';
import { DeleteButton } from '@/components/DeleteButton';
import { LinkButton, LinkIcon } from '@/components/LinkElements';
import { Group, ScrollArea, Table, TableTbody, TableTd, TableTh, TableThead, TableTr, Text, Title } from '@mantine/core';
import { Pencil } from 'lucide-react';

export default async function OperatorsPage() {
  const operatorList = await db.select().from(operators).orderBy(asc(operators.name));

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={2}>事業者</Title>
        <LinkButton href="/operators/new">
          + 新規
        </LinkButton>
      </Group>

      {operatorList.length === 0 ? (
        <Text c="dimmed">事業者がまだ登録されていません。</Text>
      ) : (
        <ScrollArea>
          <Table striped highlightOnHover withTableBorder>
            <TableThead>
              <TableTr>
                <TableTh>事業者名</TableTh>
                <TableTh>ODPTコード</TableTh>
                <TableTh>表示優先度</TableTh>
                <TableTh>操作</TableTh>
              </TableTr>
            </TableThead>
            <TableTbody>
              {operatorList.map((operator) => (
                <TableTr key={operator.id}>
                  <TableTd>{operator.name}</TableTd>
                  <TableTd>
                    <Text size="sm" ff="monospace" c="dimmed">
                      {operator.odptOperatorId ?? '-'}
                    </Text>
                  </TableTd>
                  <TableTd>
                    <Text size="sm">
                      {operator.displayPriority ?? '-'}
                    </Text>
                  </TableTd>
                  <TableTd>
                    <Group gap="xs">
                      <LinkIcon href={`/operators/${operator.id}/edit`} variant='filled' aria-label="編集">
                        <Pencil style={{ width: '70%', height: '70%' }}/>
                      </LinkIcon>
                      <DeleteButton
                        endpoint={`/api/operators/${operator.id}`}
                        redirectTo="/operators"
                      />
                    </Group>
                  </TableTd>
                </TableTr>
              ))}
            </TableTbody>
          </Table>
        </ScrollArea>
      )}
    </div>
  );
}
