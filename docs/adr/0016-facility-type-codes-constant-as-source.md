# ADR-0016: 設備コードの一覧は定数 `FACILITY_TYPE_CODES` を正とし、DB は CHECK 制約で、seed は型で従わせる

- **ステータス**: Proposed
- **日付**: 2026-10-04
- **決定者**: @Natsugure
- **関連**: [ADR-0015](./0015-shared-domain-packages-and-vocabulary.md)（定数の置き場）,
  [ADR-0011](./0011-transfer-route-facilities-as-set.md), [ADR-0012](./0012-zero-facility-route-as-not-entered.md),
  [`docs/domain/station-master-model.md`](../domain/station-master-model.md)「ルートと設備」節,
  GitHub Issue #139 / PR #137

---

## コンテキストと課題

設備の種類のコード（`elevator` など）の一覧が、次の3か所にあった。一致しているかは、人が確かめるしかなかった。

| 置き場 | 役割 |
|---|---|
| 定数 `FACILITY_TYPE_CODES` | 必要な行為を判定する規則（`REQUIREMENT_BY_FACILITY`）のキー |
| `facility_types` テーブル | 表示名と、`transfer_route_facilities` / `station_facilities` の外部キーの参照先。既存の環境には手書きのマイグレーションで届ける |
| seed（`apps/scripts/src/seed-master-data.ts`） | 新しい環境の初期化 |

定数に無いコードが DB に入ると、Web と Admin は、そのコードを `isFacilityCode` で黙って捨てていた（PR #137 のレビューで指摘）。

- 設備が `[elevator, 新コード]` のルートは `[elevator]` として判定される。実際には段差があるのに、「バリアフリールートあり」と表示されうる
- Admin の駅対編集画面では、そのルートを開いて保存しただけで、新コードの行が DB から消える

利用者に誤った案内を出す方向に倒れる。

## 決定

**設備コードの一覧の正は、定数 `FACILITY_TYPE_CODES`（`@furatora/database/enums`）とする。DB と seed はそれに従う。**

- `facility_types.code` に、定数から組み立てた CHECK 制約 `facility_types_code_known`（`code IN (...)`）を付ける
  - 値は `sql.raw` でリテラルとして展開する。`${}` や `inArray` で埋め込むと、drizzle-kit が `IN ($1, …)` を出力してマイグレーションが壊れる
  - 定数を変えると、`db:generate` が制約を作り直すマイグレーションを出力する
- 子テーブル（`transfer_route_facilities` / `station_facilities`）の `type_code` は、外部キーで `facility_types` を参照する。CHECK は親にだけ付ける
- 3つの列は、Drizzle で `.$type<FacilityTypeCode>()` にする
- ただし、CHECK が保証するのは「DB のコード = **最後にマイグレーションを流したビルド**の定数」までで、
  「稼働中のコードがすべてを知っている」ことではない。読み取りの境界では `isFacilityTypeCode`（`@furatora/database/enums`）で
  知らないコードを見分け、アプリごとに次のように扱う
  - **Web（表示だけ）は、止めずに続ける**: 知らないコードを含むルートは、設備を空（未入力）として扱う（ADR-0012）。
    失うものが無く、乗換案内のページ全体を落とすほどの誤りではないため
  - **Admin（編集画面）は、止める**: 知らないコードを読んだら `UnknownFacilityCodeError` を投げ、ページはその理由を表示して編集させない。
    保存は設備を置き換える（消して入れ直す）ので、捨てて表示すると、保存しただけでその行が DB から消えるため
  - Admin の設備の種類の選択肢からは、知らないコードを黙って除く。選んでも保存の入力検証で拒否されるだけで、DB の行は失われない
- seed の表示名は `Record<FacilityTypeCode, string>` にする。足し忘れはコンパイルエラーになる

定数の置き場（`@furatora/database/enums` を唯一の入口にすること）は ADR-0015 決定3 による。本 ADR は扱わない。

## 却下した選択肢

### PostgreSQL の enum 型にする

