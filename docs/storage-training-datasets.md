# Storage: training-datasets 버킷

데이터 플라이휠 파이프라인의 파인튜닝 학습 데이터(JSONL) 백업을 위한 Supabase Storage 버킷.

## 버킷 설정

- **이름**: `training-datasets`
- **공개 설정**: **Private** (Public 아님)
- **MIME 제한**: 없음 (JSONL 파일 업로드)
- **파일 사이즈 제한**: 기본값 사용

### 생성 방법

1. Supabase Dashboard → Storage → **New Bucket**
2. Name: `training-datasets`
3. Public bucket: **OFF** (반드시)
4. Create

## 접근 정책

- **읽기/쓰기**: `service_role` 키를 가진 서버 코드만 가능
- **anon / authenticated**: 모든 접근 차단

→ Storage 정책 별도 추가 불필요. Private 버킷은 기본적으로 service_role 만 접근 가능.

> ⚠️ 만약 Supabase 가이드에서 별도 INSERT/SELECT 정책을 요구하면, **추가하지 말 것**. 학습 데이터는 절대 클라이언트에 노출되면 안 됨.

## 파일 경로 컨벤션

```
training-datasets/
└── YYYY-MM-DD/
    └── finetune_{unix_timestamp}.jsonl
```

예시:
- `training-datasets/2026-06-18/finetune_1718700000.jsonl`
- `training-datasets/2026-06-25/finetune_1719304800.jsonl`

날짜별 폴더로 정리하는 이유:
- 파인튜닝 잡 추적이 쉽다 (실행일과 데이터 1:1 매칭)
- Supabase Dashboard 에서 시각적으로 탐색 용이
- 추후 30일 이상 된 데이터 일괄 삭제 시 폴더 단위로 정리 가능

## 환경변수

`run_finetune.py` 가 사용하는 환경변수:

```bash
SUPABASE_URL=https://bxgpjheyxkjldpwabyni.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
TRAINING_DATASETS_BUCKET=training-datasets
```

## 백업 흐름

1. `collect_training_data.py` → 로컬 `/tmp/finetune_{ts}.jsonl` 생성
2. `openai.files.create()` 로 OpenAI 에 업로드 + 파인튜닝 시작
3. 잡 성공 시 동일 JSONL 을 `training-datasets/{date}/finetune_{ts}.jsonl` 로 백업
4. 백업 성공 확인 후 로컬 `/tmp` 파일 삭제

## 보존 정책 (TBD)

학습 데이터 백업은 다음 용도로 보존:
- 동일 데이터셋으로 재파인튜닝 시 재현성
- 모델 정확도 저하 시 학습 데이터 디버깅
- 데이터 분포 추이 분석

→ 운영 시 30일 ~ 90일 보존 후 자동 삭제 정책 검토 (별도 cron job).
