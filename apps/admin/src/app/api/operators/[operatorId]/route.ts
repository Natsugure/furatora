import { NextResponse } from 'next/server';
import { db } from '@furatora/database/client';
import { operators } from '@furatora/database/schema';
import { eq } from 'drizzle-orm';
import { operatorSchema } from '@/lib/validations';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ operatorId: string }> }
) {
  const { operatorId } = await params;
  try {
    const body = await request.json();
    const parsed = operatorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }
    const { name, odptOperatorId, displayPriority } = parsed.data;
    const [updated] = await db
      .update(operators)
      .set({
        name,
        odptOperatorId: odptOperatorId ?? null,
        displayPriority: displayPriority ?? null,
      })
      .where(eq(operators.id, operatorId))
      .returning();
    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ operatorId: string }> }
) {
  const { operatorId } = await params;
  try {
    const [deleted] = await db
      .delete(operators)
      .where(eq(operators.id, operatorId))
      .returning();
    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
