-- chat_rooms 에 product_titles 컬럼 추가
-- 패키지 흐름에서 한 셀러에게 여러 상품 문의 시 전체 상품명 저장

ALTER TABLE public.chat_rooms
  ADD COLUMN IF NOT EXISTS product_titles text[];

COMMENT ON COLUMN public.chat_rooms.product_titles
  IS '패키지 구매 시 해당 셀러에게 문의한 전체 상품명 배열 — 단일 상품 채팅은 NULL';
