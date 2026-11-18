# 設計: 駅ページ・路線の駅一覧ページのタイトルに駅名・路線名を出す (Issue #8)

参照: [requirements.md](./requirements.md) / [tasks.md](./tasks.md)

## サイト名は `title.template` にまとめる

`apps/web/src/app/layout.tsx`

```ts
title: {
  default: 'ふらっと乗換 | バリアフリー駅・列車案内', // トップ（REQ-4）
  template: '%s | ふらっと乗換',
},
```

各ページは `%s` の部分だけを返す。

## タイトルの組み立て（純関数）

`apps/web/src/features/station/domain/pageTitle.ts`（新規）

```ts
stationPageTitle(stationName: string, lineNames: string[]): string // '渋谷駅 東京メトロ銀座線'
linePageTitle(lineName: string): string                            // '東京メトロ銀座線の駅一覧'
```

- 書式をカッコにしない。「東京さくらトラム（都電荒川線）」のように、中にカッコを持つ路線名があるため
- 路線名は「、」でつなぐ。「日暮里・舎人ライナー」のように、路線名の中に「・」が出てくるため
- 今は複数の路線を持つ駅は0件だが、#82 で粒度が変わっても受けられるようにしておく
- features に line は無い。路線の駅一覧は station の画面の一部なので、同じファイルに置く

## ページ

| ページ | 読み取り | `generateMetadata` |
|---|---|---|
| `stations/[slug]/page.tsx` | `cache(getStationDetail)`（`@/di`） | `stationPageTitle(station.name, stationLines の lineName)` |
| `lines/[slug]/stations/page.tsx` | `cache(getVisibleLineWithStations)` | `linePageTitle(line.name)` |

- React の `cache` は1回のリクエストの中で結果を使い回す。本体と `generateMetadata` が同じ包んだ関数を呼ぶので、
  DB を読むのは1回になる（REQ-5）。`cache` はページのファイルの中で包む。`di.ts` はページ以外からも使えるように、そのままにする
- 結果が null のときは `generateMetadata` でも `notFound()` を呼び、タイトルは `app/not-found.tsx` の `metadata` に任せる（REQ-3）。未公開の駅・路線は、クエリの可視性の述語
  （`publishedStation()` / `visibleLine()`）で null になるので、名前を受け取ること自体が無い

## エラー

| 状況 | タイトル | 本体 |
|---|---|---|
| slug が無い・未公開 | `ページが見つかりません | ふらっと乗換` | `notFound()`（今のまま） |
| DB の読み取りが失敗する | — | `error.tsx`（今のまま。`generateMetadata` も同じ例外で失敗する） |

## テスト

- `pageTitle.test.ts`: REQ-1〜1.3・REQ-2 を固定データで確かめる
- ページと `cache` は単体テストの仕組みが無いため、型チェックとブラウザで `document.title` を見て確かめる

## 恒久知識の振り分け

- `docs/domain/`: 書き換えない。タイトルの書式は画面の都合で、鉄道ドメインのルールではない
- ADR: 作らない。覆すときに明示的な意思決定が要るほどの決定ではない
