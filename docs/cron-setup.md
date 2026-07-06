# Railway Cron Job 설정 가이드

## 개요

매주 월요일 02:00 UTC(한국 11:00)에 `run_finetune.py`를 자동 실행하는 Railway Cron Job 설정 방법.

---

## 사전 조건

- Railway 프로젝트에 서비스가 배포되어 있어야 한다.
- 아래 환경변수가 Railway Variables에 등록되어 있어야 한다.

### 필수 환경변수

| 변수 | 설명 |
|------|------|
| `OPENAI_API_KEY` | OpenAI API 키 (Fine-tuning 권한 포함) |
| `OPENAI_ORG_ID` | OpenAI Organization ID |
| `SUPABASE_URL` | Supabase 프로젝트 URL (`NEXT_PUBLIC_SUPABASE_URL`과 동일) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서비스 롤 키 |
| `FINETUNE_MIN_SAMPLES` | 파인튜닝 최소 샘플 수 (권장: `50`) |
| `FINETUNE_LOOKBACK_DAYS` | 데이터 수집 기간(일) (권장: `7`) |
| `TRAINING_DATASETS_BUCKET` | Supabase Storage 버킷명 (`training-datasets`) |
| `TAG_MODEL_VERSION` | 기본 모델 ID (예: `gpt-4o-mini`) |
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook URL (알림용, 선택) |

---

## Cron Job 생성 순서

1. Railway Dashboard → 해당 프로젝트 선택
2. 좌측 메뉴 **Deployments** → **Cron Jobs** 탭
3. **New Cron Job** 클릭
4. 아래 값 입력:

| 항목 | 값 |
|------|----|
| Name | `finetune-weekly` |
| Schedule | `0 2 * * 1` |
| Command | `python scripts/run_finetune.py` |
| Timeout | `3600` (초) |
| Retries | `2` |

5. **Create** 저장

---

## 스케줄 설명

```
0 2 * * 1
│ │ │ │ └── 요일 (1 = 월요일)
│ │ │ └──── 월 (*)
│ │ └────── 일 (*)
│ └──────── 시 (02:00 UTC = 한국 11:00 KST)
└────────── 분 (0)
```

---

## 수동 트리거

Railway Dashboard → Cron Jobs → `finetune-weekly` → **Trigger Now** 버튼으로 수동 실행 가능.

첫 배포 후 수동 트리거로 1회 실행해서 `model_versions` 업데이트 여부를 확인할 것.

---

## 실행 흐름 요약

```
Cron 트리거
  → collect_training_data.py (Supabase에서 피드백 로그 수집 → JSONL 생성)
  → 샘플 수 < FINETUNE_MIN_SAMPLES 이면 abort
  → OpenAI Fine-tuning Job 생성 (30분~2시간 소요)
  → 성공 시 model_versions 갱신 (기존 is_active=false, 신규 INSERT)
  → JSONL → Supabase Storage 업로드 후 로컬 삭제
  → Slack 알림 발송 (SLACK_WEBHOOK_URL 설정 시)
```

---

## 로그 확인

Railway Dashboard → Deployments → 해당 Cron 실행 항목 → **View Logs**
