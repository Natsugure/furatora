# 設計: 列車（trains）の書き込みを Repository にする (Issue #163)

- **参照**: [requirements.md](./requirements.md) / [tasks.md](./tasks.md)

## 構成

ADR-0003・ADR-0005 の書き込みの形に合わせる。根拠は ADR を見る。

```
route（app/api/trains/**）
  └─ trainRepository（di.ts）
       └─ dbTrainRepository（external/repository/trainRepository.ts）
            ├─ create / update: withTransaction（@furatora/database/tx）
            └─ delete: db（1 文。号車構成・設備・停車位置パターンは FK の CASCADE で消える）
```

## インターフェース（`features/train/ports.ts`）

```ts
// --- 書き込み（Repository。ADR-0003 / ADR-0005）---
export interface TrainRepository {
  // trains へ 1 行、号車構成・設備をその id で入れる（1 トランザクション）
  create(input: TrainInput): Promise<{ id: string }>;
  // 列車を更新し、号車構成・設備を消して入れ直す（1 トランザクション）。列車が無ければ false
  update(id: string, input: TrainInput): Promise<boolean>;
  // 列車が無ければ false
  delete(id: string): Promise<boolean>;
}
```

- 入力の型は `features/train/schema.ts` の `TrainInput` を使う（`platform`・`stop-pattern` の ports と同じ）
- `create` の返り値は `{ id }` だけにする。呼び出し元（`TrainForm`・`DuplicateButton`）は `res.ok` しか見ていない。
  いまは `trains` の行（列名が `operators` / `lines`）をそのまま返しているが、`TrainDTO` と形が違い、誤解のもとになる
- `update` を `boolean` にするのは、PUT の応答が `{ success: true }` で、更新後の列車を読み直す必要が無いため

## 実装の要点

- 号車構成の行・設備の行を作る処理は、create と update で同じなので関数にまとめる
  - `carLength` は decimal 列なので、`String()` に変換して書く（#165 まで）
  - 設備は `freeSpaces` → `free_space`、`prioritySeats` → `priority_seat`
  - 行が 0 件なら insert しない（Drizzle は空の `values([])` で例外を投げる）
- `update` は、列車の update が 0 行なら、そこで `false` を返す。号車構成・設備には触れない
- 例外はそのまま投げる。`withTransaction` が ROLLBACK し、route が 500 を返す

## エラー

| 状況 | Repository | route の応答 |
|---|---|---|
| 入力が `trainSchema` に合わない | 呼ばれない | 400 |
| パスパラメータが UUID でない | 呼ばれない | 404 |
| 更新・削除の対象が無い | `false` | 404 |
| 書き込み中の例外（FK 違反など） | 投げる（ROLLBACK） | 500 |

## テスト

- **Repository**（`external/repository/trainRepository.test.ts`）: CI に DB が無いため、`lineDirectionRepository.test.ts` と同じく、記録するだけの偽のクエリビルダを使う。次を確かめる
  - create / update が `withTransaction` の中で書く
  - 書く順番、渡す値（`carLength` の文字列化、設備の type）
  - 空の配列なら insert しないこと
  - 対象が無いときは、そこで止まること
- **route**（`app/api/trains/route.test.ts`・`[trainId]/route.test.ts`）: `vi.mock('@/di')` で Repository を差し替え、次を確かめる
  - 応答のステータスと本文
  - 400 / 404 / 500 の分岐

## 恒久知識の振り分け

- 新しい ADR は作らない。既存の ADR-0003・ADR-0005 をそのまま当てはめるだけ
- `docs/domain/` には、列車の書き込みについての記述が無い。層の構成もドメインのルールも変わらないので、更新しない
