-- 分岐線を本線に畳む（Issue #56 / ADR-0007 / docs/domain/station-master-model.md「路線概念の3分類」）
--
-- 【背景】Phase 3 の突合で、3路線・4駅が ekidata に対応行を持たないまま残った。
-- 原因は furatora の路線×駅粒度（暫定。stations 冒頭コメント参照）が ekidata より
-- 細かいことである。ekidata は以下をすべて本線に畳んでいる。
--
--   丸ノ内線支線（方南町〜中野坂上）        → 28002 東京メトロ丸ノ内線 に統合
--   常磐線各駅停車（綾瀬のみ残存）          → 11320 JR常磐線(上野～取手) に統合
--   東武スカイツリーライン(支線)（押上のみ） → 21002 東武伊勢崎線 に統合
--
-- 対応するコードが存在しないため（manualMappings.ts に null として記録済み）、
-- 未突合のまま Admin に一覧表示し続けても解決する手段が無い。
-- 一方で、これらの路線・駅を削除しても実害が無いことを本番DBで確認済み（2026-09-05）。
--
--   - 分岐線側の駅（中野新橋・中野富士見町・方南町・綾瀬・押上）は、
--     本線側の station_lines 行を既に持っている。孤立しない
--   - 中野坂上だけは本線側に同じ駅ナンバリング（M06）・同じ ekidata コード
--     （2800220）を持つ別行が既に公開状態で存在する。純粋な重複行である
--   - 対象7行（路線3・駅4）に platforms / station_connections /
--     station_adjacencies / facility_connections は1件も無い
--
-- 【削除しないという選択肢を採らなかった理由】
-- 粒度の確定自体は本Issueのスコープ外であり後続Issue（TASK-6.4）に送るが、
-- 「ekidata に存在する分岐＝本線に含まれる」という対応は ekidata 側の事実であって
-- furatora が独自に判断する必要が無い。この7行を残す実益も無いため
-- （設備データが1件も入っておらず、対応するコードも永久に来ない）、
-- 粒度の最終確定を待たずに畳んでよいと判断した。
--
-- 【FK は NO ACTION】カスケード削除ではないため、子テーブルから明示的に消す。
-- slug で対象を特定するのは、環境ごとに id が異なるため（development は本番と別の
-- uuid_generate_v7() で生成されている）。
--
-- 実行順序: line_directions → station_lines（路線側）→ station_lines（駅側）
--         → stations → lines
-- ------------------------------------------------------------------

-- 1. line_directions（丸ノ内線支線の上り・下り。representative_station_id も
--    行ごと消えるため個別の対応は不要）
DELETE FROM "line_directions"
WHERE "line_id" IN (
  SELECT "id" FROM "lines"
  WHERE "slug" IN (
    'tokyometro-marunouchibranch',
    'jr-east-jobanlocal',
    'tobu-tobuskytreebranch'
  )
);

-- 2. station_lines（畳む路線に属する行。中野坂上→丸ノ内線支線もここで消える）
DELETE FROM "station_lines"
WHERE "line_id" IN (
  SELECT "id" FROM "lines"
  WHERE "slug" IN (
    'tokyometro-marunouchibranch',
    'jr-east-jobanlocal',
    'tobu-tobuskytreebranch'
  )
);

-- 3. station_lines（削除する駅に属する残りの行。東京×2・新橋は本線側の
--    station_lines を持っているため、駅を消す前にここで個別に消す）
DELETE FROM "station_lines"
WHERE "station_id" IN (
  SELECT "id" FROM "stations"
  WHERE "slug" IN (
    'tokyometro-marunouchibranch-nakanosakaue',
    'jr-east-jobanrapid-tokyo',
    'jr-east-jobanrapid-shimbashi',
    'jr-east-takasaki-tokyo'
  )
);

-- 4. stations（重複行・対応不能行を削除。本線側の同名駅は別行として残る）
DELETE FROM "stations"
WHERE "slug" IN (
  'tokyometro-marunouchibranch-nakanosakaue',
  'jr-east-jobanrapid-tokyo',
  'jr-east-jobanrapid-shimbashi',
  'jr-east-takasaki-tokyo'
);

-- 5. lines（分岐線そのものを削除）
DELETE FROM "lines"
WHERE "slug" IN (
  'tokyometro-marunouchibranch',
  'jr-east-jobanlocal',
  'tobu-tobuskytreebranch'
);

-- 6. 残存駅の slug を本線基準に付け替える
--    slug の導出規則は `${lines.slug}-${hepburn(nameKana)}`
--    （docs/domain/station-master-model.md「slug の導出規則」）。
--    所属路線が本線1本だけになったため、分岐線由来の slug のままでは規則と食い違う。
--    公開中の3駅（中野新橋・中野富士見町・方南町）は URL が変わる。リダイレクトは設けない
--    （設備データが未入力で影響が小さいため。旧URLは404になる）。
--    非公開の2駅（綾瀬・押上）は URL 影響が無いが、slug 生成規則との整合のため揃える
UPDATE "stations" SET "slug" = 'tokyometro-marunouchi-nakanoshimbashi'
  WHERE "slug" = 'tokyometro-marunouchibranch-nakanoshimbashi';
UPDATE "stations" SET "slug" = 'tokyometro-marunouchi-nakanofujimicho'
  WHERE "slug" = 'tokyometro-marunouchibranch-nakanofujimicho';
UPDATE "stations" SET "slug" = 'tokyometro-marunouchi-honancho'
  WHERE "slug" = 'tokyometro-marunouchibranch-honancho';
UPDATE "stations" SET "slug" = 'jr-east-jobanrapid-ayase'
  WHERE "slug" = 'jr-east-jobanlocal-ayase';
UPDATE "stations" SET "slug" = 'tobu-tobuskytree-oshiage'
  WHERE "slug" = 'tobu-tobuskytreebranch-oshiage';
