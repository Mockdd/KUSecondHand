"""
run_finetune.py
───────────────
데이터 플라이휠 Step 5 — 파인튜닝 자동화 스크립트

흐름:
  1. collect_training_data.py 실행 → JSONL 생성
  2. OpenAI Files API 로 JSONL 업로드 → file_id 획득
  3. Fine-tuning Job 생성 → job_id 획득
  4. 5분 간격 폴링 → succeeded / failed 대기
  5. 성공 시:
     a. model_versions INSERT (is_active=true) + 기존 활성 모델 비활성화
     b. JSONL 을 Supabase Storage training-datasets 버킷에 백업
     c. 로컬 JSONL 삭제
  6. 실패 시: 에러 로그 출력 + sys.exit(1)

사용법:
  python scripts/run_finetune.py
  python scripts/run_finetune.py --dry-run   # 데이터 수집까지만, OpenAI 호출 skip

필요 환경변수:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  OPENAI_API_KEY
  OPENAI_ORG_ID            (선택)
  FINETUNE_MIN_SAMPLES     (기본값: 50)
  FINETUNE_LOOKBACK_DAYS   (기본값: 7)
  TRAINING_DATASETS_BUCKET (기본값: training-datasets)
"""

import argparse
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client, Client

from notify_slack import notify_failure, notify_skipped, notify_start, notify_success

load_dotenv()

# ── 설정 ──────────────────────────────────────────────────────────────────────

SUPABASE_URL            = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY    = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
OPENAI_API_KEY          = os.environ["OPENAI_API_KEY"]
OPENAI_ORG_ID           = os.getenv("OPENAI_ORG_ID")
TRAINING_BUCKET         = os.getenv("TRAINING_DATASETS_BUCKET", "training-datasets")

POLL_INTERVAL_SEC  = 300   # 5분
MAX_POLL_ATTEMPTS  = 30    # 최대 2.5시간 대기
BASE_MODEL         = "gpt-4o-mini-2024-07-18"  # fine-tuning 지원 버전


# ── 클라이언트 ────────────────────────────────────────────────────────────────

def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def get_openai() -> OpenAI:
    return OpenAI(
        api_key=OPENAI_API_KEY,
        organization=OPENAI_ORG_ID,
    )


# ── Step 1: 학습 데이터 수집 ──────────────────────────────────────────────────

def run_collect(days: int) -> Path:
    """collect_training_data.py 를 subprocess 로 실행하고 JSONL 경로 반환."""
    script = Path(__file__).parent / "collect_training_data.py"
    result = subprocess.run(
        [sys.executable, str(script), "--days", str(days)],
        capture_output=True,
        text=True,
    )

    print(result.stdout)
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        raise RuntimeError("collect_training_data.py 실패 — 파인튜닝 중단")

    # collect 스크립트가 마지막에 OUTPUT_PATH=... 출력
    match = re.search(r"^OUTPUT_PATH=(.+)$", result.stdout, re.MULTILINE)
    if not match:
        raise RuntimeError("OUTPUT_PATH 를 collect 스크립트에서 찾을 수 없습니다")

    path = Path(match.group(1).strip())
    if not path.exists():
        raise RuntimeError(f"JSONL 파일이 존재하지 않습니다: {path}")

    return path


# ── Step 2: OpenAI 파일 업로드 ────────────────────────────────────────────────

def upload_jsonl(client: OpenAI, jsonl_path: Path) -> str:
    """JSONL 파일을 OpenAI Files API 로 업로드하고 file_id 반환."""
    print(f"\n2️⃣  OpenAI 파일 업로드 중: {jsonl_path.name}")
    with open(jsonl_path, "rb") as f:
        resp = client.files.create(file=f, purpose="fine-tune")
    print(f"   → file_id: {resp.id}")
    return resp.id


# ── Step 3: 파인튜닝 잡 생성 ──────────────────────────────────────────────────

def create_finetune_job(client: OpenAI, file_id: str) -> str:
    """Fine-tuning Job 생성 후 job_id 반환."""
    print(f"\n3️⃣  파인튜닝 잡 생성 중 (base: {BASE_MODEL})")
    job = client.fine_tuning.jobs.create(
        model=BASE_MODEL,
        training_file=file_id,
        hyperparameters={"n_epochs": 3},
    )
    print(f"   → job_id: {job.id}  status: {job.status}")
    return job.id


# ── Step 4: 완료 폴링 ────────────────────────────────────────────────────────

def poll_until_done(client: OpenAI, job_id: str) -> str:
    """
    5분 간격으로 잡 상태 확인.
    succeeded → fine_tuned_model ID 반환.
    failed / cancelled → 예외.
    """
    print(f"\n4️⃣  파인튜닝 완료 대기 중 (최대 {MAX_POLL_ATTEMPTS * POLL_INTERVAL_SEC // 60}분)")
    for attempt in range(1, MAX_POLL_ATTEMPTS + 1):
        job = client.fine_tuning.jobs.retrieve(job_id)
        status = job.status
        elapsed = attempt * POLL_INTERVAL_SEC // 60
        print(f"   [{elapsed}분 경과] status: {status}")

        if status == "succeeded":
            model_id = job.fine_tuned_model
            print(f"   ✅ 완료! fine_tuned_model: {model_id}")
            return model_id

        if status in ("failed", "cancelled"):
            error = getattr(job, "error", None)
            raise RuntimeError(
                f"파인튜닝 잡 {status}: {error}"
            )

        time.sleep(POLL_INTERVAL_SEC)

    raise RuntimeError(f"타임아웃: {MAX_POLL_ATTEMPTS}회 폴링 후에도 완료되지 않음")


