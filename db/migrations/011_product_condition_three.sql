-- product_condition_t: 5값 → 3값 (상·중·하 = high / medium / low)
-- 기존 값 매핑: new, like_new → high | good, fair → medium | poor → low
--
-- Supabase SQL Editor: 기존 DB에 아직 new/like_new/good/fair/poor 가 있을 때만 1회 실행.
-- 이미 enum 이 high, medium, low 만 있으면 실행하지 마세요 (오류 남).
--
-- products.condition 을 참조하는 materialized view 가 있으면 ALTER 가 막힘 → DROP 후 재생성.

DROP MATERIALIZED VIEW IF EXISTS public.mv_popular_products;

CREATE TYPE product_condition_new AS ENUM ('high', 'medium', 'low');

ALTER TABLE products
  ALTER COLUMN condition DROP DEFAULT,
  ALTER COLUMN condition TYPE product_condition_new
  USING (
    CASE condition::text
      WHEN 'new' THEN 'high'::product_condition_new
      WHEN 'like_new' THEN 'high'::product_condition_new
      WHEN 'good' THEN 'medium'::product_condition_new
      WHEN 'fair' THEN 'medium'::product_condition_new
      WHEN 'poor' THEN 'low'::product_condition_new
      ELSE 'medium'::product_condition_new
    END
  );

ALTER TABLE resale_price_rules
  ALTER COLUMN condition TYPE product_condition_new
  USING (
    CASE
      WHEN condition IS NULL THEN NULL
      ELSE CASE condition::text
        WHEN 'new' THEN 'high'::product_condition_new
        WHEN 'like_new' THEN 'high'::product_condition_new
        WHEN 'good' THEN 'medium'::product_condition_new
        WHEN 'fair' THEN 'medium'::product_condition_new
        WHEN 'poor' THEN 'low'::product_condition_new
        ELSE 'medium'::product_condition_new
      END
    END
  );

DROP TYPE product_condition_t;

ALTER TYPE product_condition_new RENAME TO product_condition_t;

COMMENT ON COLUMN public.products.condition IS 'ENUM product_condition_t: high(상) | medium(중) | low(하)';
COMMENT ON COLUMN public.resale_price_rules.condition IS '상품 상태별 규칙 — NULL이면 전체 상태 기본 규칙 (high|medium|low)';

CREATE MATERIALIZED VIEW public.mv_popular_products AS
SELECT
    p.pid,
    p.title,
    p.price,
    p.condition,
    p.status,
    p.view_count,
    p.created_at,
    p.seller_uid,
    p.category_id,
    COUNT(w.wishlist_id)                            AS wish_count,
    (
        p.view_count * 1.0
        + COUNT(w.wishlist_id) * 3.0
        + GREATEST(0, 7 - EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400) * 2.0
    )                                               AS score
FROM public.products p
LEFT JOIN public.wishlists w ON w.pid = p.pid
WHERE p.deleted_at IS NULL
  AND p.status = 'selling'
GROUP BY p.pid
ORDER BY score DESC
LIMIT 100;

CREATE UNIQUE INDEX idx_mv_popular_products_pid ON public.mv_popular_products (pid);

COMMENT ON MATERIALIZED VIEW public.mv_popular_products
    IS '인기 상품 TOP 100 — view_count·wish_count·최신성 합산 점수, pg_cron 1시간 갱신';
