# 実装タスク: 乗り換え難易度定義の改善 (Issue #30)

- **対象**: ドメイン定義のみ（`docs/spec/`）
- **参照**: [requirements.md](./requirements.md) / [design.md](./design.md)
- **作成日**: 2026-09-20
- **ブランチ**: `docs/issue30-transfer-difficulty-model`

本Issueはスキーマ変更・実装を伴わない。フェーズ3「実装」はドキュメント執筆のみで、
フェーズ4「検証」は机上検証で行う。

## フェーズ3: 実装（ドキュメント執筆）

- [x] **TASK-1** `docs/spec/requirements.md`: 現行モデルの欠陥（軸の混在・接続外の
      情報の混入・軸不足・粒度不足）をEARS記法の要件として全面書き換え
- [x] **TASK-2** `docs/spec/design.md`: モデル定義（評価の単位・解決規則・保持する
      事実・導出する値・持たないもの）と、決定記録9件（却下案とその根拠を含む）を執筆
- [x] **TASK-3** `docs/spec/design.md`「この定義の引き継ぎ先」節: 実装Issueのフェーズ5で
      `docs/domain/station-master-model.md` に反映すべき内容を明示
- [x] **TASK-4** GitHub Issue 起票（commit 24ce1c5 を参照）:
      - 先送りした将来作業: [#119](https://github.com/Natsugure/furatora/issues/119)
        経路探索における乗換駅の選択、
        [#120](https://github.com/Natsugure/furatora/issues/120) 時間帯制約の構造化、
        [#121](https://github.com/Natsugure/furatora/issues/121)
        `station_facilities` からの `stepFreeVia` 導出
      - 実装Issue: [#122](https://github.com/Natsugure/furatora/issues/122) スキーマ実装、
        [#123](https://github.com/Natsugure/furatora/issues/123) 既存16行のデータ移行、
        [#124](https://github.com/Natsugure/furatora/issues/124) Admin入力フォーム、
        [#125](https://github.com/Natsugure/furatora/issues/125) Web表示

## フェーズ4: 検証（机上）

- [x] **実データでの書き下し**: main の難易度入り16行（重複除去後8組の接続:
      池袋×2種／後楽園↔後楽園／後楽園↔春日／本郷三丁目／御茶ノ水／
      淡路町↔小川町／淡路町↔新御茶ノ水。`mcp__plugin_neon_neon__run_sql`、
      branch `br-purple-surf-a169c8ks`、read-only）を新モデルで書き下し、
      すべて表現可能なことを確認した。
      - **御茶ノ水**: 現行 `optimal`/`optimal` なのに備考が「屋根のない地上の公道を
        通る必要がある」という矛盾を、`stepFreeVia=elevator` + `isOutdoor=true` +
        `requiresExitGate=true` で矛盾なく表現できることを確認
      - **淡路町↔小川町**: 方面別の条件差を、方面粒度（決定4）による2行分解
        （池袋方面/荻窪方面）で備考に依存せず表現できることを確認
      - **淡路町↔新御茶ノ水**: 備考「隣の大手町駅のほうが便利です」が決定1
        違反の実例であることを確認。移行時に当該記述を削除する対象として
        design.md の決定9「影響」に記録済み
      - **本郷三丁目**: 後楽園/春日との比較備考は両論併記（「一長一短」）で
        断定的な推奨を含まないため、決定1の対象外情報ではなく備考として残せると判断
- [x] **設計中に洗い出したケースの再確認**: 三田（ペルソナ間の逆転。REQ-4・11）、
      赤坂見附（対面乗換。`same_floor`）、後楽園↔春日（改札外だが屋内。REQ-6の
      3フラグが独立に立つ）はいずれも要件で表現できることを確認。要町
      （属性は良好だが折返しで案内不可）は決定1により意図的に対象外
      （経路探索側の責務）であることを確認。
- [x] **備考に落ちるケースの整合確認**: 方向依存（上り専用エスカレーター）・
      設備の質（EVサイズ）・時間帯制約・工事中の仮設ルート・方面粒度で救えない分は
      いずれも「軸を増やしても解決しない別次元」（design.md 決定9）であることを
      requirements.md「対象外」と design.md「持たないもの」で確認した。
- [x] **EARS要件のテスト可能性**: REQ-1〜17 を通読し、各要件が具体的な入力
      （接続・ペルソナ・値）と期待される出力（保持できること／解釈すること／
      拒否すること）を持ち、単一の解釈しかできない形で書かれていることを確認した。
- [x] **決定記録の自己点検**: 決定1〜9すべてに却下した選択肢が2件以上あり、
      各選択肢に却下理由が明記されていることを確認した。「TBD」等のプレースホルダ、
      決定間の矛盾は見つからなかった。

## フェーズ5: 振り返り

- [x] `docs/domain/` の確認: 本Issueでは更新しない（実装を伴わないため）。
      design.md「この定義の引き継ぎ先」に反映対象を明示済みであることを確認し、
      **確認した上での判断**として記録する。
- [x] `docs/adr/` の確認: 新規ADRは作成しない（決定記録の判定基準に照らし、
      本Issueの決定はドメインのモデル化であり、覆すときに明示的な意思決定を要する
      アーキテクチャ決定ではないと判断した）。既存ADR（ADR-0003）に反する設計を
      していないことを確認済み。

## フェーズ6: 引き渡し

- [x] 変更ファイル: `docs/spec/requirements.md` / `docs/spec/design.md` /
      `docs/spec/tasks.md`（本ファイル）。commit 24ce1c5。
- [x] 恒久知識の取り残し確認: `docs/spec/` は次のIssueで全面書き換えられる。
      次も有効な内容（モデル定義・決定記録9件）は、上記7件のGitHub Issueすべてに
      commit 24ce1c5 へのハッシュ付き参照を入れたことで、実装Issueのフェーズ5で
      `docs/domain/` へ移す経路を確保した（TASK-3の引き継ぎ先明示と対応）。
- [x] **実装Issueの分割**: [#122](https://github.com/Natsugure/furatora/issues/122)
      スキーマ実装 → [#123](https://github.com/Natsugure/furatora/issues/123)
      データ移行 → [#124](https://github.com/Natsugure/furatora/issues/124)
      Admin → [#125](https://github.com/Natsugure/furatora/issues/125) Web表示
      （この順に依存する）。各Issueの本文に、`docs/domain/
      station-master-model.md` への反映をフェーズ5の必須タスクとして明記済み。
- [ ] PR作成・レビュー依頼（開発者判断）
