# タスク: ホーム図の設備アイコン欠けとガイド線の重なり

- [x] T1 ブランチ `fix/diagram-icon-clip-and-leader-routing` を作成
- [x] T2 `geometry.ts` にアイコン寸法定数と `facilityIconHalfExtent()` を追加、`computeBounds()` を更新
- [x] T3 `DiagramSvg.tsx` のローカル定数を削除し、共用定数へ置換（依存: T2）
- [x] T4 `domain/leaderRoute.ts` を新規作成し barrel に追加
- [x] T5 `concourseLayout.ts` の `ConcoursePlateGroup` に `route` を追加（依存: T4）
- [x] T6 `ConcoursePlateRow.tsx` を3レイヤ構成へ書き換え（依存: T5）
- [x] T7 テスト追加: `geometry.test.ts` / `leaderRoute.test.ts` / `concourseLayout.test.ts`
- [x] T8 `tsc` / `eslint` / vitest（platform-diagram・admin）通過を確認
- [x] T9 `docs/domain/platform-coordinate-system.md` と `README.md` を更新
- [ ] T10 目視確認（admin・web、`platformSide` の top / bottom 両方）— 未実施
- [ ] T11 GitHub Issue を起票して番号を追記 — 未実施
- [ ] T12 e2e 回帰テスト追加を検討（`apps/admin/e2e/station-layout.spec.ts`）
