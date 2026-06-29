# KUSecondHand — Data Flywheel Action Plan

> **3명 팀 분담안** — 팀원 0: (DB + ML), 팀원 1: 프론트엔드 2단계, 팀원 2: DevOps 2단계
> 기반 문서: `KUSecondHand_DataFlyWheel.txt`

---

## 현재 진행 상태 (2026-06-29)

- Step 1~6 완료.
- `feature/flywheel-plan` 브랜치는 작업 완료 후 삭제됨.
- 이후 작업은 `staging` 브랜치를 기준으로 단계별 feature 브랜치를 분기한다.
- Step 7 코드 구현 완료.
- Step 8-1/8-3 완료: 판매 등록 페이지의 `productId` 제약 정리, 등록 성공 후 태그 제안 패널 전환 구현, FE 테스트 문서 작성.
- Step 8 실제 환경 검증과 Step 9~10 남음.
- 실제 판매 등록 진입점은 `src/app/(main)/sell/page.tsx`가 아니라 리다이렉트 대상인 `src/app/(main)/products/new/page.tsx`다.

## 브랜치/배포 워크플로우 (Step 7 이후)

1. `staging`에서 `feature/flywheel-stepN` 브랜치 분기.
2. 코드 작성 및 커밋.
3. 라이브 동작 영향이 있거나 Railway 환경 검증이 필요한 변경은 GitHub `debug` 브랜치에 먼저 병합 후 Railway debug 환경에서 테스트.
4. 검증 완료 후 GitHub `staging` 브랜치 PR에 병합.

`debug` 병합 생략 가능 조건:
- 문서, Python 스크립트, 설정 파일처럼 라이브 앱 동작에 직접 영향이 없는 변경.
- Railway debug 환경에서 검증할 수 없는 변경.
- 위 조건에 해당하면 feature 브랜치에서 바로 `staging` PR로 진행.

GitHub PR 생성 기준:
- base: `staging`
- compare: `feature/flywheel-stepN`

## 목적

KUSecondHand 서비스에 **데이터 플라이휠 파이프라인**을 구축해서 사용자가 매물 등록할 때 AI가 태그 초안을 제안하면 사용자 수정 행동을 로그로 기록하게 함. 주기적으로 그 데이터로 모델을 파인튜닝시켜 모델의 예측 성능을 점점 향상시키는 사이클을 만듦. 

## Output들

| 영역 | 핵심 파일/리소스 |
|---|---|
| DB | `db/migrations/014-data-flywheel.sql`, `src/types/feedback.ts` |
| Storage | Supabase `training-datasets` 버킷 (Private) |
| API | `src/app/api/tags/predict/route.ts`, `src/app/api/tags/feedback/route.ts` |
| Python | `scripts/collect_training_data.py`, `scripts/run_finetune.py`, `scripts/evaluate_model.py` |
| Frontend | `src/components/products/TagSuggestionPanel.tsx`, `src/hooks/useTagSuggestion.ts` |
| DevOps | `Dockerfile` (수정), Railway Cron Job, `scripts/notify_slack.py` |
| Docs | `docs/storage-training-datasets.md`, `docs/ml-pipeline.md`, `docs/monitoring-queries.md`, `docs/cron-setup.md` |

## 작업 순서

```
[팀원0 Step 1·2 — DB 스키마 + RLS + Storage]
            │
            ├──► [팀원0 Step 3 — predict API]
            │            │
            │            ├──► [팀원 1 Step 7 — 피드백 API + TagSuggestionPanel]
            │            │            │
            │            │            └──► [팀원 1 Step 8 — sell 페이지 통합 + UX]
            │            │
            │            └──► [팀원0 Step 4 — 학습 데이터 수집]
            │                         │
            │                         └──► [팀원0 Step 5 — 파인튜닝 자동화]
            │                                      │
            │                                      ├──► [팀원0 Step 6 — 평가 + E2E]
            │                                      │
            │                                      └──► [팀원 2 Step 9 — Docker + Cron]
            │                                                   │
            │                                                   └──► [팀원 2 Step 10 — 알림 + 모니터링]
```

병렬 가능 구간:
- **팀원0 Step 4·5** ↔ **팀원 1 Step 7·8** (Step 3 완료 후)
- **팀원0 Step 6** ↔ **팀원 2 Step 9** (Step 5 완료 후)

---

# 팀원0 담당 (DB + ML, 6단계)

