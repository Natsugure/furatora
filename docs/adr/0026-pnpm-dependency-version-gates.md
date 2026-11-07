# ADR-0026: 依存の版を選ぶときに pnpm の関所を設け、pnpm は当面 10 系にとどめる

- **ステータス**: Proposed
- **日付**: 2026-11-07
- **決定者**: @Natsugure
- **関連**: [ADR-0008](./0008-environment-database-branch-mapping.md)（Vercel のビルド時にマイグレーションが走る）,
  [ADR-0020](./0020-main-only-long-lived-branch.md)（main へのマージがそのまま本番に出る）

---

## コンテキストと課題

依存パッケージの脆弱性に、これまで何の対策もしていなかった。

### 実測（2026-11-07）

| 確認項目 | 結果 |
|---|---|
| `pnpm audit` | 204 件（low 17 / moderate 89 / high 85 / critical 13） |
| 件数の多いパッケージ | `next` 41、`undici` 32、`brace-expansion`・`minimatch`・`picomatch` 計 約25、`vite`・`vitest` 計 約14、`next-auth`・`@auth/core` 計 7 |
| 直す版のメジャー | すべて今のメジャー版の中で直る（メジャー更新は不要） |
| pnpm の版 | `packageManager: pnpm@10.7.0`。`apps/web/package.json` にも同じ指定が別にあった |
| pnpm の最新 | 10 系 10.34.9（2026-10-25）、11 系 11.28.11、12 系 12.18.0（いずれも 2026-11-05） |
| Vercel の pnpm 11・12 対応 | ドキュメントの対応表には載っている。`package.json#packageManager` を見て版を選ぶ。ただし [vercel/vercel#17434](https://github.com/vercel/vercel/issues/17434) は Open のままで、`nodeLinker: hoisted` と pnpm 12 の組み合わせで install が失敗する報告が残る |

### 課題

- 脆弱性を直すには依存をまとめて上げる必要がある。そのとき、公開直後の侵害された版を引き込む危険が最も高い
  （npm の供給網攻撃は、公開から数時間〜数日のうちに見つかって取り下げられることが多い）
- `package.json` の `^` 指定のままでは、`pnpm add` や lockfile の作り直しのたびに、意図しない新しい版が入りうる
- 10.7.0 は、下記の関所の設定をどれも持たない。書いてもエラーにならず無視されるため、効いているつもりで効かない状態になる
- main へのマージは、ビルド時のマイグレーションを含めてそのまま本番に出る（ADR-0008, ADR-0020）。
  install の不調でビルドが落ちると、本番のデプロイごと止まる

### 制約

- 開発者は1人。依存の更新は今後 Dependabot に任せる予定
- Vercel のビルドは `pnpm-lock.yaml` と `packageManager` で pnpm の版を決める
- ビルドスクリプトを持つ依存は、`esbuild`（許可）と `sharp`・`unrs-resolver`（無視）の3つ

---

## 検討した選択肢

### pnpm の版

1. **10.7.0 のままにする**
2. **10 系の最新（10.34.9）に上げる** ← 採用
3. **12 系に上げる**（codemod で `allowBuilds` などへ移行する）

### 関所の強さ

A. **関所を設けない**（`pnpm audit` と Dependabot だけで対処する）
B. **pnpm の関所を設ける。公開から3日待つ** ← 採用
C. **同じ関所で、待つ期間を1日にする**（pnpm 11 以降の初期値）
D. **同じ関所で、待つ期間を7日にする**

---

## 決定

### 1. pnpm は 10 系の最新に上げ、12 系への移行は別の作業にする

- ルートの `packageManager` を `pnpm@10.34.9` にし、`engines.pnpm` を `>=10.27.0` にする。
  10.27.0 は、決定2の設定（`trustPolicyIgnoreAfter`）がすべてそろう最初の版である
- `apps/web/package.json` の `packageManager` は消す。Vercel は `packageManager` を見て pnpm の版を選ぶため、
  食い違う指定を残さない

### 2. `pnpm-workspace.yaml` に、版を選ぶときの関所を設ける

| 設定 | 値 | 止めるもの |
|---|---|---|
| `savePrefix` | `""` | `pnpm add` で `^` を付けない。版の更新は lockfile の作り直しではなく、明示的な変更で行う |
| `minimumReleaseAge` | `4320`（3日） | 公開から3日たっていない版 |
| `trustPolicy` | `no-downgrade` | 前の版より信頼の度合い（trusted publisher・provenance）が下がった版 |
| `trustPolicyIgnoreAfter` | `43200`（30日） | 公開から30日を過ぎた版には `trustPolicy` をかけない。古い版は、問題があればすでに見つかっているとみなす |
| `blockExoticSubdeps` | `true` | 配下の依存が、レジストリ以外（git・tarball の URL）から入ること |
| `strictDepBuilds` | `true` | `onlyBuiltDependencies` にも `ignoredBuiltDependencies` にも無い依存の install スクリプト（黙って無視せず install を失敗させる） |

### 3. 関所の例外は、版を指定して理由と期限を書く

- 3日を待てない修正版（critical の脆弱性の修正など）だけを、`minimumReleaseAgeExclude` に `名前@版` で載せる。
  理由・載せた日・外す日をコメントで書き、3日たったら外す
- 30日の内側で `trustPolicy` に止まった版は、止まった理由（公開の仕組みの変更など）を確かめてから、
  `trustPolicyExclude` に `名前@版` で載せ、理由をコメントで書く
- 名前だけ（版の指定なし）の例外は作らない。その依存の以後のすべての版から関所が外れるため

### 4. Dependabot の待ち日数を `minimumReleaseAge` とそろえる

Dependabot は pnpm の `minimumReleaseAge` を読まない。`cooldown` を3日にして、
Dependabot が開いた PR が install で失敗しないようにする。

---

## 各選択肢の評価

### 1. 10.7.0 のままにする

- **良い点**: 何も変えずに済む
- **悪い点**: 決定2の設定をどれも持たない。書いても黙って無視される
- **却下理由**: 関所を設けること自体ができない

### 3. 12 系に上げる

- **良い点**:
  - 11 以降は、`minimumReleaseAge`（1日）・`trustPolicy: no-downgrade`・`blockExoticSubdeps`・`strictDepBuilds` が初期値で有効になる
  - いずれ 10 系のサポートは終わるため、どこかで移行は要る
- **悪い点**:
  - `onlyBuiltDependencies`・`ignoredBuiltDependencies` が廃止され、`allowBuilds` への移行（codemod）が要る
  - Vercel での対応は始まったばかりで、関連する Issue が Open のまま残っている
  - 脆弱性対策の依存更新と同時に行うと、ビルドが落ちたときに、原因が pnpm の移行か依存の更新かを切り分けにくい。
    main へのマージがそのまま本番に出るため、切り分けにくさはデプロイの停止に直結する
- **却下理由**: 今回の目的（脆弱性対策）に必要な設定は 10.27 以降で全部そろう。移行の危険を同じ作業に混ぜる理由が無い。
  移行は GitHub Issue に起票し、別の作業として行う

### A. 関所を設けない

- **良い点**: 設定と例外の管理が要らない。新しい修正版をすぐ入れられる
- **悪い点**:
  - `pnpm audit` は**既知の**脆弱性しか見つけない。公開直後の侵害された版は、見つかる前に入る
  - Dependabot は新しい版を自動で PR にするため、関所が無いと、侵害された版を入れる経路をむしろ増やす
- **却下理由**: これから依存をまとめて上げ、更新を自動化する。そのどちらも、公開直後の版を入れる機会を増やす

### C. 待つ期間を1日にする

- **良い点**: 修正版を早く入れられる。pnpm 11 以降の初期値と同じで、移行のときに設定を消せる
- **悪い点**: 週末や祝日をまたぐと、侵害が見つかって取り下げられるまでに1日では足りないことがある
- **却下理由**: 開発者は1人で、毎日依存を上げる必要は無い。修正を急ぐ版は決定3の例外で入れられる

### D. 待つ期間を7日にする

- **良い点**: 侵害が見つかる前に入る危険が、さらに下がる
- **悪い点**: 修正版を入れるたびに例外を書く場面が増え、例外の管理が形骸化しやすい
- **却下理由**: 3日で週末をまたいでも見つかる期間をおおむね確保でき、例外を書く頻度を抑えられる

---

## 結果

### 肯定的な結果

- 公開直後の版、信頼の度合いが下がった版、レジストリ以外から来る配下の依存が、install の時点で止まる
- 新しいビルドスクリプトを持つ依存が入ると install が失敗し、許可するかを必ず判断することになる
- 版の更新は、lockfile の作り直しではなく、`package.json` と lockfile の明示的な変更として PR に残る

### 否定的な結果・受け入れるトレードオフ

- critical の脆弱性の修正版でも、例外を書かない限り公開から3日は入らない
- 例外（`minimumReleaseAgeExclude`・`trustPolicyExclude`）は人の手で外す必要がある。外し忘れると、その版の関所が外れたまま残る
- 12 系の速さと安全側の初期値は、移行まで得られない
- `savePrefix: ""` は今後の `pnpm add` にだけ効く。今ある `^` 指定は、依存を上げるときに外していく

### 見直し条件

- pnpm 12 系へ移行するとき（10 系の更新が止まった、または vercel/vercel#17434 が閉じた）。
  初期値で有効になる設定を消すかどうかと、`allowBuilds` への書き換えを、この ADR を supersede する形で決め直す
- 例外を書く頻度が月に数回を超え、3日の待ちが更新を妨げるようになったとき
- npm のレジストリや pnpm の信頼の度合いの判定方法が変わったとき
