# ADR-0015: アプリ間で共有するロジックをドメイン単位の packages に置き、共有する語彙は `@furatora/database/enums` に置く

- **ステータス**: Proposed
- **日付**: 2026-10-02
- **決定者**: @Natsugure
- **関連**: [ADR-0001](./0001-layer-structure.md)「`packages/core` の抽出について」「`@furatora/database/enums` の扱い」,
  [ADR-0002](./0002-dependency-inversion-ports.md), [ADR-0003](./0003-read-write-separation.md),
  [ADR-0010](./0010-platform-diagram-package-edit-layer.md), GitHub Issue #152 / #138 / #139

---

## コンテキストと課題

`apps/web` と `apps/admin` が同じ規則を使う場面が増え、共有するロジックを `packages/` に置く運用ができあがっていた。
ただし、どれも個別の判断で作られており、一般的な方針として決めたものは無い。

| パッケージ | 中身 | 作った根拠 |
|---|---|---|
| `platform-diagram` | ホーム図の純粋関数と描画コンポーネント | ADR-0010（Issue #95 の個別判断） |
| `transfer-difficulty` | 乗換難易度・方面ラベルの解釈規則（純粋関数） | PR #133 の決定表のみ |

この状態で、次の3つの問題が起きていた。

1. **既存 ADR とのずれ**: ADR-0001 は「`packages/core` への物理的な抽出は `apps/api` が必要になるまで行わない」としている。実際には、`apps/api` が無いまま、ドメインごとのパッケージが2つ作られた
2. **語彙の重複**: 両パッケージは、ESLint で `@furatora/database/*` を丸ごと禁止していた。このため、型しか持たない `enums` も import できなかった。その結果、同じ語彙を自前で書き写していた
   - `transfer-difficulty` の `DirectionType`。一致を admin の型検査で守っていた
   - `platform-diagram` の `'top' | 'bottom'` が3か所。`PlatformSide` と同じ値
3. **置き場所の規則が無い**:
   - #138 は、admin と web の query 層に書き写された規則を、パッケージに集めたい
   - #139 は、設備コードの定数（`FACILITY_TYPE_CODES`。現在は `transfer-difficulty`）を、DB の CHECK 制約と seed の正とするため、`@furatora/database` 側から参照したい
   - 何をどこに置くかを決めないと、Issue ごとに判断がばらつく

## 決定

### 決定1: web と admin で共有するロジックは、ドメイン単位のパッケージに置く

- 2つ以上のアプリが同じ規則を使うときは、アプリの間で書き写さず、`packages/<ドメイン>` に置く
- パッケージの単位は**ドメイン**とする（例: `platform-diagram`、`transfer-difficulty`）
- 技術レイヤーでは分けない。`utils` のような、何でも入れてよいパッケージは作らない

### 決定2: パッケージに入れてよいのは、DB と Next.js に依存しないものだけ

- **入れてよいもの**: 純粋関数、型、表示用の React コンポーネント
  - React を許すかはパッケージごとに決める。`platform-diagram` は許可、`transfer-difficulty` は禁止
- **入れないもの**:
  - DB アクセス（`@furatora/database` の `client` / `schema` / `tx`、`drizzle-orm`）
  - Next.js
  - Query Service と Repository
- Query Service と Repository は、ADR-0002 / 0003 のとおり各アプリのポートの実装として置く
- アプリ間で query 層の処理が重複するときの切り分け:
  - DB の行をドメインの値に組み立てる**純粋な部分だけ**をパッケージに移す
  - SQL は各アプリに残す
- これらの制約は、各パッケージの `eslint.config.mjs` の `no-restricted-imports` で機械的に守る

### 決定3: 共有する語彙は `@furatora/database/enums` に1つだけ置く

- 語彙とは、DB の値とドメインの両方が使う、列挙の型と定数のこと（`DirectionType`、`PlatformSide` など）
- ドメインのパッケージは、`@furatora/database` のうち **`enums` だけ** import してよい
  - ESLint の禁止パターンは、`enums` 以外の `@furatora/database` と `drizzle-orm` に一致する正規表現で書く
  - `group` の `!` による除外は使えない。親（`@furatora/database`）を除外すると、その配下は再び含められないため
- `enums` は、**Drizzle にも実行時の外部パッケージにも依存しない**状態を保つ
  - 型に加えて、`as const` の配列のような実行時の定数は置いてよい（#139 の `FACILITY_TYPE_CODES` を想定）
