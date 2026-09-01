# ADR-0008: 環境ごとに Neon ブランチを1対1で対応させ、マイグレーションをビルド時に適用する

- **ステータス**: Accepted
- **日付**: 2026-09-01
- **決定者**: @Natsugure
- **関連**: [ADR-0004](./0004-neon-branch-dev-environment.md)（接続先の表を拡張する）, [ADR-0005](./0005-write-atomicity-driver.md)

---

## コンテキストと課題

[ADR-0004](./0004-neon-branch-dev-environment.md) は「どの環境がどの Neon ブランチに
つながるか」を決めたが、その表に **Vercel の Preview 環境が無かった**。
また **スキーマをどの時点で適用するか**を決めていなかった。
この2つの欠落が、以下の形で顕在化した。

### 実測された障害（2026-08-31）

PR #59（Issue #56 Phase 1）の Vercel Preview Build が失敗した。

```
Seed failed: NeonDbError: column "ekidata_company_cd" of relation "operators" does not exist
  code: '42703'
```

Neon の実データを確認した結果は以下である。

| 確認項目 | 結果 |
|---|---|
| プロジェクトのブランチ | `main` と `development` の2本のみ。preview 用は0本 |
| `main` の `operators.ekidata_company_cd` | 存在しない |
| `main` の `drizzle.__drizzle_migrations` | 0000〜0003 のみ。0004 が未適用 |
| プロジェクトのオーナー org | `Vercel: natsugure's projects`（Vercel-Managed Integration） |

Vercel-Managed Integration は Preview Branching をサポートしているが、
**有効化されていなかった**。結果として Production / Preview / Development の
すべてに `main` の `DATABASE_URL` が注入されていた。

### 問題1: Preview デプロイが本番DBへの書き込み権限を持っていた

`apps/web` の build が `pnpm --filter scripts seed && next build` であったため、
**Preview ビルドが本番の `facility_types` / `operators` に insert していた**。
`onConflictDoNothing` により実害は出ていないが、経路としては通っている。
`apps/admin` を同じ構成でデプロイした場合、Preview の管理画面から
本番マスタデータを編集できることになる。

### 問題2: スキーマを変える PR の Preview は必ず落ちる

Drizzle の `insert().values()` は**スキーマ定義上の全列**を INSERT 文に並べる
（未指定列は `default`）。値を渡していない新列でも文に載るため、
**列をスキーマに追加した時点で、その列が無いDBへの insert はすべて壊れる**。
Preview が本番DBを見ている限り、これは構造的に避けられない。

### 問題3: マイグレーションを適用する経路が存在しない

`db:migrate` はどの GitHub Actions workflow にも、Vercel のビルドにも
組み込まれていない。完全に手動運用であり、**適用忘れを検出する手段が無い**。

### 制約

- 開発者は1人。ブランチ運用は git-flow（`feature/*` → `develop` → `main`）
- Neon 無料プラン: **ブランチ上限10本**、履歴保持6時間、compute は 0.25 CU 固定
- Vercel のデプロイ保持期間は既定180日。Vercel-Managed Integration の
  preview ブランチ削除は**Git ブランチの削除ではなくデプロイの削除に連動する**
- DBに個人情報は無い。認証（Auth.js）はセッションをDBに保存していない
  （`packages/database/src/schema.ts` に users / sessions 相当のテーブルが無い）

---

## 検討した選択肢

1. **手動適用を続ける**（現状維持）
2. **Preview の接続先を `development` ブランチに向ける**
3. **preview 専用の固定ブランチを1本用意する**
4. **Preview Branching を有効化し、マイグレーションをビルドコマンドで適用する** ← 採用

---

## 決定

**選択肢4を採用する。**

### 環境と Neon ブランチの対応（ADR-0004 の表を置き換える）

| 環境 | Neon ブランチ | 生成方法 | 寿命 |
|---|---|---|---|
| Production（Vercel / `main`） | `main` | 正 | 恒久 |
| Preview（Vercel / PRごと） | `preview/<git-branch>` | `main` から CoW で自動生成 | PR クローズ時に削除 |
| ローカル開発 | `development` | `main` から手動作成 | 恒久（壊したら作り直す） |
| 計測・実験 | 使い捨てブランチ | 都度作成 | 実験終了時に削除 |

`develop` へのマージも Preview デプロイであるため、`preview/develop` が
生成され、これが実質のステージング環境になる。
**ローカル開発用の `development` とは別物である。**

### マイグレーションの適用時点

Vercel の Build Command を上書きする。

```bash
pnpm -w run db:migrate && turbo run build
```

