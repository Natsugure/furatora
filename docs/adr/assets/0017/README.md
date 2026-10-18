# Soft Rose の見本（ADR-0017・0018・0019 の添付）

ADR-0017〜0019 を決めたときの、デザインキャンバスのスナップショット。
**決定時点の見本であり、書き換えない。** 現在のトークンと使い方は `docs/domain/design-system.md` を見る。

- 作成日: 2026-10-18
- 元のキャンバス: <https://claude.ai/artifact/9afF4atBJmkWY7MUJnDjxg>（非公開。開発者の claude.ai アカウントでのみ開ける）。
  リンクが切れても、このディレクトリだけで内容が分かるようにしてある

## ボード

| 画像 | 内容 | 主な関連 |
|---|---|---|
| [01-design-system.png](./01-design-system.png) | 色・書体・形・部品の一覧 | ADR-0017・0018 |
| [02-home.png](./02-home.png) | トップ（駅をさがす） | ADR-0017 決定4 |
| [03-line.png](./03-line.png) | 路線の駅一覧 | ADR-0017 決定4 |
| [04-station-stroller.png](./04-station-stroller.png) / [04-station-wheelchair.png](./04-station-wheelchair.png) | 駅の詳細（ベビーカー／車いすを選んだとき） | ADR-0018 決定1 |
| [05-platform.png](./05-platform.png) | ホーム図 | ADR-0018 |
| [06-app-icon.png](./06-app-icon.png) | アプリアイコン | ADR-0019 |

## 見本と実装の範囲の違い

見本には、Issue #166 では作らないものも描いてある。見本にあることは、実装する約束ではない。

- 路線の駅一覧で、各駅の乗換路線を出すこと（03）
- ホーム図の縦向きのレイアウトと、優先席の位置（05）
- 画面の文言・駅名・路線は、見た目を確かめるための例

## ソース（`source/`）

キャンバスのボードの HTML（`*.dc.html`）。

- キャンバス専用の実行系の代わりに、ボードが使う構文だけを扱う `source/preview.js` を読み込むよう書き換えてある
- 設備のアイコンは `apps/web/public/icons/` を相対パスで参照している
- 書体は Google Fonts から読み込むため、表示にはネットワークが要る

ブラウザで `source/*.dc.html` を直接開けば表示できる。PNG は次のように書き出した（幅・高さはボードの大きさ）。

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars \
  --force-device-scale-factor=2 --virtual-time-budget=8000 \
  --window-size=390,1240 --screenshot=04-station-wheelchair.png \
  "file://$PWD/source/Station.dc.html#state={\"mode\":\"wheelchair\"}"
```

| ボード | 大きさ |
|---|---|
| Main | 1280×1720 |
| Home | 390×980 |
| Line | 390×1120 |
| Station | 390×1240 |
| Platform | 390×1520 |
| Icons3 | 880×620 |
