# 設計: ホーム図の編集で、編成の先頭・末尾を動かすと編成全体を平行移動する (Issue #201)

- **参照**: [requirements.md](./requirements.md) / [tasks.md](./tasks.md)

## 方針

`editDraft.ts` の `moveCarEdge` を、平行移動の `shiftConsistByEdge` に置き換える。呼び出し元（`StationLayoutEditor` のハンドラ）は関数を差し替える。
コンポーネントの props `onMoveCarEdge` / ハンドラ `handleMoveCarEdge` は、号車の端を動かす（号車の長さを変える）と読めるため、ドメイン関数に揃えて `onShiftConsist` / `handleShiftConsist` に改名する。シグネチャ `(edge, x)` は変えない。

## インターフェース

```ts
/**
 * 編成の外端（edge）が x に来るよう、全号車を同じ差分だけ動かす。号車の長さと境界の共有は保たれる。
 * edge が外端でなければ無変更で返す。
 */
export function shiftConsistByEdge(
  draft: PatternDraft,
  edge: { carNumber: number; side: 'start' | 'end' },
  x: number,
): PatternDraft;
```

- 外端かどうかの判定は、いまの `moveCarEdge` と同じく `freeEdgeSides(isDoorOrderReversed(cars))` で行う
- 差分を足した各値は `roundToDecimal2`（`@furatora/platform-diagram/domain`）で丸める
- `opts.minCarMeters` は要らなくなる（号車の長さを変えないため）。`MIN_CAR_METERS` は `moveCarBoundary` だけが使う

## スナップの候補

`DiagramEditLayer.tsx` の外端の 2 つのハンドルの `candidates` を `snapCandidates([], physicalLength)`（ホーム端の 0 と `physicalLength` だけ）にする。
編成自身の境界・ドアはドラッグ中に一緒に動くので、候補にすると「自分のドアに外端を合わせる」という意味の無い吸着になる。
内側の境界のハンドル・アクセス点のハンドルの候補は変えない。

## データフロー

ハンドル・数値入力 → `onShiftConsist(edge, x)` → `handleShiftConsist` → `shiftConsistByEdge` → 未保存の draft → 図・インスペクタ。保存の経路は変わらない。

## テスト戦略

- `editDraft.test.ts`: `moveCarEdge` の describe を `shiftConsistByEdge` に書き換える（非反転・反転で先頭・末尾、外端でない edge は無変更、小数の丸め）
- `DiagramEditLayer.test.tsx`: 先頭のハンドルを自分のドアの中心の近くへ動かすと、ドアにではなくグリッドにスナップする
- `StationLayoutEditor.test.tsx`: インスペクタの先頭の数値入力を変えると、全号車の表示が動く（結合の確認。既存のテストに同じ形のものがあれば、それに足す）
- e2e: 既存の反転編成のドラッグのテストは、development に表参道（半蔵門線）のホームが無く、この PR の前から落ちている（#198 で確かめた）。この PR では直さない

## 恒久知識の振り分け

- 「外端のハンドル・数値入力は編成全体を平行移動する」は図上編集の現在の振る舞い。`docs/domain/platform-coordinate-system.md`（図上編集の節）と `train-stop-patterns.md`（`moveCarEdge` の記述）を上書きする
- ADR にはしない（ADR-0010 は編集レイヤーの置き場所の決定で、ハンドルの動きまでは決めていない）
