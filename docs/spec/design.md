# 設計: 乗換の評価カードのタグと補足の文言を見直す (Issue #189)

- **参照**: [requirements.md](./requirements.md) / [tasks.md](./tasks.md)

## 文言

| 対象 | 変更前 | 変更後 | 出る場所 |
|---|---|---|---|
| `call_staff` | 係員を呼ぶ | 係員が設備を操作 | Web タグ・Admin |
| `lift` | 持ち上げる | 持ち上げて運ぶ | Web 補足・Admin |
| `assisted_by_staff` | 駅員複数名の介助 | 係員複数名が車いすを担ぐ | Web 補足・Admin |
| `requiresStaff`（Web） | 係員の対応が必要 | 係員への申し出が必要 | Web タグ |
| `requiresStaff`（Admin の入力） | 係員対応が必要 | 係員への申し出が必要（設備の操作を除く） | Admin |
| `notOfficiallyGuided` | 駅の構内図・公式案内に載っていないルート | 公式案内に無いルート | Web タグ |
| 迂回度 | 最短のバリアフリールート: 一般的なルートより N分長い（行為） | 最短のバリアフリールート: 通常のルートより N分長い | Web 補足 |
| 最も軽い方法 | 最も軽い方法: … | 最も負担の少ない方法: … | Web 補足 |

`as_is`（そのまま通れる）・`fold_and_carry`・`impossible` と、`isOutdoor`・`requiresExitGate` は変えない。

## 実装

- `RouteChips`: `as_is` なら必要な行為のタグを出さない。タグが0個なら `null` を返す。外側の余白は `className` で受ける（空の段に余白を残さないため）。
  段に `role="group"`・`aria-label="通行条件"` を付け、テストから意味で引けるようにする
- `BarrierFreeDetail`: `shortestRequirements` をやめ、`detourText` だけを出す
- 強調（`differingFields`）は変えない

## テスト

`TransferDifficultySection.test.tsx` の文言の期待を書き換え、REQ-1・REQ-2 を足す。強調はクラスでしか確かめられないので、テストにしない（規約で、クラスでは検証しない）。
