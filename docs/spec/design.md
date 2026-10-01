# 設計: packages/database の schema.ts のドメイン別分割 (Issue #149)

## 変更するファイル

```
packages/database/src/schema.ts                 削除
packages/database/src/schema/index.ts           新規。4ファイルを再 export
packages/database/src/schema/stationMaster.ts   新規
packages/database/src/schema/transfer.ts        新規
packages/database/src/schema/platform.ts        新規
packages/database/src/schema/train.ts           新規
packages/database/package.json                  exports "./schema" → ./src/schema/index.ts
packages/database/drizzle.config.ts             schema → ./src/schema/index.ts
CLAUDE.md / apps/CLAUDE.md / packages/database/CLAUDE.md / .github/instructions/drizzle.instruction.md
docs/domain/station-visibility.md / docs/domain/station-master-model.md（パスの言及のみ）
.claude/agent-memory/frontend-engineer/MEMORY.md
```

## ファイルの分け方

`docs/domain/` の区切りに合わせる。

| ファイル | テーブル | 対応する docs/domain |
|---|---|---|
| `stationMaster.ts` | stations, lines, stationLines, lineDirections, operators, stationGroups, stationAdjacencies | station-master-model.md / line-directions.md / station-visibility.md |
| `transfer.ts` | stationConnections, transferConnections, transferRoutes, connectionRoutes, transferRouteFacilities | station-master-model.md「乗換接続」「乗換難易度」 |
| `platform.ts` | platforms, platformLocations, platformLocationCells, stationFacilities, facilityConnections, facilityTypes | platform-coordinate-system.md |
| `train.ts` | trains, trainCarStructures, trainEquipments（と型 CarStructure / FreeSpace / PrioritySeat / TrainEquipmentType）, trainStopPatterns, trainStopPatternCars | train-stop-patterns.md |

ファイル内の並びは元ファイルでの相対順を保つ。

### ファイル間の依存

```
stationMaster ← platform ← train
      ↑            ↑
      └──── transfer
```

循環しない。`.references(() => x.id)` は遅延評価なので循環しても動くが、読む人が依存の向きを追えるよう避ける。

## 決定

### 決定1: `facilityTypes` は `platform.ts` に置く

- **コンテキスト**: `stationFacilities`（platform）と `transferRouteFacilities`（transfer）の両方が参照する
- **オプション**: (a) `platform.ts`（本決定） / (b) 独立した `facility.ts` / (c) `transfer.ts`
- **理論的根拠**: 設備マスタであり、駅設備と同じ場所にあるのが自然。1テーブルのためにファイルを作る (b) は細かすぎる。(c) だと platform → transfer の依存ができる
- **影響**: `transfer.ts` が `platform.ts` を import する
- **レビュー**: 設備コードの定数と DB の一致を仕組みで守る #139 で、設備まわりの置き場所を見直すとき

### 決定2: `trainStopPatterns` / `trainStopPatternCars` は `train.ts` に置く

- **コンテキスト**: `platforms` と `trains` の両方を参照する
- **理論的根拠**: docs/domain の `train-stop-patterns.md` が列車側の文書である。`platform.ts` に置くと platform → train の依存ができ、train → platform と循環する
- **影響**: `train.ts` が `platform.ts` を import する

### 決定3: ADR にしない

ファイルの配置は、覆すときに明示的な判断が要らず、却下した選択肢に恒久的な理由も無い。配置の規約は `packages/database/CLAUDE.md` に置く。

## 恒久知識の振り分け

- 「テーブル定義は `src/schema/` にドメイン別に置き、`index.ts` で再 export する」: `packages/database/CLAUDE.md` と `.github/instructions/drizzle.instruction.md` の規約
- `docs/domain/`: ドメインルールの変更は無い。パスの言及のみを直す

## エラーハンドリング

実行時の振る舞いは変わらない。失敗しうるのは検証の段階だけで、`db:generate` が差分を出した場合は、欠けたテーブル・制約を突き合わせて直す。

## テスト戦略

新しいテストは追加しない。次の検証で同一性を確かめる。

- `drizzle-kit generate` が「No schema changes」を返し、`drizzle/` に差分が無い
- 旧ファイルと新ファイル（import 行を除く）の行を並べ替えて `diff` し、違いが見出しのコメントと決定したコメントの修正だけである
- 既存の `typecheck` / `lint` / `test` / `build`
