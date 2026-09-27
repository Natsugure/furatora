# 方面（`line_directions`）と方面ラベルの解決

> **適用状況**: 2026-09-27 現在、**スキーマ・既定行のデータ・解決関数・Admin の入力と表示まで実装済み**
> （[#130](https://github.com/Natsugure/furatora/issues/130)）。移行（`0013`・`0014`）は development に適用済みで、
> 本番（`main`）へは未適用（`main` へのリリース時に Vercel のビルドが流す）。
> **Web はまだ乗換接続の方面ラベルを表示しない**。表示は [#125](https://github.com/Natsugure/furatora/issues/125) で、
> そこで下記の `resolveDirectionLabel` を使う。#125 が完了したら、この注記の最後の2文を外す。

「路線のある走行方向を、利用者にどう呼ぶか（池袋方面・内回り など）」を持つ。
判断の根拠と却下案は [ADR-0014](../adr/0014-direction-label-by-default-row.md)。

## モデル

```
line_directions
  ├── lineId, directionType ('inbound' | 'outbound')
  ├── displayName / displayNameEn        表示の文言
  ├── representativeStationId (NOT NULL)  代表駅。一覧の表示用で、解決規則には使わない
  ├── terminalStationIds                  終点駅の候補
  └── isDefault                           (lineId, directionType) の既定の文言か
        └── unique_line_direction_default: (lineId, directionType) WHERE is_default
```

- 本文書では `(lineId, directionType)` を**組**と呼ぶ。1路線につき inbound・outbound の2組。
- **同じ組に、同じ意味の行が複数ある。** 駅ごとの掲示の違いをそのまま行にしているため
  （丸ノ内線 inbound は「東京・新宿・荻窪・方南町方面」「荻窪・方南町方面」など5行）。
  これは誤りではなく、ホーム（`platforms`）が駅ごとの掲示の文言を指すために必要である。統合しないこと。
- ホームは `platforms.inboundDirectionId` / `outboundDirectionId` の2つの**枠**で方面を指す。
  枠と、参照先の行の `directionType` は一致させる（DB では縛っていない。2026-09-27 時点の実データは全件一致）。
- 乗換接続の端点（`transfer_connections`）は `(stationId, directionType)` で、`line_directions` の行を参照しない
  （[station-master-model.md](./station-master-model.md)「接続の端点」）。文言は下の規則で引く。

## 既定行

| 不変条件 | 守り方 | 外そうとする人へ |
|---|---|---|
| 既定行は組ごとに高々1行 | `unique_line_direction_default`（部分ユニーク） | 外すと、解決の ② が一意に決まらない |
| 既定行が0行の組を許容する | 制約を置かない | 0行の組は「上り」「下り」で表示される。必須にすると、方面の行を作る前に既定を決めることになる |

- **既定にするのは、途中の駅名を含まない、終点方向の文言**（路線上の大半の駅で表示しても誤りにならない文言）。
  既定の文言は、ホームが登録されていない**すべての駅**で同じ文言として出るためである。
  例: 丸ノ内線 inbound は「荻窪・方南町方面」（「東京・新宿・荻窪・方南町方面」は新宿駅・東京駅で誤りになる）。
- 既存の行にどの駅でも通用する文言が無い路線は、既定用の行を新しく作る。
  **都営大江戸線は inbound =「内回り」・outbound =「外回り」** を既定行にしている（代表駅は都庁前）。
  区間ごとの掲示の13行は、ホームを登録するときに ① の文言として使うために残してある。
- 2026-09-27 時点で、全14路線28組に既定行がある（移行 `0014_set_line_direction_defaults.sql`）。

## 方面ラベルの解決

駅 S・路線 L・走行方向 D の方面ラベルは、次の順で最初に見つかったものを使う。

1. **① ホームの文言**: S の L のホームが、D の枠に持つ方面の `displayName`
2. **② 既定行の文言**: (L, D) の既定行の `displayName`
3. **③ フォールバック**: D が inbound なら「上り」、outbound なら「下り」

- ① で文言が複数あるとき（1つの走行方向に複数のホームが対応する駅。中野坂上 inbound の「方南町方面」「荻窪・方南町方面」）は、
  **どれか1つに決めず**、重複を除いてホーム番号の数値順（'2' → '10'）に「／」で連結する。解消は [#128](https://github.com/Natsugure/furatora/issues/128)。
- 空文字の文言は、無いものとして次の段へ進む。
- 実装は `packages/transfer-difficulty/src/domain/directionLabel.ts` の `resolveDirectionLabel`
  （DB・React に依存しない純粋関数）。呼び出し側がホームと既定行を読んで渡す。
  Admin の駅対編集画面（`apps/admin/src/external/query/transferPairEditPageQuery.ts`）が使っており、
  Web（#125）も同じ関数を使うこと。規則を各アプリで書き直さない。
- 駅は現在、路線×駅の粒度で1駅1路線である。駅対編集画面は駅の最初の路線（`stationLines` を路線の `displayOrder`、同順なら id で並べた先頭）について解決し、
  ホームと既定行をその路線で絞る。1駅が複数路線を持つようになったら（[#82](https://github.com/Natsugure/furatora/issues/82)）、
  解決の入力に路線を明示する必要がある。

## Admin の書き込み規約

- 方面の作成・更新（`POST /api/lines/[lineId]/directions`・`PUT …/[directionId]`）は
  `apps/admin/src/external/repository/lineDirectionRepository.ts` を通す。
- API の `isDefault` は必須（省略は 400）。PUT は全項目の置き換えなので、省略を false と読むと既定行が黙って既定から外れるため。
- **既定にする書き込みは、同じ組の旧既定を外してから書く。** 2文になるので `withTransaction` で1つにする
  （[ADR-0005](../adr/0005-write-atomicity-driver.md)）。方面タイプを変える更新では、移動先の組の既定を外す（移動元の組は既定が0行になる）。
  更新は、対象の行が路線に属することを先に確かめてから旧既定を外す（別路線の id での更新で、旧既定だけが外れないようにするため）。
- 同じ組を同時に既定にした書き込みの一方は部分ユニーク違反になり、409 を返す。ロックは取らない
  （二重の既定は制約が拒否し、トランザクションごと戻るので不整合は残らない）。
- **既定行を削除しても、別の行を自動で既定にしない。** どれを昇格させるかを機械的に決められないため。その組は ③ になる。
- フォームは、新規作成で組に既定行がまだ無ければ「既定にする」を選んだ状態で開き、別の既定行があれば
  「保存すると置き換わる」ことを示す。既定行のチェックを外すか方面タイプを変えると、元の組の既定が無くなることを示す
  （保存は止めない）。方面の一覧は既定行に「既定」と表示する。

## 関連

- [ADR-0014](../adr/0014-direction-label-by-default-row.md) — 既定行で解決する理由、既定を選ぶ基準、却下案
- [station-master-model.md](./station-master-model.md)「接続の端点」— 乗換接続が方面を `directionType` で持つこと