# ── Step 5a: model_versions 업데이트 ──────────────────────────────────────────

def update_model_versions(supabase: Client, openai_model_id: str, sample_count: int) -> int:
    """
    트랜잭션 대신 순차 실행:
      1. 새 모델 INSERT (is_active=True)
         → 부분 유니크 인덱스(uq_model_versions_active)가 충돌을 방지하므로,
           기존 active 모델을 먼저 비활성화해야 함
      2. 기존 active 모델 비활성화
    """
    print("\n5️⃣  model_versions 업데이트 중...")

    now = datetime.now(timezone.utc).isoformat()
    version_label = f"ft-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M')}"

    # 1) 기존 활성 모델 비활성화
    supabase.table("model_versions").update({"is_active": False}).eq(
        "is_active", True
    ).execute()

    # 2) 새 모델 INSERT
    resp = (
        supabase.table("model_versions")
        .insert(
            {
                "version_label": version_label,
                "openai_model_id": openai_model_id,
                "is_active": True,
                "sample_count": sample_count,
                "notes": f"자동 파인튜닝 — {now}",
            }
        )
        .execute()
    )

    new_id = resp.data[0]["model_version_id"]
    print(f"   → 새 활성 모델: {version_label} (id: {new_id})")
    return new_id


# ── Step 5b: Storage 백업 ─────────────────────────────────────────────────────

def backup_to_storage(supabase: Client, jsonl_path: Path) -> None:
    """JSONL 파일을 training-datasets 버킷에 업로드."""
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    object_path = f"{date_str}/{jsonl_path.name}"

    print(f"\n6️⃣  Storage 백업 중: {TRAINING_BUCKET}/{object_path}")
    with open(jsonl_path, "rb") as f:
        supabase.storage.from_(TRAINING_BUCKET).upload(
            path=object_path,
            file=f,
            file_options={"content-type": "application/jsonl"},
        )
    print(f"   → 백업 완료")


# ── Step 5c: 로컬 파일 삭제 ───────────────────────────────────────────────────

def cleanup_local(jsonl_path: Path) -> None:
    jsonl_path.unlink(missing_ok=True)
    print(f"   → 로컬 파일 삭제: {jsonl_path}")


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="파인튜닝 자동화")
    parser.add_argument("--days",    type=int,
                        default=int(os.getenv("FINETUNE_LOOKBACK_DAYS", "7")),
                        help="수집 기간 (일, 기본: %(default)s)")
    parser.add_argument("--dry-run", action="store_true",
                        help="데이터 수집까지만, OpenAI 호출 skip")
    args = parser.parse_args()

    print("\n🚀 파인튜닝 파이프라인 시작")
    print(f"   수집 기간: 최근 {args.days}일")
    if args.dry_run:
        print("   ⚡ dry-run 모드: OpenAI 호출 없음\n")

    notify_start(args.days, dry_run=args.dry_run)

    # Step 1: 데이터 수집
    print("\n1️⃣  학습 데이터 수집")
    try:
        jsonl_path = run_collect(args.days)
    except RuntimeError as e:
        msg = str(e)
        print(f"\n❌ {msg}", file=sys.stderr)
        notify_skipped(msg)
        sys.exit(1)

    sample_count = sum(1 for _ in open(jsonl_path, encoding="utf-8"))
    print(f"   → JSONL: {jsonl_path} ({sample_count}건)")

    if args.dry_run:
        print("\n✅ dry-run 완료. OpenAI 호출 없이 종료합니다.")
        cleanup_local(jsonl_path)
        return

    openai_client = get_openai()
    supabase = get_supabase()
    fine_tuned_model = None

    try:
        # Step 2: 업로드
        file_id = upload_jsonl(openai_client, jsonl_path)

        # Step 3: 잡 생성
        job_id = create_finetune_job(openai_client, file_id)

        # Step 4: 폴링
        fine_tuned_model = poll_until_done(openai_client, job_id)

        # Step 5a: DB 업데이트
        version_label_prefix = f"ft-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M')}"
        update_model_versions(supabase, fine_tuned_model, sample_count)

        # Step 5b: Storage 백업
        backup_to_storage(supabase, jsonl_path)

        notify_success(fine_tuned_model, sample_count)

    except Exception as e:
        print(f"\n❌ 파인튜닝 실패: {e}", file=sys.stderr)
        notify_failure(str(e))
        sys.exit(1)
    finally:
        # 성공·실패 모두 로컬 파일 삭제
        cleanup_local(jsonl_path)

    print("\n🎉 파인튜닝 파이프라인 완료!")
    print(f"   fine_tuned_model: {fine_tuned_model}")
    print(f"   학습 샘플: {sample_count}건")


if __name__ == "__main__":
    main()
