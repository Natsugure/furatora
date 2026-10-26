import type { TrainInput } from './schema';

// 読み取り: Query Service（ADR-0003）。列車の新規・編集ページが必要とする
// 選択肢（事業者・路線）と、編集時は列車本体・号車構成・設備を1画面分の DTO で返す。

export type OperatorOption = { id: string; name: string };

// TrainForm の路線セレクトは名前のみ表示する。nameEn/operatorId は将来の
// 事業者絞り込み用に取得しておく（現状フォームは全路線を出す）。
export type TrainLineOption = {
  id: string;
  name: string;
  nameEn: string;
  operatorId: string;
};

export type TrainCarStructureDTO = {
  carNumber: number;
  doorCount: number;
  carLength: number | null;
};

export type TrainEquipmentDTO = {
  carNumber: number;
  nearDoor: number;
  isStandard: boolean;
};

export type TrainDTO = {
  id: string;
  name: string;
  operatorId: string;
  lineIds: string[];
  carCount: number;
  carStructure: TrainCarStructureDTO[] | null;
  freeSpaces: TrainEquipmentDTO[];
  prioritySeats: TrainEquipmentDTO[];
};

export type TrainEditContext = {
  operators: OperatorOption[];
  lines: TrainLineOption[];
  train?: TrainDTO;
};

export interface TrainEditPageQuery {
  getCreateContext(): Promise<TrainEditContext>;
  // 該当列車が無ければ null（ページは notFound() する）
  getEditContext(trainId: string): Promise<TrainEditContext | null>;
  // 列車の複製（DuplicateButton）が GET /api/trains/[trainId] 経由で使う。
  // 複製元をそのまま POST /api/trains に送るため、編集ページと同じ DTO を返す。
  // 該当列車が無ければ null
  getTrain(trainId: string): Promise<TrainDTO | null>;
}

// --- 書き込み（Repository。ADR-0003 / ADR-0005）---

export interface TrainRepository {
  // trains へ1行 INSERT し、返った id で号車構成・設備を入れる（1トランザクション）
  create(input: TrainInput): Promise<{ id: string }>;
  // 列車を更新し、号車構成・設備を消して入れ直す（1トランザクション）。列車が無ければ false
  update(id: string, input: TrainInput): Promise<boolean>;
  // 号車構成・設備・停車位置パターンは FK の CASCADE で消える。列車が無ければ false
  delete(id: string): Promise<boolean>;
}
