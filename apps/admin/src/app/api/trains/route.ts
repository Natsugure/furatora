import { NextResponse } from 'next/server';
import { trainSchema } from '@/features/train/schema';
import { trainRepository } from '@/di';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = trainSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }
    const created = await trainRepository.create(parsed.data);
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