## Step 1 — DB 스키마 + 인덱스

**수행할 것**

- `db/migrations/014-data-flywheel.sql` 작성
- 3개 테이블 생성:
  - `tag_feedback_logs` (`uuid` PK, user_id FK, product_id FK, predicted_tags `text[]`, final_tags `text[]`, added_tags `text[]`, removed_tags `text[]`, model_version, session_duration_ms, created_at)
  - `model_versions` (id PK, version_label, openai_model_id, is_active `bool`, precision_score, recall_score, sample_count, created_at)
  - `tag_prediction_cache` (image_url_hash PK, tags `text[]`, model_version, created_at, expires_at)
- 인덱스 3개: `tag_feedback_logs(user_id)`, `tag_feedback_logs(created_at)`, `tag_feedback_logs(model_version)`
- Supabase SQL Editor에서 마이그레이션 실행

**확인할 것**

- 기존 `users.uid` 타입(uuid)과 `products.pid` 타입(uuid) → FK 타입 일치
- `db/migrations/` 마지막 번호가 013인지 확인 → 014가 충돌 없는지
- `text[]` 컬럼이 기본값 `'{}'`로 NOT NULL인지

**전달할 것**

- 없음 (Step 2의 선행 조건)

---

## Step 2 — RLS 정책 + Storage 버킷

**수행할 것**

- `tag_feedback_logs` RLS:
  - INSERT: `authenticated`, 팀원0 user_id로만
  - SELECT: `service_role` 전체, 일반 사용자는 팀원0 데이터만
- `model_versions` RLS: SELECT 전체 공개
- `tag_prediction_cache` RLS: `service_role`만 R/W
- Supabase → Storage → New Bucket → `training-datasets` (Private)
- 파일 경로 컨벤션: `training-datasets/YYYY-MM-DD/finetune_{timestamp}.jsonl`
- `docs/storage-training-datasets.md` 작성 (버킷 설정 + 경로 컨벤션 + 접근 방법)
- `src/types/feedback.ts` 작성 (`TagFeedbackLog`, `ModelVersion` 인터페이스)

**확인할 것**

- 더미 user_id로 RLS INSERT/SELECT 동작 검증
- `service_role` key 누출 안 되게 backend only 사용
- TypeScript 타입이 실제 DB 컬럼명·타입과 정확히 일치

**전달할 것**

-  **팀원 1·2 모두에게**: `src/types/feedback.ts` — 두 명의 작업 시작 트리거
-  **팀원 2에게**: Storage 버킷 이름, 경로 컨벤션, 접근 방법 (`docs/storage-training-datasets.md` 링크)

---

## Step 3 — 태그 예측 API

**수행할 것**

- `src/app/api/tags/predict/route.ts` (POST)
- 요청: `{ imageUrl: string, productId: string }`
- 응답: `{ tags: string[], modelVersion: string }`
- GPT-4o-mini Vision 호출, 시스템 프롬프트로 한국어 중고거래 태그 생성 지침 부여
- 프롬프트: "이 중고 상품 이미지를 보고 한국어 태그를 최대 8개 생성하세요. 카테고리, 상태, 특징 포함"
- `tag_prediction_cache` 조회 → 캐시 hit이면 즉시 반환, miss면 호출 후 저장 (TTL 24h)
- `model_versions WHERE is_active=true LIMIT 1` 조회해서 모델 ID 사용
- 활성 모델 없으면 fallback (`gpt-4o-mini` base)

**확인할 것**

- Railway Variables에 `OPENAI_API_KEY` 존재 (staging/debug 환경 모두)
- `model_versions`에 기본 행 1개 시드 (`gpt-4o-mini`, `is_active=true`) — 비어있으면 무한 fallback
- 캐시 TTL 24h 만료 동작 검증
- 이미지 URL이 Supabase Storage public URL일 때 OpenAI가 접근 가능한지 확인

**전달할 것**

-  **팀원 1에게**: predict API 요청/응답 스펙 (타입 포함). 프론트 `useTagSuggestion` 훅에서 호출
  - endpoint: `POST /api/tags/predict`
  - request: `{ imageUrl: string, productId: string }`
  - response: `{ tags: string[], modelVersionId: number, modelLabel: string, cached: boolean }`
  - expected latency: cache hit 약 50ms, cache miss 약 3~5s

---

## Step 4 — 학습 데이터 수집 스크립트

**수행할 것**

