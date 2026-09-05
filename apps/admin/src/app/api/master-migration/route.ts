import { NextResponse } from 'next/server';
import { planMigration, applyMigration } from '@/di';
import { PlanTokenMismatchError } from '@/features/master-import/ports';
import type { CsvFileKey, EkidataCsvFiles } from '@/features/master-import/ports';
import { MigrationBlockedError } from '@/features/master-migration/ports';

/**
 * ODPT 由来の既存行に ekidata コードを突合する口（Issue #56 Phase 3・一度きり）。
 *
 * 取り込み（/api/master-import）と同じ4ファイルを受け取り、同じ2段階
 * （plan で試算を見せ、planToken 付きの apply で適用）で動く。
 * **実運用の順序は「突合 → 取り込み」である。** 逆順では取り込みが
 * operator_name_conflict を出して適用を拒否する（docs/spec/design.md）。
 *
 * 未認証は middleware.ts が 401 にする。
 */

/**
 * 書き込みは1,100行程度で速いが、11,127行の station CSV を毎回パースする。
 * 取り込みと同じ上限を置いて、遅い回線でのアップロードごと収める
 */
export const maxDuration = 60;

const FILE_KEYS: CsvFileKey[] = ['company', 'line', 'station', 'join'];

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'multipart/form-data で送ること' }, { status: 400 });
  }

  const mode = form.get('mode');
  if (mode !== 'plan' && mode !== 'apply') {
    return NextResponse.json({ error: "mode は 'plan' か 'apply' であること" }, { status: 400 });
  }

  const files = await readFiles(form);
  if ('missing' in files) {
    return NextResponse.json({ error: 'CSVが不足している', missing: files.missing }, { status: 400 });
  }

  try {
    if (mode === 'plan') {
      const result = await planMigration(files.value);
      if (!result.ok) {
        return NextResponse.json({ error: 'CSVを読めない', details: result.errors }, { status: 400 });
      }
      return NextResponse.json({
        mode: 'plan',
        summary: result.summary,
        unmatched: result.unmatched,
        blockers: result.blockers,
        planToken: result.planToken,
      });
    }

    const planToken = form.get('planToken');
    if (typeof planToken !== 'string' || planToken === '') {
      return NextResponse.json({ error: 'planToken が無い' }, { status: 400 });
    }

    const result = await applyMigration(files.value, planToken);
    if (!result.ok) {
      return NextResponse.json({ error: 'CSVを読めない', details: result.errors }, { status: 400 });
    }
    return NextResponse.json({ mode: 'apply', applied: result.applied });
  } catch (error) {
    // 試算を見せたのとは別のCSVで適用しようとした
    if (error instanceof PlanTokenMismatchError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    // 適用不能な事象が残っている（plan で提示済み）
    if (error instanceof MigrationBlockedError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    // middleware.ts の認証の内側にあり、利用者は管理者だけである。
    // 一意制約違反なのか FK なのかが画面から分からないと、原因の切り分けができない
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '適用に失敗した' },
      { status: 500 },
    );
  }
}

/**
 * master-import の route.ts と同じ読み取りである。
 * shared/ へ切り出さないのは、この関数が features/ の型
 * （EkidataCsvFiles）に依存しており、「shared/ は features/ を import しない」
 * という ADR-0001 の向きに反するためである。app/ 層に閉じた重複に留める
 */
async function readFiles(
  form: FormData,
): Promise<{ value: EkidataCsvFiles } | { missing: CsvFileKey[] }> {
  const missing: CsvFileKey[] = [];
  const entries: Partial<EkidataCsvFiles> = {};

  for (const key of FILE_KEYS) {
    const entry = form.get(key);
    if (!(entry instanceof File) || entry.size === 0) {
      missing.push(key);
      continue;
    }
    entries[key] = await entry.text();
  }

  if (missing.length > 0) return { missing };
  return { value: entries as EkidataCsvFiles };
}
