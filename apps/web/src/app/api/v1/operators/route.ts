import { NextResponse } from 'next/server';
import { db } from '@furatora/database/client';
import { operators, lines } from '@furatora/database/schema';
import { asc } from 'drizzle-orm';
import type { OperatorsApiResponse, OperatorWithLines } from '@/types';

export async function GET() {
  try {
    // Fetch all operators
    const operatorList = await db
      .select()
      .from(operators)
      .orderBy(asc(operators.name));

    // Fetch all lines
    const lineList = await db
      .select()
      .from(lines)
      .orderBy(asc(lines.operatorId), asc(lines.displayOrder));

    // Group lines by operatorId
    const operatorsWithLines: OperatorWithLines[] = operatorList.map((op) => ({
      ...op,
      lines: lineList.filter((line) => line.operatorId === op.id),
    }));

    const response: OperatorsApiResponse = {
      operators: operatorsWithLines,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Operators fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