- `scripts/collect_training_data.py` 작성
- 의존성: `pip install openai supabase-py pandas Pillow python-dotenv tqdm`
- 쿼리: `tag_feedback_logs WHERE (removed_tags != '{}' OR added_tags != '{}') AND created_at > now() - interval '7 days'`
- 이미지 URL → base64 변환 (Supabase Storage signed URL 사용)
- OpenAI Fine-tuning 형식으로 변환:
  ```json
  {"messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": [{"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}]},
    {"role": "assistant", "content": "tag1, tag2, tag3"}
  ]}
  ```
- `/tmp/finetune_{timestamp}.jsonl`로 저장

**확인할 것**

- Supabase signed URL 만료(기본 1h) 안에 이미지 다운로드 완료
- 샘플 수가 `FINETUNE_MIN_SAMPLES`(예: 50) 미만이면 abort + 로그
- JSONL 1줄당 평균 토큰 수 추정 (파인튜닝 비용 계산 기초)
- 한 줄당 OpenAI 제약 (최대 32k 토큰) 안 넘는지

**전달할 것**

-  **전체 팀에게**: 파인튜닝 비용 예측 = 샘플 수 × 평균 토큰 × 단가 (gpt-4o-mini 기준)

---

## Step 5 — 파인튜닝 자동화 스크립트

**수행할 것**

- `scripts/run_finetune.py` 작성
- 흐름:
  1. `collect_training_data.py` 실행 → JSONL 생성
  2. `openai.files.create(file=..., purpose="fine-tune")` → file_id
  3. `openai.fine_tuning.jobs.create(model="gpt-4o-mini", training_file=file_id)` → job_id
  4. 5분 간격 폴링: `openai.fine_tuning.jobs.retrieve(job_id)` → status가 `succeeded`까지
  5. 성공 시 트랜잭션으로:
     - 기존 `model_versions SET is_active=false WHERE is_active=true`
     - 새 행 INSERT (`is_active=true`, `openai_model_id` = 응답의 fine_tuned_model)
  6. JSONL을 `training-datasets/YYYY-MM-DD/` 버킷에 업로드, 로컬 삭제
- `--dry-run` 옵션: 데이터 수집까지만 수행, OpenAI 호출 skip

**확인할 것**

- OpenAI 계정 Tier 1+ (Fine-tuning 권한)
- 잡 실패 시 `model_versions` 더럽혀지지 않게 try/except로 INSERT 보호
- 파인튜닝 잡 최대 시간 (보통 30분~2시간) → 타임아웃 고려
- `is_active` 갱신이 동시 호출 시 race condition 안 나는지 (트랜잭션 또는 advisory lock)

**전달할 것**

-  **팀원 2에게**:
  - 스크립트 실행 명령: `python scripts/run_finetune.py`
  - 환경변수: `OPENAI_API_KEY`, `OPENAI_ORG_ID`, `FINETUNE_MIN_SAMPLES`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - 예상 실행시간: 30분~2시간
  - `--dry-run` 옵션 사용법

---

## Step 6 — 모델 평가 + E2E 통합 검증

**수행할 것**

- `scripts/evaluate_model.py` 작성
  - 테스트 이미지 20장 + 정답 태그 세트 준비
  - 활성 모델로 예측 → Precision·Recall 계산
  - 이전 모델 점수와 비교 → `model_versions.precision_score`, `recall_score`에 기록
- `proc/seed/10-flywheel-test.sql` 작성 (더미 피드백 50건)
- E2E 시나리오:
  1. 더미 데이터 삽입
  2. `run_finetune.py` 실행 → 새 모델 생성 확인
  3. predict API 호출 → 새 모델 사용 여부 확인
  4. 평가 점수 기록 확인
- `docs/ml-pipeline.md` 작성 (스크립트 실행법, 환경변수, 파라미터)

**확인할 것**

- 새 모델이 이전 모델보다 점수 낮으면 자동 활성화 막을지(롤백 정책) — 일단 경고 로그만 남기고 활성화는 유지하는 것 권장
- predict API가 model_versions 변경을 즉시 반영하는지(캐시 무효화 필요)
- 평가 데이터셋이 학습 데이터와 중복되지 않게 분리

**전달할 것**

-  **전체 팀에게**: 첫 파인튜닝 결과 리포트 (Before/After Precision·Recall) + 데모

---

# 팀원 1 담당 (프론트엔드, 2단계)

