# 設計: 使われなくなった設備の対応フラグ・メモと廃止日の列を DROP する (Issue #217)

- **参照**: [requirements.md](./requirements.md) / [tasks.md](./tasks.md)

## マイグレーション

`pnpm run db:generate`（`drizzle-kit generate --name drop_unused_columns`）で `packages/database/drizzle/0021_drop_unused_columns.sql` を作る。
テーブル定義は1段目で変えてあるので、生成されるのは DROP だけになる。

```sql
ALTER TABLE "lines" DROP COLUMN "abolished_at";
ALTER TABLE "stations" DROP COLUMN "abolished_at";
ALTER TABLE "station_facilities" DROP COLUMN "is_wheelchair_accessible";
ALTER TABLE "station_facilities" DROP COLUMN "is_stroller_accessible";
ALTER TABLE "station_facilities" DROP COLUMN "notes";
```

本番には Vercel のビルドが流す（CLAUDE.md。手で本番に流さない）。

## 順序の確認

| 状況 | 結果 |
|---|---|
| 1段目のコードが本番に出たあとで流す | 稼働中のコードは5列を読み書きしないので、影響は無い |
| 1段目より古いコードが動いている間に流す | 全列 SELECT・INSERT が無い列を指して失敗する。だからマージの前に、Web と Admin の両方のデプロイが済んでいることを確かめる |

## 失われるデータ

本番（2026-11-01 時点）でのデータ:

- `station_facilities` のフラグ: 164件。種類と重複する情報で、どこからも読まれていない
- `station_facilities.notes` / `abolished_at`: 0件

## ドキュメント

- `docs/domain/station-master-model.md` の冒頭の適用状況から、DB に列が残っている旨の注記を外す