- **`-w` が必要である。** Vercel は Build Command を Root Directory
  （web のプロジェクトでは `apps/web`）をカレントディレクトリとして実行する。
  `db:migrate` はワークスペースルートの `package.json` にしか無いため、
  `-w` で明示的にルートを指す。素の `turbo run build` が動くのは、
  turbo が Root Directory からフィルタを自動推論するためであり、
  これも cwd が `apps/web` であることと整合する
- **`turbo run build` の外に置く。** 副作用のある操作を turbo のキャッシュ対象に入れない
- Preview では preview ブランチに、Production では `main` に適用される。
  **環境ごとの分岐を書かずに適用先が正しくなる**のが、この配置の要点である
- マイグレーションは直結エンドポイント（`DATABASE_URL_UNPOOLED`）で流す。
  Vercel が注入する `DATABASE_URL` は PgBouncer 経由のプール接続である。
  Neon は Drizzle Kit のマイグレーションについて直結の使用を指示している
  （[Drizzle ガイド](https://neon.com/docs/guides/drizzle#get-your-connection-string) /
  [Connection pooling](https://neon.com/docs/connect/connection-pooling#when-to-use-pooled-vs-direct-connections)）

### ビルドはDBに書き込まない

`apps/web` と `apps/admin` の `build` から seed を外す。preview ブランチは
`main` のコピーオンライトであり**最初からデータが入っている**ため、
「デプロイ先が空かもしれない」という seed の存在理由そのものが消える。

seed は新規ブランチを作った直後の手動操作（`pnpm --filter scripts seed`）に戻す。

### マイグレーションを実行するのは web のプロジェクトだけとする

`apps/web` と `apps/admin` は別々の Vercel プロジェクトとしてデプロイされており、
同じ Neon プロジェクトを共有する。したがって同一の git ブランチに対する
preview ブランチは**両プロジェクトで共有される**。

両方の Build Command に `db:migrate` を入れると、1回の push で2つのビルドが
同時に同じブランチへマイグレーションを流す。drizzle-kit はジャーナルにより
冪等だが同時実行は別問題であり、後発の `CREATE TABLE` が
`already exists` で落ちてビルドが失敗する。データは壊れないが、
毎回どちらかのデプロイが赤くなる。

**したがって `db:migrate` は `apps/web` のプロジェクトにのみ入れる。**
公開サイトを止められないのは web 側であるため、確実にスキーマが揃っている
必要があるのも web である。

#### 「web のビルドがスキップされる」ことは起こらない

両プロジェクトとも Vercel の「Skipping unaffected projects」が既定
（Automatic）で有効であり、変更が影響しないプロジェクトのビルドは
スキップされる。しかし Vercel は以下のいずれかでプロジェクトを
「変更あり」と判定する（[Using Monorepos](https://vercel.com/docs/monorepos#skipping-unaffected-projects)）。

1. プロジェクトのソースコードが変更された
2. **プロジェクトの内部依存が変更された**
3. ロックファイルの変更がそのプロジェクトの依存にのみ影響する

マイグレーションは必ず `packages/database`（`src/schema.ts` と `drizzle/`）を
変更する。これは `apps/web` / `apps/admin` の**両方が
`package.json` で明示的に依存している内部パッケージ**である。
したがって、未適用のマイグレーションが存在する push では web が必ずビルドされる。
**「マイグレーションが待っているのに web がスキップされる」状態は生じない。**

逆向き（web だけがビルドされ admin がスキップされる）は起こりうる。
その場合、稼働中の admin が新しいスキーマに直面するが、
これは下記「破壊的マイグレーションは二段階デプロイとする」が扱う範囲と同じであり、
追加のみの変更であれば影響しない。

### 破壊的マイグレーションは二段階デプロイとする

ビルド時に migrate が走るということは、**新しいコードが公開される前にDBが変わる**
ということである。追加のみの変更なら稼働中の旧デプロイは無事だが、
`DROP COLUMN` は旧デプロイを即座に壊す。したがって列やテーブルの削除は分割する。

1. その列を読まないコードをデプロイする
2. 次のデプロイでマイグレーションが列を落とす

### preview ブランチの削除

PR クローズ時に `neondatabase/delete-branch-action` で削除する
（`.github/workflows/cleanup-neon-preview.yml`）。
Vercel 側の自動削除はデプロイ保持期間（既定180日）に連動するため、
**ブランチ上限10本に先に到達する。**

---

## 各選択肢の評価

### 選択肢1: 手動適用を続ける

- **良い点**: 変更コストゼロ。適用の瞬間を人が完全に制御できる
- **悪い点**:
  - 問題1〜3がすべて残る。Preview は検証環境として機能しない
  - 適用忘れが**本番デプロイの失敗としてしか現れない**。
    実際 2026-08-31 の障害はこの形で現れた
- **却下理由**: 今回の障害の原因そのものであり、再発防止にならない

### 選択肢2: Preview を `development` ブランチに向ける

- **良い点**: 設定変更が1箇所で済む。本番DBからは切り離される
- **悪い点**:
  - **同時に開いている PR 同士が同じDBを共有する。**
    一方のスキーマ変更が他方の Preview を壊す
  - `development` はローカル開発でも使うため、Preview の実行が
    手元の開発を壊す（逆も同様）
  - `development` は `main` からドリフトしており、本番相当の検証にならない
    （2026-08-31 時点で `platforms` が 14 対 18、`lineDirections` が 52 対 34）
- **却下理由**: 「Preview が本番相当であること」と「PR 間で独立していること」の
  両方を失う。問題1しか解決しない

### 選択肢3: preview 専用の固定ブランチを1本用意する

- **良い点**: ブランチ数が予測可能で、上限10本に当たらない。
  `development` とローカル開発を汚さない
- **悪い点**: 選択肢2と同じく **PR 間で共有される**。
  Phase 2 以降で複数の PR が並行するようになると、
  一方の master-import 実行が他方の Preview のデータを書き換える
- **却下理由**: 独立性が無い。かつ、これを維持するコストは選択肢4と大差ない

### 選択肢4: Preview Branching + ビルド時マイグレーション（採用）

- **良い点**:
  - Preview が「**本番と同じデータ + その PR のスキーマ**」になる。
    これが Preview に期待される唯一の状態である
  - PR ごとに独立する。CoW のため生成は即時で、ストレージは差分のみ
  - **適用先の分岐をコードに書かずに済む。** Vercel が注入する
    `DATABASE_URL` に従うだけで、Preview は preview ブランチ、
    Production は `main` に適用される
  - 本番への適用が `develop` → `main` のリリースに自動的に揃う。
    「今回だけ手動」という一貫しない前例を作らない
  - 適用忘れが構造的に発生しなくなる
- **悪い点**:
  - **マイグレーションがビルドより先に走る。** ビルドが後段で失敗すると、
    DBだけが変更された状態が残る
  - 破壊的変更に二段階デプロイの規律が要る（上記）
  - preview ブランチが無料プランの上限を圧迫する。掃除の自動化が必須になる

---

## 結果

### 肯定的な結果

- Preview デプロイから本番DBへの書き込み経路が消える
- スキーマ変更を含む PR が、本番相当のデータに対して実際に動く形で検証できる
- マイグレーションの適用忘れが構造的に起きなくなる
- ビルドがDBに依存しなくなる（`next build` は `force-dynamic` と
  `generateStaticParams` 不使用のため、ビルド時にDBを読まない）

### 否定的な結果・受け入れるトレードオフ

- **ビルド失敗時に、マイグレーションだけが適用された状態が残りうる。**
  追加のみの変更では無害であり、破壊的変更は二段階デプロイで回避する。
  この規律を守れなかった場合の代償は本番停止であるため、
  ルート `CLAUDE.md` の禁止事項と `README.md` にも同じ規則を置く
- **preview ブランチが本番データのコピーになる。**
  現在DBに個人情報は無いため許容する。将来 DB に個人情報を置く場合、
  この決定は見直しが必要になる
- ブランチごとに compute が起動するため、無料枠の compute 時間を追加で消費する
- `preview/develop` は一度作られると `main` から徐々にドリフトする。
  本番相当に戻したい場合はブランチを削除して作り直す

### 適用範囲

本ADRは `apps/web` と `apps/admin` の2つの Vercel プロジェクトを対象とする。
Preview Branching は**両方で有効化する**。とくに `apps/admin` は
マスタデータを書き換えるアプリであり、Preview が本番DBに接続している状態は
web より危険である。

`db:migrate` を入れるのは web のプロジェクトのみである
（上記「マイグレーションを実行するのは web のプロジェクトだけとする」）。

### 見直し条件

- DB に個人情報を保存するようになったとき
  （preview ブランチへの本番データ複製を再評価する）
- Vercel プロジェクトが3つ以上になったとき、または
  「Skipping unaffected projects」を無効化・迂回する設定を入れたとき
  （マイグレーションの実行主体が web だけである前提が崩れる）
- 開発者が複数人になり、無料プランのブランチ上限10本が現実的な制約になったとき
- Vercel または Neon が、ビルドとは独立したマイグレーション実行の仕組み
  （デプロイ前フック等）を提供したとき。
  「ビルドの一部として流す」ことの唯一の理由は、他に適用点が無いことである
