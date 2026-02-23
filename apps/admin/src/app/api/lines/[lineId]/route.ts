import { NextResponse } from 'next/server';
import { db } from '@furatora/database/client';
import { lines } from '@furatora/database/schema';
import { eq } from 'drizzle-orm';
import { lineUpdateSchema } from '@/lib/validations';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lineId: string }> }
) {
  const { lineId } = await params;
  try {
    const result = await db.select().from(lines).where(eq(lines.id, lineId)).limit(1);
    if (result.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(result[0]);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ lineId: string }> }
) {
  const { lineId } = await params;
  try {
    const body = await req.json();
    const parsed = lineUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await db.select().from(lines).where(eq(lines.id, lineId)).limit(1);
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await db
      .update(lines)
      .set({ nameKana: parsed.data.nameKana ?? null })
      .where(eq(lines.id, lineId));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
