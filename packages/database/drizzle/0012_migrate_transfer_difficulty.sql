-- 旧 station_connections の評価済み17行を、乗換難易度の新モデルへ書き直す（Issue #123。移行データ表は Issue #123 時点の docs/spec/design.md。git 履歴で参照する）
--
-- 【なぜスキーマ差分ではなく手書きのデータ移行なのか】
-- 新4表（0009）は全環境で0行である。旧行の難易度4列は設備の種類・所要時分を持たず、
-- 旧行から機械的に導出できないため、開発者が確定した値（移行データ表）をここへ埋め込む。
-- Vercel のビルドがマイグレーションを流すので、この文を置くことで development / preview /
-- production のすべてが同じ手順で移行される（手で本番に流さない。CLAUDE.md）。
--
-- 【旧表は変更しない】旧4列（strollerDifficulty 等）は #125 まで現行の Admin・Web が読む。
-- 落とすのは #125 のあとの別デプロイである。
--
-- 【駅は slug で引く】環境ごとに stations.id が違いうる（0007 の前例）。丸ノ内線の方面は
-- outbound = 池袋方面、inbound = 荻窪方面。
--
-- 【2つのガードでビルドを落とさない】対象20駅の slug が揃わない環境（駅データが無い新規環境）と、
-- 使う設備の種類が facility_types に無い環境（マスタ未投入）では、何も投入せず終了する（0005 の方針）。
-- 対象の接続が既にある場合も、二重投入を避けるため何もしない。
--
-- 【自己検証】投入後に件数と、基準ルートを持たない接続・孤立ルートが無いことを検査する。
-- 外れたら例外でロールバックし、ビルドが止まる。移行データ表を編集するときは、この件数も更新すること。
--
-- 【設備0件のルートは「設備未入力」】旧評価から設備の種類が言えない基準ルートは、設備0件で移す。
-- 0件を「そのまま通れる」と読んではならない（docs/adr/0012-zero-facility-route-as-not-entered.md）。#124・#125 の制約になる。
--
-- 【備考の扱い】淡路町↔新御茶ノ水の「隣の大手町駅のほうが便利です」は、出発地に依存する経路上の選好であり
-- 移さない（docs/domain/station-master-model.md「備考の役割」）。本郷三丁目の「隣の後楽園・春日駅の乗り換えであれば…一長一短です」は、
-- 開発者判断で接続の notes に残した（docs/domain/station-master-model.md「備考の役割」の既知の例外）。ほかの備考は、フラグ・設備の種類で表せるものは
-- 備考に重複して残さず、ルートの notes に必要なものだけを移した。
--
-- 【値を書き換えようとする人へ】移行後の訂正は Admin（#124）で行う。適用済みのこのファイルは編集しない。
-- 未適用の環境に別の値を流したいときは、新しいマイグレーションを足すこと。
DO $$
DECLARE
  v_missing text;
  v_count integer;
