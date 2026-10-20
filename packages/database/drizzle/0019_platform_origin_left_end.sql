-- ホーム座標の原点を「線路に向かって立ったときの左の端」に揃える（Issue #188 / ADR-0022 / docs/domain/platform-coordinate-system.md）。
-- platform_side = 'top' のホームは 180° 回した向きで入っているので、座標を x' = L − x（L = physical_length）に置き換える。
-- 180° 回すのと同じで、鏡写しにはならない。号車と対面乗換帯は start と end を入れ替えて start < end を保つ。
--
-- 対象は id ではなく platform_side で選ぶ（環境ごとに id が違いうる。0014 の前例）。
-- 最後に platform_side を全件 null にするので、この移行を2回流しても座標は戻らない。
-- 列そのものは、読むコードが無くなった次のデプロイで落とす（CLAUDE.md の二段階）。
DO $$
DECLARE
  v_bad text;
BEGIN
  -- ホーム長が未入力（0）なのに座標を持つ top のホームは、L が分からず変換できない。
  -- 黙って飛ばすと platform_side を null にした時点で向きの手掛かりが消えるので、移行を止める。
  -- 人が Admin でホーム長を入れてから流し直す
  SELECT string_agg(p.id::text, ', ') INTO v_bad
  FROM platforms p
  WHERE p.platform_side = 'top' AND p.physical_length = 0
    AND (
      EXISTS (SELECT 1 FROM train_stop_patterns t WHERE t.platform_id = p.id)
      OR EXISTS (
        SELECT 1 FROM platform_locations l
        JOIN platform_location_cells c ON c.platform_location_id = l.id
        WHERE l.platform_id = p.id AND c.x_position_meters IS NOT NULL
      )
      OR EXISTS (
        SELECT 1 FROM platform_locations l
        JOIN facility_connections f ON f.platform_location_id = l.id
        WHERE l.platform_id = p.id AND f.x_range_start IS NOT NULL AND f.x_range_end IS NOT NULL
      )
    );
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'ホーム長が 0 なのに座標を持つ top のホームがあります（platforms.id: %）', v_bad;
  END IF;

  -- 号車。右辺は更新前の値で評価されるので、一時列なしで入れ替えられる
  UPDATE train_stop_pattern_cars c
  SET start_meters = p.physical_length - c.end_meters,
      end_meters = p.physical_length - c.start_meters
  FROM train_stop_patterns t
  JOIN platforms p ON p.id = t.platform_id
  WHERE c.train_stop_pattern_id = t.id
    AND p.platform_side = 'top' AND p.physical_length > 0;

  -- アクセス点。null（コンコース全体）は null のまま
  UPDATE platform_location_cells c
  SET x_position_meters = p.physical_length - c.x_position_meters
  FROM platform_locations l
  JOIN platforms p ON p.id = l.platform_id
  WHERE c.platform_location_id = l.id
    AND p.platform_side = 'top' AND p.physical_length > 0
    AND c.x_position_meters IS NOT NULL;

  -- 対面乗換帯。両方が非 null のときだけ帯として扱われる（web の DTO と同じ）
  UPDATE facility_connections f
  SET x_range_start = p.physical_length - f.x_range_end,
      x_range_end = p.physical_length - f.x_range_start
  FROM platform_locations l
  JOIN platforms p ON p.id = l.platform_id
  WHERE f.platform_location_id = l.id
    AND p.platform_side = 'top' AND p.physical_length > 0
    AND f.x_range_start IS NOT NULL AND f.x_range_end IS NOT NULL;

  UPDATE platforms SET platform_side = NULL WHERE platform_side IS NOT NULL;
END $$;
