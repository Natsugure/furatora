# 設計: フリースペース・優先席のドア番号を、その号車のドア数の範囲内に限る (Issue #194)

- **参照**: [requirements.md](./requirements.md) / [tasks.md](./tasks.md)

## 方針

範囲の判定を純関数 1 つにまとめ、サーバー（`trainSchema` の `superRefine`）とフォーム（行ごとのエラー）の両方から呼ぶ。
判定を 2 か所に書かないことで、フォームが通したのに API が拒む（またはその逆）食い違いを作らない。

## インターフェース

`apps/admin/src/features/train/domain/equipmentDoors.ts`（Next.js・Drizzle 非依存）:

```ts
export type EquipmentDoorIssue = {
  /** equipments の添字 */
  index: number;
  field: 'carNumber' | 'nearDoor';
  message: string;
};

/** 設備（フリースペース・優先席）の号車とドア番号が、車両構成の範囲内にあるかを確かめる */
export function equipmentDoorIssues(
  carStructure: readonly { carNumber: number; doorCount: number }[] | null | undefined,
  equipments: readonly { carNumber: number; nearDoor: number }[],
): EquipmentDoorIssue[];
```

- 号車が車両構成に無ければ `field: 'carNumber'`、`message: '{n}号車は車両構成にありません'`
- ドア番号が `1..doorCount` の外なら `field: 'nearDoor'`、`message: '{n}号車のドアは1〜{doorCount}番です'`
- 1 つの行に出す issue は 1 つ（号車が無ければドア番号は確かめない）

## schema

`trainSchema` に `.superRefine()` を足し、`freeSpaces`・`prioritySeats` それぞれについて `equipmentDoorIssues` を呼び、
`path: [key, index, field]` で `ctx.addIssue({ code: 'custom', ... })` する（手本は `features/stop-pattern/schema.ts`）。

`nearDoor` に `.min(1)` は付けない。範囲（下限を含む）は `equipmentDoorIssues` だけが決める。zod 4 は、中の項目に issue があっても外側の `superRefine` を走らせる
（2026-10-25 に zod 4.3 で確かめた）ため、`.min(1)` を付けると `nearDoor=0` で同じ行に issue が 2 つ出る。

## フォーム

- 描画のたびに `equipmentDoorIssues(carStructures, freeSpaces)`（優先席も同じ）を計算し、行ごとに `carNumber`・`nearDoor` の入力の `error` に文を渡す。いまの「空欄なら赤枠」（`error={... === ''}`）は残し、文があればそちらを優先する
- ドア番号の `NumberInput` に `max={その号車の doorCount}` を渡す（号車が無ければ渡さない）。`clampBehavior="none"` にして、範囲外の値を上限に丸めない
  - Mantine の既定（`blur`）では、9 を入れて「更新」を押すと、フォーカスが外れた時点で 3 に丸まってエラーが消え、3 が保存される。3 番ドアは実在する別のドアなので、黙って書き換えずにエラーで止める
- フリースペースと優先席で同じ JSX を 2 回書いていたので、行の部品 `EquipmentRows`（`TrainForm.tsx` 内）にまとめた
- 送信時、issue が 1 つでもあれば送信せず、いまの空欄チェックと同じ `notifications.show`（「入力に誤りがあります。」）を出す
- 入力途中の値（空欄の文字列）は、いまの空欄チェックに任せ、`equipmentDoorIssues` には数値の行だけを渡す（添字は元の行のまま）

## エラーハンドリング

| 状況 | API | フォーム |
|---|---|---|
| ドア番号が範囲外 | 400、`path: [key, i, 'nearDoor']` | その行のドア番号の下に文。送信しない |
| 号車が車両構成に無い | 400、`path: [key, i, 'carNumber']` | その行の号車の下に文。送信しない |
| 空欄 | （フォームが送らない） | いまのまま（赤枠と通知） |

## テスト戦略

- `equipmentDoors.test.ts`: 範囲内・上限・0・上限+1・号車が無い・`carStructure` が null・空・添字
- `schema.test.ts`: 範囲外で失敗し、issue の `path` が行を指す。範囲内なら通る
- `TrainForm.test.tsx`: 範囲外の行にエラーの文が出る、そのまま更新を押しても `fetch` を呼ばない、ドア番号の入力に上限がある

## 恒久知識の振り分け

- 「設備のドア番号は、その号車の `1..doorCount` に入る」は、次の Issue 以降も有効なドメインの不変条件。`docs/domain/train-stop-patterns.md` に「列車の設備」として書く
  （列車の車両構成とドアの数え方を扱う文書がこれしか無く、新しいファイルを作るほどの量ではない）
- ADR にはしない（比べて選んだ設計上の決定ではない）
