# 배포 체크리스트

Data Flywheel 파이프라인 첫 배포 전 확인 항목.

---

## 1. Supabase 설정

- [ ] 마이그레이션 `014_data_flywheel.sql` 실행 완료
- [ ] 마이그레이션 `015_data_flywheel_rls.sql` 실행 완료
- [ ] `tag_feedback_logs` 테이블 존재 확인
- [ ] `model_versions` 테이블에 기본 행 1개 존재 (`gpt-4o-mini`, `is_active=true`)
- [ ] `tag_prediction_cache` 테이블 존재 확인
- [ ] `training-datasets` 버킷 생성 (Private)

## 2. Railway 환경변수

- [ ] `OPENAI_API_KEY` — Fine-tuning 권한 포함 여부 확인
- [ ] `OPENAI_ORG_ID`
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `FINETUNE_MIN_SAMPLES` (권장: `50`)
- [ ] `FINETUNE_LOOKBACK_DAYS` (권장: `7`)
- [ ] `TRAINING_DATASETS_BUCKET` (`training-datasets`)
- [ ] `TAG_MODEL_VERSION` (`gpt-4o-mini`)
- [ ] `SLACK_WEBHOOK_URL` (선택)

## 3. Dockerfile 빌드 확인

- [ ] Python 레이어 포함 이미지로 빌드 성공
- [ ] `python scripts/run_finetune.py --dry-run` Railway 환경에서 정상 실행

## 4. Railway Cron Job

- [ ] `finetune-weekly` Cron Job 생성 완료 (`0 2 * * 1`)
- [ ] 수동 트리거로 1회 실행 → 로그 확인
- [ ] `model_versions` 업데이트 확인

## 5. 프론트엔드 검증 (Step 8 실제 환경)

- [ ] 상품 등록 + 이미지 업로드 → TagSuggestionPanel 표시 확인
- [ ] 태그 편집 후 확정 → `tag_feedback_logs` 행 삽입 확인 (Supabase Dashboard)
- [ ] predict API 타임아웃(10s) → 수동 입력 fallback 동작 확인
- [ ] 이미지 없이 등록 → TagSuggestionPanel 미표시 확인

## 6. 모니터링

- [ ] `docs/monitoring-queries.md` 쿼리 Supabase Dashboard에서 실행 확인
- [ ] Slack 알림 수신 확인 (SLACK_WEBHOOK_URL 설정 시)
