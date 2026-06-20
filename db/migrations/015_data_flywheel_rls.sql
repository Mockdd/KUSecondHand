-- 015_data_flywheel_rls.sql
-- 데이터 플라이휠 테이블 3개에 RLS 정책 적용.
--
-- 보안 모델:
--   - tag_feedback_logs     : 본인 데이터만 SELECT/INSERT. service_role 은 전체 접근.
--   - model_versions        : 전체 공개 SELECT. 변경은 service_role 만 (정책 미정의 → 기본 차단).
--   - tag_prediction_cache  : service_role 전용 (일반 사용자 접근 차단).
--
-- 메모:
--   - Supabase 의 service_role 키는 RLS 를 우회(bypass)하므로 별도 정책이 필요 없음.
--   - 일반 사용자 권한(anon, authenticated)에 대한 정책만 명시.
--   - 015 는 014 가 적용된 후에만 실행 가능.

BEGIN;

-- ============================================================
-- 1. tag_feedback_logs
-- ============================================================

ALTER TABLE tag_feedback_logs ENABLE ROW LEVEL SECURITY;

-- 본인이 만든 로그만 조회 가능 (마이페이지 / 디버그용)
CREATE POLICY "tag_feedback_logs: 본인 로그 조회"
    ON tag_feedback_logs FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- 인증 사용자가 본인 user_id 로만 INSERT 가능
-- (실제 INSERT 는 보통 API route 에서 service_role 로 수행하지만,
--  방어적으로 클라이언트 직접 INSERT 도 안전하게 막아둠)
CREATE POLICY "tag_feedback_logs: 본인 user_id 로만 삽입"
    ON tag_feedback_logs FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- UPDATE / DELETE 정책 없음 → 모든 일반 사용자 변경 차단
-- 학습 데이터는 immutable 하게 유지하는 것이 ML 파이프라인 무결성에 중요.


-- ============================================================
-- 2. model_versions
-- ============================================================

ALTER TABLE model_versions ENABLE ROW LEVEL SECURITY;

-- 프론트엔드에서 현재 활성 모델 버전 표시용으로 읽을 수 있어야 함
CREATE POLICY "model_versions: 전체 공개 읽기"
    ON model_versions FOR SELECT USING (true);

-- INSERT / UPDATE / DELETE 는 service_role 만 (파인튜닝 스크립트가 수행)
-- → 별도 정책 없음으로 일반 사용자 차단


-- ============================================================
-- 3. tag_prediction_cache
-- ============================================================

ALTER TABLE tag_prediction_cache ENABLE ROW LEVEL SECURITY;

-- 캐시는 서버 측 predict API(service_role) 만 접근.
-- 클라이언트가 직접 캐시를 읽거나 조작하면 보안/일관성 위험.
-- → 일반 사용자에게는 정책 없음 = 모두 차단.


COMMIT;


-- ============================================================
-- 검증 쿼리
-- ============================================================

-- 1) RLS 활성화 확인 (3개 테이블 모두 rowsecurity = true)
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('tag_feedback_logs', 'model_versions', 'tag_prediction_cache')
-- ORDER BY tablename;

-- 2) 정의된 정책 목록 (총 3개)
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('tag_feedback_logs', 'model_versions', 'tag_prediction_cache')
-- ORDER BY tablename, policyname;
