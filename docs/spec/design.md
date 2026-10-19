# 設計: ホーム図のフリースペースの `<title>` のハイドレーション不一致を直す (Issue #143)

## 原因

React のサーバー描画（`react-dom-server` の `pushTitleImpl`）は、`<title>` の `children` が
**2つ以上の要素を持つ配列なら `null` とみなし、中身を出力しない**（React 19.2.3 で確認）。

```js
props = Array.isArray(children)
  ? 2 > children.length ? children[0] : null
  : children;
```

修正前の `FreeSpaceBadges` の `<title>` の子は、JSX の式と文字列が並んだ配列
`[carNumber, '号車 ', doorNumber, '番ドア付近のフリースペース', '（全編成）' | '（一部編成）']` だった。

- サーバー: `<title></title>`（空）を出力する
- クライアント: 5つのテキストノードを期待する（エラーの `+ 1` は先頭の号車番号）
- → 不一致。React がツリーをクライアントで作り直す

同じファイルの他の `<title>`（`{banner.text}`・`{facility.typeName}`）は子が式1つなので出力され、不一致にならない。
Issue の見立て（「サーバー側で連結される」）は細部が違い、実際は「空で出力される」。直し方は同じ。

## 修正

`packages/platform-diagram/src/components/diagram/DiagramSvg.tsx` の `FreeSpaceBadges` で、
`<title>` の子をテンプレート文字列1つにする。文言は修正前と同じ
（`号車` の後に半角スペースあり、`（全編成）` の前は無し。JSX の改行は空白にならないため）。
同じ書き方を繰り返さないよう、理由をコメントで添える。

## 同じパターンの調査

`packages/`・`apps/` の `.tsx` にある `<title>` は、`DiagramSvg.tsx` の4か所だけ。複数の子を持つのは `FreeSpaceBadges` だけ。

## テスト

自動テストは足さない。`platform-diagram` の vitest は domain の純関数だけを node 環境で確かめる方針で、
`react-dom` も依存に無い。非公開の `FreeSpaceBadges` のために描画テストの基盤を入れるのは、この修正に対して過大。
代わりに typecheck・lint・既存テスト・build と、dev のブラウザで修正後を確かめる。

## ドメイン知識・決定の振り分け

- `docs/domain/`: 変更なし（ドメインルールは変わらない）
- ADR: なし（覆すときに意思決定が要る設計判断ではない）
