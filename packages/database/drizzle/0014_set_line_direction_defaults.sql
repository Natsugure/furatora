-- 方面の既定行を設定する（Issue #130 / ADR-0014 / docs/domain/line-directions.md）
-- 既定にするのは「途中の駅名を含まない、終点方向の文言」。候補が1行しかない組はその行を既定にする。
-- 大江戸線は既存13行が環状部の区間ごとの掲示で、どれも全駅に通用しないため、「内回り」「外回り」の行を追加して既定にする。
--
-- 行は (lines.slug, direction_type, display_name) で特定する（環境ごとに id が違いうる。0007・0012 の前例）。
-- 対象の路線・行・駅が無い組は飛ばす（0005 の方針）。既定行が既にある組には触らない
-- （Admin で先に設定された値を上書きしないため。同じ理由で、この移行を2回流しても結果は変わらない）。
DO $$
DECLARE
  v_skipped text;
  v_count integer;
BEGIN
  -- 1. 大江戸線の「内回り」「外回り」を追加する。代表駅は環状部の起点・終点の都庁前
  --    （解決規則には使わない。Admin から変更できる）
  INSERT INTO line_directions (line_id, direction_type, representative_station_id, display_name)
  SELECT l.id, v.direction_type, s.id, v.display_name
  FROM (VALUES ('inbound', '内回り'), ('outbound', '外回り')) AS v(direction_type, display_name)
  CROSS JOIN lines l
  CROSS JOIN stations s
  WHERE l.slug = 'toei-oedo'
    AND s.slug = 'toei-oedo-tochomae'
    AND NOT EXISTS (
      SELECT 1 FROM line_directions d
      WHERE d.line_id = l.id AND d.direction_type = v.direction_type AND d.display_name = v.display_name
    );

  -- 2. 既定にする行（28組）
  CREATE TEMP TABLE _default (
    line_slug text NOT NULL,
    direction_type text NOT NULL,
    display_name text NOT NULL,
    PRIMARY KEY (line_slug, direction_type)
  ) ON COMMIT DROP;

  INSERT INTO _default (line_slug, direction_type, display_name) VALUES
    ('toei-nipporitoneri', 'inbound', '日暮里方面'),
    ('toei-nipporitoneri', 'outbound', '見沼代親水公園方面'),
    ('tokyometro-marunouchi', 'inbound', '荻窪・方南町方面'),
    ('tokyometro-marunouchi', 'outbound', '池袋方面'),
    ('tokyometro-fukutoshin', 'inbound', '渋谷・東急線・みなとみらい線・相鉄線方面'),
    ('tokyometro-fukutoshin', 'outbound', '和光市・東武線・西武線方面'),
    ('tokyometro-chiyoda', 'inbound', '代々木上原・小田急線方面'),
    ('tokyometro-chiyoda', 'outbound', '北綾瀬・JR常磐線方面'),
    ('tokyometro-hanzomon', 'inbound', '押上・東武線方面'),
    ('tokyometro-hanzomon', 'outbound', '渋谷・東急線方面'),
    ('tokyometro-namboku', 'inbound', '赤羽岩淵・埼玉高速線方面'),
    ('tokyometro-namboku', 'outbound', '目黒・東急線・相鉄線方面'),
    ('tokyometro-hibiya', 'inbound', '中目黒方面'),
    ('tokyometro-hibiya', 'outbound', '北千住・東武線方面'),
    ('tokyometro-yurakucho', 'inbound', '新木場方面'),
    ('tokyometro-yurakucho', 'outbound', '和光市・東武線・西武線方面'),
    ('tokyometro-tozai', 'inbound', '西船橋・東葉勝田台・津田沼方面'),
    ('tokyometro-tozai', 'outbound', '中野・三鷹方面'),
    ('tokyometro-ginza', 'inbound', '渋谷方面'),
    ('tokyometro-ginza', 'outbound', '浅草方面'),
    ('toei-mita', 'inbound', '目黒・東急線・相鉄線方面'),
    ('toei-mita', 'outbound', '西高島平方面'),
    ('toei-oedo', 'inbound', '内回り'),
    ('toei-oedo', 'outbound', '外回り'),
    ('toei-shinjuku', 'inbound', '新宿・橋本・高尾山口方面'),
    ('toei-shinjuku', 'outbound', '本八幡方面'),
    ('toei-asakusa', 'inbound', '西馬込・羽田空港・三崎口方面'),
    ('toei-asakusa', 'outbound', '押上・印旛日本医大・成田空港方面');

  -- 3. 対象行が無い組を記録する（飛ばすだけで、失敗にはしない）
  SELECT string_agg(x.line_slug || ' ' || x.direction_type || ' ' || x.display_name, ', ') INTO v_skipped
  FROM _default x
  WHERE NOT EXISTS (
    SELECT 1 FROM line_directions d JOIN lines l ON l.id = d.line_id
    WHERE l.slug = x.line_slug AND d.direction_type = x.direction_type AND d.display_name = x.display_name
  );
  IF v_skipped IS NOT NULL THEN
    RAISE NOTICE '0014: 対象の方面が存在しないため、次の既定の設定をスキップします: %', v_skipped;
  END IF;

  -- 4. 既定を立てる。既定行が既にある組には触らない
  UPDATE line_directions d
  SET is_default = true
  FROM _default x, lines l
  WHERE l.id = d.line_id
    AND l.slug = x.line_slug
    AND d.direction_type = x.direction_type
    AND d.display_name = x.display_name
    AND NOT EXISTS (
      SELECT 1 FROM line_directions e
      WHERE e.line_id = d.line_id AND e.direction_type = d.direction_type AND e.is_default
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '0014: 既定行を % 行設定しました', v_count;
END
$$;
