import { NextResponse } from 'next/server';
import { db } from '@furatora/database/client';
import { operators } from '@furatora/database/schema';
import { asc } from 'drizzle-orm';
import { operatorSchema } from '@/lib/validations';

export async function GET() {
  try {
    const result = await db.select().from(operators).orderBy(asc(operators.name));
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = operatorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }
    const { name, odptOperatorId, displayPriority } = parsed.data;
    const [operator] = await db
      .insert(operators)
      .values({
        name,
        odptOperatorId: odptOperatorId ?? null,
        displayPriority: displayPriority ?? null,
      })
      .returning();
    return NextResponse.json(operator, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
