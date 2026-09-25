-- 設備種別 wheelchairEscalator（車いす対応・係員操作のエスカレーター）の追加（Issue #122）
--
-- 【なぜスキーマ差分ではなく手書きのデータ投入なのか】
-- facility_types は列挙用のマスタ表で、値は行として持つ。transfer_route_facilities.type_code は
-- この表の code を外部キーで参照するため、値が無いとルートの設備に使えない。
-- Vercel のビルドがマイグレーションを流すので、この文を置くことで development / preview /
-- production のすべてが同じ手順で値を得る（apps/scripts の seed-master-data.ts は
-- 新規環境の初期化用であり、既存環境には届かない）。
--
-- 【コードがキャメルケースな理由】既存の sameFloor / stairLift に揃えている。
-- docs の snake_case（wheelchair_escalator）は概念名であり、DB のコードではない。
--
-- 【ON CONFLICT DO NOTHING】seed-master-data.ts が先に同じ行を入れていても、
-- マイグレーションが落ちないようにする。追加のみで、既存行は変更しない。
INSERT INTO "facility_types" ("code", "name")
VALUES ('wheelchairEscalator', '車いす対応エスカレーター')
ON CONFLICT ("code") DO NOTHING;
