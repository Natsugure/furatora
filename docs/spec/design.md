# 設計: ホーム図の設備アイコンに wheelchairEscalator を足す (Issue #140)

設備コードの一覧の正を `FACILITY_TYPE_CODES` とし、知らないコードを読み取りの境界で見分ける方針は
[ADR-0016](../adr/0016-facility-type-codes-constant-as-source.md) による。ここには実装だけを書く。

## 変更するファイル

```
packages/platform-diagram/src/components/diagram/DiagramSvg.tsx   FACILITY_ICON_FILES を Record<FacilityTypeCode, string> にし、wheelchairEscalator を追加。typeCode が null なら 📍
packages/platform-diagram/src/domain/types.ts                     FacilityDTO.typeCode を FacilityTypeCode | null にする
apps/web/src/external/query/stationDetailQuery.ts                 isFacilityTypeCode で見分け、知らないコードは typeCode を null にする
apps/admin/src/features/station-layout/ports.ts                   LayoutFacilityDTO の typeCode を FacilityTypeCode に絞る
apps/admin/public/icons/wheelchair_escalator.png                   新規。apps/web/public/icons/ と同一のファイル
packages/platform-diagram/README.md                                「アイコンの複製について」を7ファイルにし、種類を足すときの注意を追記
packages/database/src/enums/facility.ts                            「種類を足すとき」の手順に 3. アイコンの追加を追記
```

## 設計上の判断

- `FacilityTypeCode` は `@furatora/database/enums` から import する。`platform-diagram` は既に `domain/types.ts` で同じ入口に依存しており、依存の向きは変わらない
- schema の `$type<FacilityTypeCode>()` は実行時に検査しないため、別デプロイの新しいコードが DB に入ると
  未知のコードが来うる（ADR-0016「残るずれ」）。Web の `stationDetailQuery.ts` で `isFacilityTypeCode` によって見分け、
  知らないコードは `FacilityDTO.typeCode` を `null` にして渡す。描画側は `null` のとき 📍 で描く。
  こうすると、📍 のフォールバックは型の上でも使われる分岐になる
- Admin の `LayoutFacilityDTO` は `typeCode` を `FacilityTypeCode`（null なし）に絞る。
  Admin は読み取りで `assertKnownFacilityCodes` によって止めるため、知らないコードは届かない
- 画像の置き忘れは型で検出できない。手順コメントと README で補う

## エラーマトリックス

| 状況 | 結果 |
|---|---|
| 定数に種類を足し、対応表を足し忘れた | typecheck エラー |
| 対応表に足し、あるアプリの `public/icons/` に画像を置き忘れた | そのアプリでアイコンが壊れた画像になる（検出不可。手順で補う） |
| 稼働中のコードが知らない種類が DB にある | 📍 で描画（従来どおり） |

## テスト戦略

`DiagramSvg` には描画のテストが無く、対応表の網羅は型で保証する。
一時的に `wheelchairEscalator` の行を外して typecheck が失敗することを確かめる。
