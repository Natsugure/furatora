import { NextResponse } from 'next/server';
import { db } from '@railease-navi/database/client';
import { operators } from '@railease-navi/database/schema';
import { asc } from 'drizzle-orm';

export async function GET() {
  const result = await db.select().from(operators).orderBy(asc(operators.name));
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const body = await request.json();
  const [operator] = await db
    .insert(operators)
    .values({
      name: body.name,
      odptOperatorId: body.odptOperatorId || null,
      displayPriority: body.displayPriority ?? null,
    })
    .returning();
  return NextResponse.json(operator, { status: 201 });
}
