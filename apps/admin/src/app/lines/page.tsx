import { db } from '@furatora/database/client';
import { lines, operators } from '@furatora/database/schema';
import { asc } from 'drizzle-orm';
import { LinkAnchor } from '@/components/LinkElements';
import { Table, TableTbody, TableTd, TableTh, TableThead, TableTr, Text, Title } from '@mantine/core';

export default async function LinesPage() {
  const lineList = await db.select().from(lines).orderBy(asc(lines.displayOrder));
  const operatorList = await db.select().from(operators);
  const operatorMap = Object.fromEntries(operatorList.map((op) => [op.id, op.name]));

  return (
    <div>
      <Title order={2} mb="lg">Lines</Title>

      {lineList.length === 0 ? (
        <Text c="dimmed">No lines found.</Text>
      ) : (
        <Table striped highlightOnHover withTableBorder>
          <TableThead>
            <TableTr>
              <TableTh>Name</TableTh>
              <TableTh>Operator</TableTh>
              <TableTh>Code</TableTh>
              <TableTh>Actions</TableTh>
            </TableTr>
          </TableThead>
          <TableTbody>
            {lineList.map((line) => (
              <TableTr key={line.id}>
                <TableTd>{line.name}</TableTd>
                <TableTd>
                  <Text size="sm" c="dimmed">{operatorMap[line.operatorId] ?? '-'}</Text>
                </TableTd>
                <TableTd>
                  <Text size="sm" ff="monospace">{line.lineCode ?? '-'}</Text>
                </TableTd>
                <TableTd>
                  <LinkAnchor href={`/lines/${line.id}/edit`} size="sm" mr="sm">
                    Edit
                  </LinkAnchor>
                  <LinkAnchor href={`/lines/${line.id}/directions`} size="sm">
                    Manage Directions
                  </LinkAnchor>
                </TableTd>
              </TableTr>
            ))}
          </TableTbody>
        </Table>
      )}
    </div>
  );
}