> **선행 조건**: 팀원0 Step 2 완료(타입 공유), Step 3 완료(predict API)
> 현재 상태: 선행 조건 완료. `src/types/feedback.ts`, `src/app/api/tags/predict/route.ts` 존재.

## Step 7 — 피드백 API + 태그 제안 컴포넌트

**수행할 것**

- `src/app/api/tags/feedback/route.ts` (POST)
  - 요청: `{ productId, predictedTags, finalTags, modelVersion, sessionDurationMs }`
  - 서버에서 계산: `addedTags = finalTags - predictedTags`, `removedTags = predictedTags - finalTags`
  - `tag_feedback_logs` INSERT (service role)
  - 응답: `{ success: boolean, logId: string }`
- 실제 타입 파일 기준 요청 필드명:
  - `{ productId, predictedTags, finalTags, modelVersionId, sessionDurationMs }`
- `src/components/products/TagSuggestionPanel.tsx`
  - Props: `{ imageUrl: string, productId: string, onTagsConfirmed: (tags: string[]) => void }`
  - `productId`는 기존 predict API 요청 스펙상 필수
  - `/api/tags/predict` 호출 → 로딩 → 칩 형태로 태그 표시
  - 각 칩에 X 버튼 (삭제), 새 태그 직접 입력 필드 (Enter로 추가)
  - "태그 확정" 버튼 → `onTagsConfirmed` 콜백
  - 편집 시작 시각 기록 → `sessionDurationMs` 계산
- `src/hooks/useTagSuggestion.ts` (predict/feedback API 호출 로직)

**팀원0에게서 받을 것**

- `src/types/feedback.ts` (Step 2에서 전달)
- predict API 스펙 (Step 3에서 전달)

**전달할 것**

-  **팀원0에게**: 피드백 로그 데이터 샘플 (RLS 검증용)

---

## Step 8 — sell 페이지 통합 + UX

**수행할 것**

- 기존 판매 등록 Form에 `TagSuggestionPanel` 통합
  - 현재 `src/app/(main)/sell/page.tsx`는 `/products/new`로 리다이렉트만 수행
  - 실제 통합 대상: `src/app/(main)/products/new/page.tsx`
- 구현 제약:
  - `/api/tags/predict`와 `/api/tags/feedback` 모두 현재 `productId`를 요구한다.
  - 신규 등록 화면에서는 상품 생성 전 `productId`가 아직 없으므로, 이미지 선택 직후에는 Step 7 컴포넌트를 그대로 호출할 수 없다.
  - Step 8 구현은 기존 API 스펙을 유지하고, 상품 생성 성공 후 반환된 `pid`와 업로드된 첫 번째 이미지 URL을 사용해 태그 추천/피드백 흐름을 실행한다.
- 구현 순서:
  1. `src/app/(main)/products/new/page.tsx`에 태그 상태(`suggestedTags`, `confirmedTags`, `tagFeedbackPayload`)를 추가한다.
  2. 이미지 업로드 및 `/api/products` 등록 성공 후 반환된 `pid`를 확보한다.
  3. 첫 번째 이미지 URL과 `pid`로 태그 제안 UI를 열 수 있도록 한다.
  4. 사용자가 태그를 확정하면 `/api/tags/feedback`을 best-effort로 호출한다.
  5. 피드백 저장 실패는 매물 등록 성공 흐름을 막지 않는다.
- 이미지 업로드 완료 후 자동 활성화
- Form submit 시 `/api/tags/feedback` 호출 (fire-and-forget — 실패해도 매물 등록은 정상)
- UX:
  - predict 10초 타임아웃 → "태그 자동 추출 실패" + 수동 입력 fallback
  - 이미지 없으면 패널 미표시
  - 태그 최대 10개 제한
  - 키보드 접근성 (Tab/Delete)
- 모바일 반응형 테스트
- Supabase Dashboard에서 `tag_feedback_logs`에 실제 기록되는지 확인
- `docs/fe-tag-suggestion-test.md` 작성 (테스트 시나리오 + 결과)

**전달할 것**

-  **팀원0에게**: 실제 사용자 편집 패턴 관찰 (자주 삭제/추가되는 태그) — 팀원0 Step 3 프롬프트 개선 자료
-  **팀원 2에게**: 프론트엔드 사용 환경변수 최종 목록
-  **전체 팀에게**: 컴포넌트 스크린샷 + 사용 시연

---

