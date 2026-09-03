import { NextResponse } from 'next/server';
import { planImport, applyImport } from '@/di';
import { ImportBlockedError, PlanTokenMismatchError } from '@/features/master-import/ports';
import type { CsvFileKey, EkidataCsvFiles } from '@/features/master-import/ports';

/**
 * ekidata マスタの取り込み口。
 *
 * 【Server Action ではなく Route Handler にした理由】station CSV は 1.7MB あり、
 * Server Action の既定ボディ上限 1MB を超える。`serverActions.bodySizeLimit` は
 * アプリ全体の設定であり、1画面の都合でグローバルな上限を緩めることになる。
 * Route Handler にこの制限は無い（docs/spec/design.md）。
 *
 * 未認証は middleware.ts が 401 にする。
 */

/**
 * 適用は約47,800行を単一トランザクションで投入し、実測 7.3〜8.0 秒かかる。
 * 既定の実行時間上限では足りない
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
    return NextResponse.json(
      { error: 'CSVが不足している', missing: files.missing },
      { status: 400 },
    );
  }

  try {
    if (mode === 'plan') {
      const result = await planImport(files.value);
      if (!result.ok) {
        return NextResponse.json({ error: 'CSVを読めない', details: result.errors }, { status: 400 });
      }
      return NextResponse.json({
        mode: 'plan',
        summary: result.summary,
        warnings: result.warnings,
        blockers: result.blockers,
        planToken: result.planToken,
      });
    }

    const planToken = form.get('planToken');
    if (typeof planToken !== 'string' || planToken === '') {
      return NextResponse.json({ error: 'planToken が無い' }, { status: 400 });
    }

    const result = await applyImport(files.value, planToken);
    if (!result.ok) {
      return NextResponse.json({ error: 'CSVを読めない', details: result.errors }, { status: 400 });
    }
    return NextResponse.json({ mode: 'apply', applied: result.applied });
  } catch (error) {
    // 差分を見せたのとは別のCSVで適用しようとした
    if (error instanceof PlanTokenMismatchError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    // 適用不能な事象が残っている（plan で提示済み）
    if (error instanceof ImportBlockedError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    // このエンドポイントは middleware.ts の認証の内側にあり、利用者は管理者だけである。
    // 47,800行の投入が10秒待った末に落ちたとき、`Internal server error` だけでは
    // 原因（FK の解決失敗か、制約違反か）が画面から一切分からない
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '適用に失敗した' },
      { status: 500 },
    );
  }
}

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
