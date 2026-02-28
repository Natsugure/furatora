import { db } from '@furatora/database/client';
import { trains, operators } from '@furatora/database/schema';
import { asc } from 'drizzle-orm';
import { DeleteButton } from '@/components/DeleteButton';
import { DuplicateButton } from '@/components/DuplicateButton';
import { LinkButton, LinkAnchor } from '@/components/LinkElements';
import { Group, ScrollArea, Table, TableTbody, TableTd, TableTh, TableThead, TableTr, Text, Title } from '@mantine/core';

export default async function TrainsPage() {
  const trainList = await db.select().from(trains).orderBy(asc(trains.name));
  const operatorList = await db.select().from(operators);
  const operatorMap = Object.fromEntries(operatorList.map((op) => [op.id, op.name]));

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={2}>列車</Title>
        <LinkButton href="/trains/new">
          + 新規列車
        </LinkButton>
      </Group>

      {trainList.length === 0 ? (
        <Text c="dimmed">列車がまだ登録されていません。</Text>
      ) : (
        <ScrollArea>
          <Table striped highlightOnHover withTableBorder>
            <TableThead>
              <TableTr>
                <TableTh>名称</TableTh>
                <TableTh>事業者</TableTh>
                <TableTh>両数</TableTh>
                <TableTh>操作</TableTh>
              </TableTr>
            </TableThead>
            <TableTbody>
              {trainList.map((train) => (
                <TableTr key={train.id}>
                  <TableTd>{train.name}</TableTd>
                  <TableTd>
                    <Text size="sm" c="dimmed">{operatorMap[train.operators] ?? '-'}</Text>
                  </TableTd>
                  <TableTd>
                    <Text size="sm">{train.carCount}</Text>
                  </TableTd>
                  <TableTd>
                    <Group gap="xs">
                      <LinkAnchor href={`/trains/${train.id}/edit`} size="sm">
                        編集
                      </LinkAnchor>
                      <DuplicateButton trainId={train.id} trainName={train.name} />
                      <DeleteButton
                        endpoint={`/api/trains/${train.id}`}
                        redirectTo="/trains"
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
