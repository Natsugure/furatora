# 設計: station_connections の旧4列と難易度 enum の削除 (Issue #136)

- **参照**: [requirements.md](./requirements.md) / [tasks.md](./tasks.md)

## 変更対象

```
packages/database/src/schema.ts   stationConnections から4列を削除、enum 型の import を削除
packages/database/src/enums.ts    StrollerDifficulty / WheelchairDifficulty を削除
packages/database/drizzle/0015_*  【新規】DROP COLUMN ×4（db:generate で生成）
packages/database/CLAUDE.md       import 例を DirectionType に差し替え
apps/admin/src/features/station-connection/schema.test.ts   旧4列を受け取らないテストを削除
apps/admin/src/external/repository/stationConnectionRepository.ts   「落とすまで残る」コメントを削除
docs/domain/station-master-model.md   「乗換接続」節の凍結の記述を削除
```

## 影響調査

- 旧4列・enum 型を参照するのは上記のファイルだけ（マイグレーション履歴を除く）
- `stationConnections` を読む Query（Web の `stationDetailQuery`、Admin の `facilityEditPageQuery` / `stationEditPageQuery` /
  `stationLayoutPageQuery` / `transferPairEditPageQuery` / `transferPairSql`）はすべて列を明示して SELECT している
- DELETE の `returning` も `id` だけを明示している
- INSERT（`stationConnectionRepository.createPair`）は、Drizzle がテーブルの全列を `default` 付きで列挙する

## 決定

### 決定1: デプロイ中の INSERT の失敗は運用で避ける

- **コンテキスト**: Vercel のビルドがマイグレーションを流してから新しいデプロイに切り替わるまで、
  旧コードの Admin の「接続を追加」は、存在しない列を列挙して失敗する
- **オプション**: (a) 運用で避ける / (b) 1段目に戻って INSERT の列を明示するコードを先にデプロイする
- **理論的根拠**: 失敗するのは Admin の1操作だけで、運用者は1人、窓は数分。失敗してもトランザクションで戻り、データは壊れない。(b) はデプロイが1回増える割に得るものが小さい
- **影響**: PR の「デプロイ時の注意」に、デプロイ中は接続を追加しない旨を書く
- **レビュー**: Admin を複数人で使う運用になったとき

## エラーハンドリング

新しいエラー経路は無い。

## テスト戦略

- 型検査で参照の取り残しを検出する（`pnpm run typecheck`）
- 既存テスト（admin・web・パッケージ）がすべて通ること
- development で、マイグレーション適用後に Admin の接続の追加・削除と Web の駅詳細を確認する

## 恒久知識の振り分け

- `docs/domain/station-master-model.md`: 旧4列の凍結の記述を削除する（列が存在しないため）
- ADR: 作らない（Issue で予定された作業の実行であり、新しい意思決定を含まない）