- **良い点**: 値の一覧を DB の型として持てる。外部キー用の表が要らない
- **却下理由**:
  - enum の値は、追加はできるが削除できない。削除するには型を作り直す必要がある
  - 列の型が `varchar` から変わる。表示名の置き場（`facility_types.name`）も、別に要る

### アプリの起動時に、定数と `facility_types` の一致を確かめる

- **却下理由**:
  - 起動のたびに DB への問い合わせが増える（サーバーレスで起動が多い）
  - 一致しないとき、起動を止めるか、警告だけで進むかの扱いが曖昧になる

### DB に接続するテストで一致を確かめる

- **却下理由**: CI に DB が無い

### DB（`facility_types`）を正とし、定数をそこから生成する

- **却下理由**:
  - 判定の規則（`REQUIREMENT_BY_FACILITY`）はコードにある。コードを足すには、規則も書く必要がある
  - DB を正にしても、規則の書き忘れは防げない
  - 生成の仕組み（スクリプトと、その実行を忘れない仕組み）が別に要る

### 読み取り側で知らないコードを扱わない（`isFacilityCode` を消す）

- **良い点**: CHECK と外部キーがあれば、型の上では知らないコードは来ない。分岐が減る
- **却下理由**: Web と Admin は別々にデプロイされ、マイグレーションはビルドの中で流れる。
  コードを足したビルドの Admin が先に保存すると、古い Web が知らないコードを読む。
  そのとき `REQUIREMENT_BY_FACILITY[code][persona]` が TypeError になり、駅のページが 500 になる

### 知らないコードを Web と Admin で同じように扱う

- **一律に未入力扱いにする（捨てる）**: Admin では、保存しただけでその行が消える。直前のデプロイの誤りで欠けた定数など、
  本来失われてほしくないデータを、何が起きたかわからないまま壊す
- **一律に止める**: Web では、表示だけで失うものが無いのに、乗換案内のページ全体が見られなくなる
- 失うものがあるか（上書き保存の元になるか）で分ける

### `requirementFor` が知らないコードに `null` を返す

- **却下理由**: `requirementFor` は `transfer-difficulty` にあり、Admin のプレビューからも呼ばれる。
  そこを緩めると、Admin で知らないコードが黙って通る道ができる。扱いはアプリごとの読み取りの境界で決める

### 子テーブルにも CHECK を付ける

- **却下理由**:
  - 子は外部キーで `facility_types` を参照しており、親の CHECK で十分である
  - 同じ一覧を3つの制約に持つと、定数を変えたときのマイグレーションが3倍になる

## 影響

- 定数に無いコードは、DB に入らない
  - 未知のコードによる黙った誤判定と、Admin の保存での行の消失が起きなくなる
- Admin の駅レイアウトの保存は、未知のコードを、外部キーのエラー（500）ではなく入力検証（400）で拒否する
  - そのため、`platform-diagram` の `FacilityDTO.typeCode` から Admin のクライアントの状態（`FacilityDraft`）まで、型を `FacilityTypeCode` にした
- **残るずれ**: 次の2つである。どちらも黙って誤判定はせず、データも消えない
  - 定数にコードを足し、`facility_types` への INSERT のマイグレーションを書き忘れた場合。そのコードを保存しようとすると外部キーのエラーになる。
    手順は `packages/database/src/enums/facility.ts` のコメントに書いた
  - デプロイの途中や、DB を共有する別ビルドで、稼働中のコードが知らないコードが DB にある場合。
    Web はそのルートを未入力として表示し、Admin はその駅対・駅レイアウトの編集画面を開かせない（決定を参照）
- 設備の種類を足すマイグレーションは、次の2つになる
  - CHECK の作り直し（`db:generate` が出力する）
  - 手書きの INSERT

## レビュー

次のいずれかが起きたら再評価する。

- 設備の種類を、コードを変えずに管理画面から足したくなった（定数を正にする前提が崩れる）
- `db:push` や `db:generate` が、この制約で毎回差分を出すようになった（drizzle-kit の更新など）