BEGIN
  -- ------------------------------------------------------------------
  -- 1. 移行データ表（一時テーブルに置く。実テーブルへの書き込みはガードを通ってから）
  -- ------------------------------------------------------------------

  -- ルート（21本）。id は route_key から実テーブルへ引くために先に採番する
  CREATE TEMP TABLE _route (
    route_key text PRIMARY KEY,
    id uuid NOT NULL DEFAULT uuid_generate_v7(),
    minutes smallint,
    is_outdoor boolean NOT NULL,
    requires_exit_gate boolean NOT NULL,
    requires_staff boolean NOT NULL,
    is_officially_guided boolean NOT NULL,
    notes text
  ) ON COMMIT DROP;

  INSERT INTO _route (route_key, minutes, is_outdoor, requires_exit_gate, requires_staff, is_officially_guided, notes) VALUES
    ('ikebukuro_fukutoshin', NULL, false, false, false, false, NULL),
    ('ikebukuro_yurakucho', NULL, false, false, false, false, NULL),
    ('ikebukuro_yamanote', NULL, false, false, false, false, NULL),
    ('ikebukuro_saikyo', NULL, false, false, false, false, NULL),
    ('ikebukuro_shonan', NULL, false, false, false, false, NULL),
    ('ikebukuro_tojo', NULL, false, false, false, false, NULL),
    ('ikebukuro_seibu_base', NULL, false, false, false, false, NULL),
    ('ikebukuro_seibu_bf', NULL, false, false, false, false,
      '西武線のB1F改札とホーム間は1番線以外エレベーターで繋がっていません。他のホームに向かう場合も、一度1番線を経由して向かう必要があります。'),
    ('korakuen_namboku_base', NULL, false, false, false, false, NULL),
    ('korakuen_namboku_bf', NULL, false, true, true, false,
      '改札係員に申し出て改札外にあるエレベーターを使用する必要があります。'),
    ('korakuen_mita_base', 3, false, false, false, false, NULL),
    ('korakuen_mita_bf', NULL, false, true, false, false,
      '東京メトロと都営地下鉄間の乗り換えの場合は、自動改札機を通っても60分以内に都営の改札に入場すれば乗継割引が適用されます。'),
    ('korakuen_oedo_base', 3, false, false, false, false, NULL),
    ('korakuen_oedo_bf', NULL, false, true, false, false,
      '東京メトロと都営地下鉄間の乗り換えの場合は、自動改札機を通っても60分以内に都営の改札に入場すれば乗継割引が適用されます。'),
    ('hongo_base', NULL, true, true, false, false, NULL),
    ('hongo_bf', NULL, true, true, false, false,
      '都営側のエレベーターは5番出口にあり、片側3車線の国道を渡る必要があります。'),
    ('ochanomizu', NULL, true, true, false, true, NULL),
    ('awajicho_ogawamachi_a', NULL, false, false, true, false, NULL),
    ('awajicho_ogawamachi_b', NULL, false, false, false, false, NULL),
    ('awajicho_shinochanomizu_base', NULL, false, false, false, false, NULL),
    ('awajicho_shinochanomizu_wc', NULL, false, false, true, false, '移動距離は400m以上あります。');

  -- 設備（18行）。種類の集合であり、順序も回数も持たない。行が無いルートは「設備未入力」
  CREATE TEMP TABLE _route_facility (
    route_key text NOT NULL,
    type_code text NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO _route_facility (route_key, type_code) VALUES
    ('ikebukuro_fukutoshin', 'elevator'),
    ('ikebukuro_yurakucho', 'elevator'),
    ('ikebukuro_yamanote', 'elevator'),
    ('ikebukuro_saikyo', 'elevator'),
    ('ikebukuro_shonan', 'elevator'),
    ('ikebukuro_tojo', 'elevator'),
    ('ikebukuro_seibu_bf', 'elevator'),
    ('korakuen_namboku_bf', 'elevator'),
    ('korakuen_mita_bf', 'elevator'),
    ('korakuen_oedo_bf', 'elevator'),
    ('hongo_bf', 'elevator'),
    ('ochanomizu', 'elevator'),
    ('awajicho_ogawamachi_a', 'elevator'),
    ('awajicho_ogawamachi_a', 'wheelchairEscalator'),
    ('awajicho_ogawamachi_b', 'elevator'),
    ('awajicho_shinochanomizu_wc', 'elevator'),
    ('awajicho_shinochanomizu_wc', 'ramp'),
    ('awajicho_shinochanomizu_wc', 'stairLift');

  -- 駅対（15組）。slug_m は丸ノ内線側の駅、slug_o は相手側の駅。
  -- 各駅対は方面2×2の4接続を持つ。source は旧行を踏襲する
  CREATE TEMP TABLE _pair (
    pair_key text PRIMARY KEY,
    slug_m text NOT NULL,
    slug_o text NOT NULL,
    source text NOT NULL,
    notes text
  ) ON COMMIT DROP;

  INSERT INTO _pair (pair_key, slug_m, slug_o, source, notes) VALUES
    ('ikebukuro_fukutoshin', 'tokyometro-marunouchi-ikebukuro', 'tokyometro-fukutoshin-ikebukuro', 'ekidata_group', NULL),
    ('ikebukuro_yurakucho', 'tokyometro-marunouchi-ikebukuro', 'tokyometro-yurakucho-ikebukuro', 'ekidata_group', NULL),
    ('ikebukuro_yamanote', 'tokyometro-marunouchi-ikebukuro', 'jr-east-yamanote-ikebukuro', 'ekidata_group', NULL),
    ('ikebukuro_saikyo', 'tokyometro-marunouchi-ikebukuro', 'jr-east-saikyokawagoe-ikebukuro', 'ekidata_group', NULL),
    ('ikebukuro_shonan', 'tokyometro-marunouchi-ikebukuro', 'jr-east-shonanshinjuku-ikebukuro', 'ekidata_group', NULL),
    ('ikebukuro_tojo', 'tokyometro-marunouchi-ikebukuro', 'tobu-tojo-ikebukuro', 'ekidata_group', NULL),
    ('ikebukuro_seibu', 'tokyometro-marunouchi-ikebukuro', 'seibu-ikebukuro-ikebukuro', 'ekidata_group', NULL),
    ('korakuen_namboku', 'tokyometro-marunouchi-korakuen', 'tokyometro-namboku-korakuen', 'ekidata_group', NULL),
    ('korakuen_mita', 'tokyometro-marunouchi-korakuen', 'toei-mita-kasuga', 'manual', NULL),
    ('korakuen_oedo', 'tokyometro-marunouchi-korakuen', 'toei-oedo-kasuga', 'manual', NULL),
    ('hongo_oedo', 'tokyometro-marunouchi-hongosanchome', 'toei-oedo-hongosanchome', 'ekidata_group',
      '隣の後楽園・春日駅の乗り換えであれば屋内で完結しますが、移動距離が長くなるため一長一短です。'),
    ('ochanomizu_chuorapid', 'tokyometro-marunouchi-ochanomizu', 'jr-east-chuorapid-ochanomizu', 'ekidata_group', NULL),
    ('ochanomizu_chuosobu', 'tokyometro-marunouchi-ochanomizu', 'jr-east-chuosobulocal-ochanomizu', 'ekidata_group', NULL),
    ('awajicho_ogawamachi', 'tokyometro-marunouchi-awajicho', 'toei-shinjuku-ogawamachi', 'ekidata_group', NULL),
    ('awajicho_shinochanomizu', 'tokyometro-marunouchi-awajicho', 'tokyometro-chiyoda-shinochanomizu', 'ekidata_group', NULL);

  -- 接続とルートの紐付け（84行に展開される）。
  -- m_dir が NULL の行は、その駅対の4接続すべてに紐付く（全方面共通）。
  -- 全方面共通は NULL で表さず、4接続が同一ルートを参照することで表す（docs/domain/station-master-model.md「4層構造」）。
  -- 淡路町↔小川町だけ、丸ノ内線側の方面ごとに異なるルートを参照する
  CREATE TEMP TABLE _link (
    pair_key text NOT NULL,
    m_dir text,
    route_key text NOT NULL,
    label text NOT NULL,
    is_baseline boolean NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO _link (pair_key, m_dir, route_key, label, is_baseline) VALUES
    ('ikebukuro_fukutoshin', NULL, 'ikebukuro_fukutoshin', 'エレベーター経由', true),
    ('ikebukuro_yurakucho', NULL, 'ikebukuro_yurakucho', 'エレベーター経由', true),
    ('ikebukuro_yamanote', NULL, 'ikebukuro_yamanote', 'エレベーター経由', true),
    ('ikebukuro_saikyo', NULL, 'ikebukuro_saikyo', 'エレベーター経由', true),
    ('ikebukuro_shonan', NULL, 'ikebukuro_shonan', 'エレベーター経由', true),
    ('ikebukuro_tojo', NULL, 'ikebukuro_tojo', 'エレベーター経由', true),
    ('ikebukuro_seibu', NULL, 'ikebukuro_seibu_base', '一般経路', true),
    ('ikebukuro_seibu', NULL, 'ikebukuro_seibu_bf', 'エレベーター経由（1番線経由）', false),
    ('korakuen_namboku', NULL, 'korakuen_namboku_base', '改札内乗換通路経由', true),
    ('korakuen_namboku', NULL, 'korakuen_namboku_bf', '改札外エレベーター経由', false),
    ('korakuen_mita', NULL, 'korakuen_mita_base', '改札内乗換通路経由', true),
    ('korakuen_mita', NULL, 'korakuen_mita_bf', '改札外経由', false),
    ('korakuen_oedo', NULL, 'korakuen_oedo_base', '改札内乗換通路経由', true),
    ('korakuen_oedo', NULL, 'korakuen_oedo_bf', '改札外経由', false),
    ('hongo_oedo', NULL, 'hongo_base', '地上経由', true),
    ('hongo_oedo', NULL, 'hongo_bf', '5番出口エレベーター経由', false),
    -- 御茶ノ水は快速・中央総武の2駅対（8接続）が同一の1本を共有する（Q6・Q7）
    ('ochanomizu_chuorapid', NULL, 'ochanomizu', '地上経由', true),
    ('ochanomizu_chuosobu', NULL, 'ochanomizu', '地上経由', true),
    -- 丸ノ内線 outbound（池袋方面）側は車いす対応エスカレーター経由、inbound（荻窪方面）側はエレベーターのみ。
    -- 新宿線側の方面2種で、それぞれ同一ルートを共有する（設備行は複製しない）
    ('awajicho_ogawamachi', 'outbound', 'awajicho_ogawamachi_a', '車いす対応エスカレーター経由', true),
    ('awajicho_ogawamachi', 'inbound', 'awajicho_ogawamachi_b', 'エレベーターのみ', true),
    ('awajicho_shinochanomizu', NULL, 'awajicho_shinochanomizu_base', '一般経路', true),
    ('awajicho_shinochanomizu', NULL, 'awajicho_shinochanomizu_wc', '階段昇降機経由', false);

  -- ------------------------------------------------------------------
  -- 2. ガード（実テーブルにはまだ触れていない）
  -- ------------------------------------------------------------------

  -- 対象20駅の slug が揃っているか
  SELECT string_agg(x.slug, ', ') INTO v_missing
  FROM (SELECT slug_m AS slug FROM _pair UNION SELECT slug_o FROM _pair) x
  WHERE NOT EXISTS (SELECT 1 FROM stations s WHERE s.slug = x.slug);
  IF v_missing IS NOT NULL THEN
    RAISE NOTICE '0012: 対象の駅が存在しないため、乗換難易度の移行をスキップします: %', v_missing;
    RETURN;
  END IF;

  -- 使う設備の種類が facility_types にあるか
  SELECT string_agg(t.type_code, ', ') INTO v_missing
  FROM (SELECT DISTINCT type_code FROM _route_facility) t
  WHERE NOT EXISTS (SELECT 1 FROM facility_types f WHERE f.code = t.type_code);
  IF v_missing IS NOT NULL THEN
    RAISE NOTICE '0012: 設備の種類が facility_types に無いため、乗換難易度の移行をスキップします: %', v_missing;
    RETURN;
  END IF;

  -- 対象の駅対の接続が既にあるか（二重投入の防止）
  IF EXISTS (
    SELECT 1
    FROM _pair p
    JOIN stations m ON m.slug = p.slug_m
    JOIN stations o ON o.slug = p.slug_o
    JOIN transfer_connections tc
      ON (tc.station_a_id = m.id AND tc.station_b_id = o.id)
      OR (tc.station_a_id = o.id AND tc.station_b_id = m.id)
  ) THEN
    RAISE NOTICE '0012: 対象の接続が既に存在するため、乗換難易度の移行をスキップします';
    RETURN;
  END IF;

  -- ------------------------------------------------------------------
  -- 3. 投入
  -- ------------------------------------------------------------------

  -- 接続: 駅対 × 方面（丸ノ内線側 2 × 相手側 2）= 60行。id は紐付けから引くために先に採番する
  CREATE TEMP TABLE _conn ON COMMIT DROP AS
  SELECT p.pair_key, dm.d AS m_dir, dn.d AS o_dir, uuid_generate_v7() AS id
  FROM _pair p
  CROSS JOIN (VALUES ('inbound'), ('outbound')) dm(d)
  CROSS JOIN (VALUES ('inbound'), ('outbound')) dn(d);

  -- 端点は (stationId, direction_type) の昇順に並べて格納する。
  -- transfer_connection_endpoints_ordered の CHECK と同じ行値比較で、
  -- apps/admin の normalizeTransferEndpoints() と同じ順序になる
  INSERT INTO transfer_connections (id, station_a_id, direction_a, station_b_id, direction_b, notes, source)
  SELECT
    c.id,
    CASE WHEN (m.id, c.m_dir) < (o.id, c.o_dir) THEN m.id ELSE o.id END,
    CASE WHEN (m.id, c.m_dir) < (o.id, c.o_dir) THEN c.m_dir ELSE c.o_dir END,
    CASE WHEN (m.id, c.m_dir) < (o.id, c.o_dir) THEN o.id ELSE m.id END,
    CASE WHEN (m.id, c.m_dir) < (o.id, c.o_dir) THEN c.o_dir ELSE c.m_dir END,
    p.notes,
    p.source
  FROM _conn c
  JOIN _pair p ON p.pair_key = c.pair_key
  JOIN stations m ON m.slug = p.slug_m
  JOIN stations o ON o.slug = p.slug_o;

  INSERT INTO transfer_routes (id, minutes, is_outdoor, requires_exit_gate, requires_staff, is_officially_guided, notes)
  SELECT id, minutes, is_outdoor, requires_exit_gate, requires_staff, is_officially_guided, notes
  FROM _route;

  INSERT INTO transfer_route_facilities (route_id, type_code)
  SELECT r.id, f.type_code
  FROM _route_facility f
  JOIN _route r ON r.route_key = f.route_key;

  INSERT INTO connection_routes (connection_id, route_id, label, is_baseline)
  SELECT c.id, r.id, l.label, l.is_baseline
  FROM _link l
  JOIN _conn c ON c.pair_key = l.pair_key AND (l.m_dir IS NULL OR l.m_dir = c.m_dir)
  JOIN _route r ON r.route_key = l.route_key;

  -- ------------------------------------------------------------------
  -- 4. 自己検証（外れたら例外でロールバックする）
  -- ------------------------------------------------------------------

  SELECT count(*) INTO v_count FROM _conn c
  JOIN transfer_connections tc ON tc.id = c.id;
  IF v_count <> 60 THEN
    RAISE EXCEPTION '0012: 接続が60行ではありません: %', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM _route r
  JOIN transfer_routes tr ON tr.id = r.id;
  IF v_count <> 21 THEN
    RAISE EXCEPTION '0012: ルートが21本ではありません: %', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM connection_routes cr
  JOIN _conn c ON c.id = cr.connection_id;
  IF v_count <> 84 THEN
    RAISE EXCEPTION '0012: 接続とルートの紐付けが84行ではありません: %', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM transfer_route_facilities trf
  JOIN _route r ON r.id = trf.route_id;
  IF v_count <> 18 THEN
    RAISE EXCEPTION '0012: 設備が18行ではありません: %', v_count;
  END IF;

  -- 基準ルートは接続あたり高々1本（部分ユニークが守る）。0本の接続は許容されるが、この移行では作らない
  SELECT count(*) INTO v_count FROM _conn c
  WHERE NOT EXISTS (
    SELECT 1 FROM connection_routes cr WHERE cr.connection_id = c.id AND cr.is_baseline
  );
  IF v_count <> 0 THEN
    RAISE EXCEPTION '0012: 基準ルートを持たない接続があります: %', v_count;
  END IF;

  -- 孤立ルート（どの接続からも参照されないルート）が無いこと
  SELECT count(*) INTO v_count FROM _route r
  WHERE NOT EXISTS (SELECT 1 FROM connection_routes cr WHERE cr.route_id = r.id);
  IF v_count <> 0 THEN
    RAISE EXCEPTION '0012: どの接続からも参照されないルートがあります: %', v_count;
  END IF;
END
$$;