#  팀원 2 담당 (DevOps, 2단계)

> **선행 조건**: 팀원0 Step 5 완료

## Step 9 — Docker + Railway Cron + 환경변수

**수행할 것**

- 기존 `Dockerfile`에 Python 3.10 + ML 의존성 레이어 추가
  - 멀티스테이지 권장: Node.js 앱 빌드 / Python ML 환경 분리
  - `pip install openai supabase-py pandas Pillow python-dotenv tqdm`
- Railway → Project Settings → Variables 추가:
  - `OPENAI_ORG_ID`
  - `TAG_MODEL_VERSION`
  - `FINETUNE_MIN_SAMPLES`
  - (기존 `OPENAI_API_KEY`의 Fine-tuning 권한 확인)
- `.env.example` 업데이트
- Railway → Cron Jobs → New Cron Job:
  - Schedule: `0 2 * * 1` (매주 월요일 02:00 UTC = 한국 11:00)
  - Command: `python scripts/run_finetune.py`
  - 타임아웃: 3600s
  - 재시도: 최대 2회

**팀원0에게서 받을 것**

- `run_finetune.py` 실행 명령, 환경변수 목록, 예상 실행시간 (Step 5에서 전달)

**전달할 것**

-  **팀원0에게**: Python 실행 환경의 Docker 이미지 태그, Python 경로
-  **팀원0에게**: pg_cron 설정 여부 확인 요청 (Railway Cron과 중복 방지 — 현재 계획은 Railway Cron만 사용)
-  **전체 팀에게**: Railway 배포 URL + Cron 실행 로그 접근 방법

---

## Step 10 — 알림 + 모니터링 + E2E 검증

**수행할 것**

- `scripts/notify_slack.py` (Webhook 알림)
- `run_finetune.py`에 try/except로 알림 연동 (시작/완료/실패 모두)
- 환경변수 `SLACK_WEBHOOK_URL` 추가
- 모니터링 SQL 작성 (`docs/monitoring-queries.md`):
  - 일별 피드백 로그 수
  - `removed_tags` 비율 추이 (모델 정확도 간접 지표)
  - 모델 버전별 precision/recall 추이
  - 캐시 hit rate
- 로컬에서 `python scripts/run_finetune.py --dry-run` 사전 검증
- Railway Cron Job 수동 트리거로 실제 1회 실행 테스트
- 파인튜닝 완료 후 `model_versions` 업데이트 확인
- 프론트엔드에서 새 모델 버전으로 태그 예측되는지 확인
- `docs/deployment-checklist.md` 작성

**전달할 것**

-  **전체 팀에게**: 모니터링 쿼리 + Supabase Dashboard 북마크 링크

---

# 협업 가이드

## 공유 원칙

- **공유 시점**: 각 Step 완료 직후 GitHub PR 또는 팀 채팅방에 공유
- **파일 공유**: PR Description에 출력물 파일 경로 명시
- **타입/인터페이스 변경 시**: 즉시 전체 팀에 공지
- **환경변수 추가 시**: `.env.example` 업데이트 필수

## 일정 (12일 기준)

| 기간 | 마일스톤 |
|---|---|
| Day 1~2 | 팀원0 Step 1~2 (DB + RLS + Storage + 타입 공유) |
| Day 3~5 | 팀원0 Step 3 (predict API) + 팀원 1 Step 7 (병렬 가능 구간 진입) |
| Day 4~7 | 팀원0 Step 4~5 (수집 + 파인튜닝) + 팀원 1 Step 8 |
| Day 6~8 | 팀원 2 Step 9 (Docker + Cron) |
| Day 9~10 | 팀원0 Step 6 (평가 + E2E) + 팀원 2 Step 10 (알림 + 모니터링) |
| Day 11~12 | 전체 E2E 테스트 + 버그 수정 + 문서화 + 최종 배포 |

## Day 1 즉시 할 것 (팀원0)

1. dev Supabase URL + anon key를 전체 팀에 공유
2. OpenAI 비용 예산 한도 결정 + 전체 팀 공유
3. `db/migrations/` 마지막 번호 확인 (014 충돌 여부)
4. `users.uid` / `products.pid` 컬럼 타입 확인 (FK 일치 위함)

## 변경 이력

| 일자 | 내용 | 작성자 |
|---|---|---|
| 2026-06-18 | 초안 작성 (3인 분담 — 팀원0 6단계, 팀원 2명 각 2단계) | — |
