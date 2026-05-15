-- chat_rooms 에 package_session_id 컬럼 추가
-- 패키지 추천에서 동시에 생성된 채팅방들을 같은 세션으로 묶기 위한 식별자
-- 일반 상품 채팅방은 NULL, 패키지 흐름에서 생성된 방들은 같은 UUID 공유

ALTER TABLE public.chat_rooms
  ADD COLUMN IF NOT EXISTS package_session_id uuid;

COMMENT ON COLUMN public.chat_rooms.package_session_id
  IS '패키지 추천에서 동시 생성된 채팅방 묶음 식별자 — NULL이면 일반 상품 채팅';
