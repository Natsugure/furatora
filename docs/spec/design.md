# 設計: ホーム図の設備アイコン欠けとガイド線の重なり

要件は [requirements.md](./requirements.md)。座標系の恒久的な規則は
[platform-coordinate-system.md](../domain/platform-coordinate-system.md) に反映済み。

## 変更① 設備アイコンの張り出しを描画範囲に含める

`domain/geometry.ts` に `FACILITY_ICON_SIZE`(6m) / `FACILITY_ICON_PITCH`(7m) /
`facilityIconHalfExtent(count)` を置き、`computeBounds()` と `DiagramSvg` が共用する。

| 設備件数 | 片側の張り出し |
|---|---|
| 0 | 0 |
| 1 | 3.0m |
| 2 | 6.5m |
| 3 | 10.0m |

`computeBounds()` のシグネチャは不変（`cells[].facilities` は既存の引数型に含まれる）。

## 変更② 引き出し線の迂回

### データフロー

```
layoutConcoursePlates()
  └ assignLanes()            段の割り当て（既存）
  └ routePlates()            px→割合に直して routeLeaders() を呼ぶ
      └ routeLeaders()       lane ごとに直進 / 左右へ迂回 / 背面 を決める（純関数）
ConcoursePlateRow
  └ 縦線レイヤ(z0) / プレート(z1) / 余白帯の横線レイヤ(z2) を lane ごとの grid に重ねる
```

### インターフェース

```ts
type LeaderSegment = { enterFraction: number; exitFraction: number; passesBehindPlate: boolean };
type LeaderRoute = { segments: LeaderSegment[]; arrivalFraction: number };
routeLeaders(plates: RoutablePlate[], clearanceFraction: number): LeaderRoute[]
```

`ConcoursePlateGroup.route` に載せる。`segments.length === lane`。
`arrivalFraction` は自レーン上端への到達位置で、自レーンの余白帯で `anchorX` へ戻す。
見積り幅（`startPx`/`endPx`）自体は公開面に出さない。

### 迂回アルゴリズム

各レーンで、現在のxが箱から `clearance`（= `PLATE_GAP_PX / 2`）以上離れていれば直進。
ぶつかる場合は塞がり区間を左右へ乗り越えた候補を求め、範囲内かつ空きの側のうち
移動量が小さい方を採る。どちらも不可なら動かさず `passesBehindPlate`。

### 決定記録

**決定**: 迂回させる（背面に隠す・薄くする案は不採用）| **理由**: 線が隠れないため
「どの設備がどの出口か」を図だけで追跡できる（開発者選択）| **トレードオフ**: 経路が
幅の見積りに依存するため、外れた場合に備えて `z-index` の保険を二重に持つ |
**影響**: `concourseLayout.ts` と `ConcoursePlateRow.tsx` に手が入る |
**レビュー**: 実データで迂回線どうしの交差が問題になった場合。

ADR 化はしない（覆すのに明示的な意思決定を要さない表示上の判断のため）。

### エラーハンドリング

| 状況 | 応答 |
|---|---|
| `canvasWidthPx <= 0` | 迂回せず全レーン直進の経路を返す |
| 両側とも迂回不能 | 位置を動かさず `passesBehindPlate: true`。`z-index` でプレートが前面 |
| 見積り幅が実幅より小さい | 線がプレート縁に接近しうるが、`z-index` によりプレートの文字は覆われない |

### 恒久知識の振り分け

- `docs/domain/platform-coordinate-system.md` へ反映済み（描画範囲のアイコン張り出し、
  引き出し線の迂回と `z-index` 規則）
- ADR は新設しない

## テスト戦略

`geometry.test.ts`（張り出し）・`leaderRoute.test.ts`（経路）・
`concourseLayout.test.ts`（`route` の整合）。描画（CSS の重なり）は node 環境では
検証できないため目視確認とする。
