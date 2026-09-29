import { db } from '@furatora/database/client';
import { operators, lines, lineDirections } from '@furatora/database/schema';
import type { DirectionType } from '@furatora/database/enums';
import { and, asc, eq } from 'drizzle-orm';
import type {
  LineEditPageQuery, LineDirectionEditPageQuery,
  LineDirectionEditContext, OperatorOption,
} from '@/features/line/ports';

// admin 全体の Query Service 化は #48。ここは #49 で先行導入したもの。

async function getOperatorOptions(): Promise<OperatorOption[]> {
  return db
    .select({ id: operators.id, name: operators.name })
    .from(operators)
    .orderBy(asc(operators.name));
}

export const dbLineEditPageQuery: LineEditPageQuery = {
  async getCreateContext() {
    return { operators: await getOperatorOptions() };
  },

  async getEditContext(lineId) {
    const [line] = await db.select().from(lines).where(eq(lines.id, lineId)).limit(1);
    if (!line) return null;

    const operatorOptions = await getOperatorOptions();

    return {
      line: {
        name: line.name,
        nameKana: line.nameKana,
        nameEn: line.nameEn,
        odptRailwayId: line.odptRailwayId,
        slug: line.slug,
        lineCode: line.lineCode,
        color: line.color,
        displayOrder: line.displayOrder ?? 0,
        operatorId: line.operatorId,
      },
      operators: operatorOptions,
    };
  },
};

async function getLineName(lineId: string) {
  return db.select({ name: lines.name }).from(lines).where(eq(lines.id, lineId)).limit(1);
}

// (路線, 走行方向) ごとの現在の既定行（ADR-0014）。組ごとに高々1行（unique_line_direction_default）
async function getCurrentDefaults(lineId: string): Promise<LineDirectionEditContext['currentDefaults']> {
  const rows = await db
    .select({ id: lineDirections.id, directionType: lineDirections.directionType, displayName: lineDirections.displayName })
    .from(lineDirections)
    .where(and(eq(lineDirections.lineId, lineId), eq(lineDirections.isDefault, true)));
  const of = (directionType: DirectionType) => {
    const row = rows.find((r) => r.directionType === directionType);
    return row ? { id: row.id, displayName: row.displayName } : null;
  };
  return { inbound: of('inbound'), outbound: of('outbound') };
}

export const dbLineDirectionEditPageQuery: LineDirectionEditPageQuery = {
  async getCreateContext(lineId) {
    // neon-http は await ごとに HTTP 往復になるため、依存の無いものは Promise.all でまとめる
    const [[line], currentDefaults] = await Promise.all([
      getLineName(lineId),
      getCurrentDefaults(lineId),
    ]);
    if (!line) return null;

    return { lineName: line.name, currentDefaults };
  },

  async getEditContext(lineId, directionId) {
    const [[line], [direction], currentDefaults] = await Promise.all([
      getLineName(lineId),
      db
        .select()
        .from(lineDirections)
        .where(and(eq(lineDirections.id, directionId), eq(lineDirections.lineId, lineId))),
      getCurrentDefaults(lineId),
    ]);
    if (!line || !direction) return null;

    const context: LineDirectionEditContext = {
      lineName: line.name,
      currentDefaults,
      direction: {
        id: direction.id,
        directionType: direction.directionType,
        displayName: direction.displayName,
        displayNameEn: direction.displayNameEn ?? '',
        notes: direction.notes ?? '',
        isDefault: direction.isDefault,
      },
    };
    return context;
  },
};
