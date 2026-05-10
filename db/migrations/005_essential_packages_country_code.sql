-- ============================================================
--  005: essential_packages.country_code 컬럼 추가
--
--  근거:
--    exchange-student 브랜치 통합 — 패키지 추천 fallback 1순위 매칭에 사용.
--    fallback 순서 (src/lib/utils/fallback.ts):
--      tier-1: country_code + housing_type 정확 매칭
--      tier-2: region_group + housing_type 매칭
--      tier-3: region_group IS NULL AND housing_type IS NULL (범용)
--
--  결정:
--    - 길이 VARCHAR(10): countries.country_code 와 동일
--    - NULL 허용: 기존 시드 ROW는 NULL 유지 → tier-2/tier-3 fallback 로 graceful 진입
--    - FK 미설정: countries 와 강제 결합 시 시드 순서·미등록 국가 케이스에서 깨짐;
--      tier-1 결과 없으면 tier-2 fallback이 받아내므로 비강제 결합으로 충분.
--    - 인덱스 미설정: essential_packages 는 템플릿 마스터(소규모, 현재 3 ROW),
--      계획상 ~수십 ROW 이내. 인덱스 비용 > 이득.
--
--  명시적 비결정:
--    - essential_packages.name (JSONB) ↔ name_ko/name_en 차이는 schema 변경 없이
--      브랜치 코드를 main schema에 맞춰 어댑팅 (Step C/A2).
-- ============================================================

ALTER TABLE essential_packages
    ADD COLUMN IF NOT EXISTS country_code VARCHAR(10) NULL;

COMMENT ON COLUMN essential_packages.country_code
    IS 'NULL 이면 모든 국가 공통 템플릿. 지정 시 countries(country_code)와 매칭 (FK 미설정 — 비강제 결합).';
