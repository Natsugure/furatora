# 設計: ホーム図の設備アイコンに wheelchairEscalator を足す (Issue #140)

設備コードの一覧の正を `FACILITY_TYPE_CODES` とし、知らないコードを読み取りの境界で見分ける方針は
[ADR-0016](../adr/0016-facility-type-codes-constant-as-source.md) による。ここには実装だけを書く。

## 変更するファイル

```
packages/platform-diagram/src/components/diagram/DiagramSvg.tsx   FACILITY_ICON_FILES を Record<FacilityTypeCode, string> にし、wheelchairEscalator を追加
apps/admin/public/icons/wheelchair_escalator.png                   新規。apps/web/public/icons/ と同一のファイル
packages/platform-diagram/README.md                                「アイコンの複製について」を7ファイルにし、種類を足すときの注意を追記
packages/database/src/enums/facility.ts                            「種類を足すとき」の手順に 3. アイコンの追加を追記
```

## 設計上の判断

- `FacilityTypeCode` は `@furatora/database/enums` から import する。`platform-diagram` は既に `domain/types.ts` で同じ入口に依存しており、依存の向きは変わらない
- 描画側の `iconFile ? <image> : <text>📍</text>` の分岐は残す。型の上では常にアイコンが引けるが、
  Web の `stationDetailQuery.ts` は `station_facilities.type_code` を `isFacilityTypeCode` で検査しておらず、
  別デプロイの新しいコードが DB に入ると実行時に未知のコードが来うる（ADR-0016「残るずれ」）
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