- ドメインのパッケージは、語彙を自前で書き写さない
  - 利用側の import を変えないために、再 export することは許す（`transfer-difficulty` の `DirectionType`）

### 決定4: 新しいパッケージは、既存のパッケージのドメインに当てはまらないときだけ作る

- 新しく作る条件は次の2つを両方満たすときである
  - 2つ以上のアプリが使う
  - 既存のパッケージのドメインに当てはまらない
- 当てはまるときは、既存のパッケージに足す
- 1つのアプリだけが使うロジックは、そのアプリの `features/*/domain` に置く（ADR-0001）

### 決定5: ADR-0001 との関係

ADR-0001 の「`packages/core` の抽出について」は、**`features` 層を丸ごと抽出すること**を `apps/api` が必要になるまで見送った決定である。
本 ADR が扱うのは、アプリ間で実際に共有が生じた純粋なロジックを、その都度ドメイン単位で切り出すことであり、両者は対象が異なる。

- ADR-0001 は置き換えない（supersede しない）
- ADR-0001 の「`@furatora/database/enums` の扱い」は、apps から `enums` を使うことを例外として認めていた。本 ADR は、この例外をドメインのパッケージにも広げる

## 却下した選択肢

### 共有ロジックを1つのパッケージ（`packages/core` や `packages/domain`）にまとめる

- **良い点**: 設定ファイル（package.json・tsconfig・eslint・vitest）が1組で済む
- **却下理由**:
  - 許す依存がドメインごとに違うのに、1つのパッケージでは表しにくい。React を許す描画と、許さない解釈規則が同じ ESLint の設定に入る
  - ドメインの間の依存も、パッケージの境界として見えなくなる
  - Turborepo のキャッシュが、無関係なドメインの変更でも無効になる
  - ADR-0001 が `apps/api` まで見送った「丸ごとの抽出」に近い

### 各アプリに書き写し、一致を型検査やレビューで守る

- **#125 で実際に取ったやり方**
- **却下理由**:
  - 規則を変えるとき、2つのアプリを直す必要がある
  - 写した側には単体テストが無い（#138）
  - 型検査で守れるのは型の一致までで、関数の振る舞いの一致は守れない

### web が admin の `features` を直接 import する

- **却下理由**:
  - アプリがアプリに依存することになる
  - admin の認証や Mantine への依存が web に入り込む

### 語彙の専用パッケージ（例: `@furatora/vocabulary`）を作る

- **良い点**: 依存関係が最もきれいになる。database もドメインのパッケージも、語彙のパッケージだけに依存する
- **却下理由**:
  - `enums.ts` は、今も Drizzle に依存しない末端のファイルである。新しいパッケージを作っても、得られるのは依存の見た目の整理だけになる
  - 一方で、パッケージと設定ファイルが1組増える
  - `enums` が Drizzle や実行時の依存を必要とするようになったときに、改めて検討する（レビュー条件）

### 語彙を、それを解釈するドメインのパッケージに持たせ、database がドメインのパッケージに依存する

- **良い点**: インフラがドメインに依存する向きで、クリーンアーキテクチャに沿う
- **却下理由**:
  - `DirectionType` や `PlatformSide` のように、どのドメインのパッケージにも属さない語彙の置き場が別に要る
  - database が複数のドメインのパッケージに依存するようになる

## 影響

- `platform-diagram` と `transfer-difficulty` の `package.json` が、`@furatora/database` に依存する
  - workspace のリンクであり、実際に import するのは `enums` だけである
  - バンドルに Drizzle は入らない
- `DirectionType` と `PlatformSide` の定義が `enums` の1か所になる
  - admin の `DirectionTypesMatch` から、2つの `DirectionType` の一致を見る検査を外す
- #139 は、`FACILITY_TYPE_CODES` を `enums` に移し、`transfer-difficulty` がそこから import する形で進められる
- #138 は、決定2 の切り分けに従う。純粋な部分を `transfer-difficulty` に移し、SQL は各アプリに残す
- `packages/database/CLAUDE.md` に、`enums` の制約（Drizzle と実行時の依存を持たない）を書く

## レビュー

次のいずれかが起きたら再評価する。

- `enums` が、Drizzle か実行時の外部パッケージを必要とするようになった
  - 語彙の専用パッケージへの切り出しを検討する
- `apps/api` が必要になった
  - ADR-0001 の `packages/core` の抽出と合わせて、パッケージの構成を見直す
- 3つ目以降のパッケージを作るとき、決定4 の条件で判断に迷った
