import { db } from '@furatora/database/client';
import { lineDirections } from '@furatora/database/schema';
import type { DirectionType } from '@furatora/database/enums';
import { withTransaction, type Tx } from '@furatora/database/tx';
import { and, eq, ne } from 'drizzle-orm';
import {
  DirectionDefaultConflictError,
  type LineDirectionRecord,
  type LineDirectionRepository,
} from '@/features/line/ports';
import { isPgErrorCode, pgConstraintName, PG_UNIQUE_VIOLATION } from '@/external/pgError';
import { requireInserted } from '@/external/requireInserted';

// 方面（line_directions）の作成・更新（#130）。
// 既定行（is_default）は (路線, 走行方向) ごとに高々1行（unique_line_direction_default。ADR-0014）。
// 既定にする書き込みは「同じ組の旧既定を外す」「書く」の2文になるので withTransaction で行う（ADR-0005）。
// 既定にしない書き込みは単一表への1文なので db のまま（lineRepository と同じ判断）。
//
// 同じ組を同時に既定にする2本の書き込みは、READ COMMITTED では両方が「外す」を終えてから書きうるため、
// 一方が部分ユニーク違反になる。ロックは取らず、違反を DirectionDefaultConflictError（409）にする
// （二重の既定は制約が拒否し、トランザクションごと戻るので不整合は残らない。docs/spec/design.md 決定7）。
const DEFAULT_CONSTRAINT = 'unique_line_direction_default';

const columns = {
  id: lineDirections.id,
  lineId: lineDirections.lineId,
  directionType: lineDirections.directionType,
  representativeStationId: lineDirections.representativeStationId,
  displayName: lineDirections.displayName,
  displayNameEn: lineDirections.displayNameEn,
  terminalStationIds: lineDirections.terminalStationIds,
  notes: lineDirections.notes,
  isDefault: lineDirections.isDefault,
};

const byIdOnLine = (lineId: string, directionId: string) =>
  and(eq(lineDirections.id, directionId), eq(lineDirections.lineId, lineId));

// 組の旧既定を外す。更新では自分自身を除く（directionType を変える更新では、移動先の組が対象になる）
async function clearDefault(tx: Tx, lineId: string, directionType: DirectionType, exceptId?: string) {
  await tx
    .update(lineDirections)
    .set({ isDefault: false })
    .where(and(
      eq(lineDirections.lineId, lineId),
      eq(lineDirections.directionType, directionType),
      eq(lineDirections.isDefault, true),
      exceptId === undefined ? undefined : ne(lineDirections.id, exceptId),
    ));
}

async function mapConflict<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isPgErrorCode(err, PG_UNIQUE_VIOLATION) && pgConstraintName(err) === DEFAULT_CONSTRAINT) {
      throw new DirectionDefaultConflictError();
    }
    throw err;
  }
}

export const dbLineDirectionRepository: LineDirectionRepository = {
  async create(lineId, input) {
    return mapConflict(async (): Promise<LineDirectionRecord> => {
      if (!input.isDefault) {
        return requireInserted(
          await db.insert(lineDirections).values({ lineId, ...input }).returning(columns),
        );
      }
      return withTransaction(async (tx) => {
        await clearDefault(tx, lineId, input.directionType);
        return requireInserted(
          await tx.insert(lineDirections).values({ lineId, ...input }).returning(columns),
        );
      });
    });
  },

  async update(lineId, directionId, input) {
    return mapConflict(async (): Promise<LineDirectionRecord | null> => {
      if (!input.isDefault) {
        const [row] = await db
          .update(lineDirections)
          .set(input)
          .where(byIdOnLine(lineId, directionId))
          .returning(columns);
        return row ?? null;
      }
      return withTransaction(async (tx) => {
        // 対象が無い（別路線の id を含む）ときに、旧既定だけ外れてコミットされないよう、先に確かめる
        const [target] = await tx
          .select({ id: lineDirections.id })
          .from(lineDirections)
          .where(byIdOnLine(lineId, directionId))
          .for('update');
        if (!target) return null;
        await clearDefault(tx, lineId, input.directionType, directionId);
        const [row] = await tx
          .update(lineDirections)
          .set(input)
          .where(byIdOnLine(lineId, directionId))
          .returning(columns);
        return row ?? null;
      });
    });
  },
};
