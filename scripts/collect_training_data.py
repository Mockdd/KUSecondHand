"""
collect_training_data.py
────────────────────────
데이터 플라이휠 Step 4 — 학습 데이터 수집 스크립트

흐름:
  1. tag_feedback_logs 에서 최근 N일치 수정 로그 조회
     (added_tags != '{}' OR removed_tags != '{}' 조건)
  2. 각 로그의 product 이미지 URL → Supabase signed URL → base64 변환
  3. OpenAI Fine-tuning JSONL 형식으로 변환
  4. /tmp/finetune_{timestamp}.jsonl 저장
  5. 샘플 수가 FINETUNE_MIN_SAMPLES 미만이면 abort

사용법:
  python scripts/collect_training_data.py
  python scripts/collect_training_data.py --days 14
  python scripts/collect_training_data.py --dry-run   # 수집 결과만 출력, 파일 저장 안 함

필요 환경변수 (.env 또는 Railway Variables):
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  FINETUNE_MIN_SAMPLES   (기본값: 50)
  FINETUNE_LOOKBACK_DAYS (기본값: 7)
"""

import argparse
import base64
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv
from supabase import create_client, Client
from tqdm import tqdm

load_dotenv()

# ── 설정 ──────────────────────────────────────────────────────────────────────

SUPABASE_URL            = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY    = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
FINETUNE_MIN_SAMPLES    = int(os.getenv("FINETUNE_MIN_SAMPLES", "50"))
FINETUNE_LOOKBACK_DAYS  = int(os.getenv("FINETUNE_LOOKBACK_DAYS", "7"))

OUTPUT_DIR   = Path("/tmp")
SIGNED_URL_EXPIRES = 3600   # 1시간 (이미지 다운로드 충분)
IMAGE_TIMEOUT_SEC  = 30
MAX_TAGS_PER_LINE  = 8      # JSONL 한 줄당 최대 태그 수

SYSTEM_PROMPT = (
    "당신은 한국 대학생 중고거래 플랫폼의 태그 추천 도우미입니다. "
    "이미지를 보고 해당 상품에 어울리는 한국어 태그를 최대 8개 추천하세요. "
    "각 태그는 1~10자 이내의 짧은 한국어 단어 또는 구이며, "
    "카테고리·상태·특징 위주로 추천하세요. "
    "응답은 JSON 배열 형식: [\"태그1\", \"태그2\", ...] — 다른 텍스트 없이 JSON 배열만 출력."
)

# ── Supabase 클라이언트 ────────────────────────────────────────────────────────

def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# ── 피드백 로그 조회 ──────────────────────────────────────────────────────────

def fetch_feedback_logs(supabase: Client, lookback_days: int) -> list[dict]:
    """수정이 실제로 발생한 로그만 조회 (부분 인덱스와 정확히 매칭)."""
    since = (
        datetime.now(timezone.utc) - timedelta(days=lookback_days)
    ).isoformat()

    resp = (
        supabase.table("tag_feedback_logs")
        .select(
            "feedback_log_id, predicted_tags, final_tags, "
            "added_tags, removed_tags, product_id, created_at"
        )
        .gte("created_at", since)
        .execute()
    )

    # 수정이 있는 로그만 필터 (added 또는 removed 비어있지 않음)
    logs = [
        row for row in (resp.data or [])
        if (row.get("added_tags") or row.get("removed_tags"))
    ]
    return logs


# ── 이미지 URL 조회 ───────────────────────────────────────────────────────────

def fetch_product_image_url(supabase: Client, product_id: str) -> str | None:
    """product_images 에서 첫 번째 이미지 URL 반환."""
    resp = (
        supabase.table("product_images")
        .select("image_url")
        .eq("pid", product_id)
        .order("display_order")
        .limit(1)
        .execute()
    )
    rows = resp.data or []
    return rows[0]["image_url"] if rows else None


def make_signed_url(supabase: Client, image_url: str) -> str | None:
    """
    Supabase Storage URL이면 signed URL로 변환, 아니면 원본 반환.
    외부 URL(Unsplash 등)은 그대로 사용.
    """
    storage_prefix = f"{SUPABASE_URL}/storage/v1/object/public/"
    if not image_url.startswith(storage_prefix):
        return image_url  # 외부 URL은 그대로

    path_part = image_url.removeprefix(storage_prefix)
    bucket, *rest = path_part.split("/", 1)
    object_path = rest[0] if rest else ""

    try:
        resp = supabase.storage.from_(bucket).create_signed_url(
            object_path, SIGNED_URL_EXPIRES
        )
        return resp.get("signedURL") or resp.get("signedUrl")
    except Exception as e:
        print(f"  ⚠️  signed URL 생성 실패 ({object_path}): {e}", file=sys.stderr)
        return None


# ── 이미지 → base64 ───────────────────────────────────────────────────────────

def image_url_to_base64(url: str) -> str | None:
    """이미지 URL을 data URI base64 문자열로 변환."""
    try:
        resp = requests.get(url, timeout=IMAGE_TIMEOUT_SEC)
        resp.raise_for_status()
        content_type = resp.headers.get("Content-Type", "image/jpeg").split(";")[0].strip()
        b64 = base64.b64encode(resp.content).decode("utf-8")
        return f"data:{content_type};base64,{b64}"
    except Exception as e:
        print(f"  ⚠️  이미지 다운로드 실패 ({url[:60]}...): {e}", file=sys.stderr)
        return None


# ── JSONL 변환 ────────────────────────────────────────────────────────────────

def build_jsonl_line(image_data_uri: str, final_tags: list[str]) -> dict:
    """
    OpenAI Vision Fine-tuning JSONL 형식.
    https://platform.openai.com/docs/guides/fine-tuning/vision
    """
    tags_str = json.dumps(final_tags[:MAX_TAGS_PER_LINE], ensure_ascii=False)
    return {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "이 상품 이미지를 분석해서 태그를 추천해주세요.",
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": image_data_uri},
                    },
                ],
            },
            {"role": "assistant", "content": tags_str},
        ]
    }


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="태그 학습 데이터 수집")
    parser.add_argument("--days",    type=int, default=FINETUNE_LOOKBACK_DAYS,
                        help="최근 N일치 로그 수집 (기본: %(default)s)")
    parser.add_argument("--dry-run", action="store_true",
                        help="파일 저장 없이 수집 결과만 출력")
    args = parser.parse_args()

    print(f"\n📦 태그 학습 데이터 수집 시작 (최근 {args.days}일)")
    print(f"   최소 샘플 수: {FINETUNE_MIN_SAMPLES}")
    if args.dry_run:
        print("   ⚡ dry-run 모드: 파일 저장 안 함\n")

    supabase = get_supabase()

    # 1. 피드백 로그 조회
    print("1️⃣  피드백 로그 조회 중...")
    logs = fetch_feedback_logs(supabase, args.days)
    print(f"   → {len(logs)}건 조회됨")

    if len(logs) < FINETUNE_MIN_SAMPLES:
        print(
            f"\n❌  샘플 부족: {len(logs)}건 < 최소 {FINETUNE_MIN_SAMPLES}건\n"
            "    파인튜닝을 중단합니다. 더 많은 사용자 피드백이 쌓인 후 재시도하세요.",
            file=sys.stderr,
        )
        sys.exit(1)

    # 2. 이미지 다운로드 + JSONL 변환
    print("\n2️⃣  이미지 다운로드 및 JSONL 변환 중...")
    jsonl_lines: list[dict] = []
    skipped = 0

    for log in tqdm(logs, unit="건"):
        product_id = log.get("product_id")
        final_tags = log.get("final_tags") or []

        if not product_id or not final_tags:
            skipped += 1
            continue

        # 이미지 URL 조회
        image_url = fetch_product_image_url(supabase, product_id)
        if not image_url:
            skipped += 1
            continue

        # Supabase Storage → signed URL
        signed = make_signed_url(supabase, image_url)
        if not signed:
            skipped += 1
            continue

        # base64 변환
        data_uri = image_url_to_base64(signed)
        if not data_uri:
            skipped += 1
            continue

        jsonl_lines.append(build_jsonl_line(data_uri, final_tags))

    print(f"\n   → 성공: {len(jsonl_lines)}건 / 스킵: {skipped}건")

    # 3. 최소 샘플 재확인
    if len(jsonl_lines) < FINETUNE_MIN_SAMPLES:
        print(
            f"\n❌  유효 샘플 부족: {len(jsonl_lines)}건 < 최소 {FINETUNE_MIN_SAMPLES}건\n"
            "    이미지 누락 또는 다운로드 실패가 많습니다. 로그를 확인하세요.",
            file=sys.stderr,
        )
        sys.exit(1)

    # 4. 비용 추정
    avg_tokens_per_line = 1200  # 이미지 1장 기준 rough estimate (gpt-4o-mini)
    total_tokens = len(jsonl_lines) * avg_tokens_per_line
    cost_usd = total_tokens / 1_000_000 * 3.0  # gpt-4o-mini fine-tuning: $3/1M tokens
    print(f"\n💰 파인튜닝 비용 추정: ~{total_tokens:,} 토큰 / ~${cost_usd:.2f} USD")

    if args.dry_run:
        print("\n✅ dry-run 완료. 파일은 저장하지 않았습니다.")
        print(f"   유효 샘플: {len(jsonl_lines)}건")
        return

    # 5. JSONL 파일 저장
    timestamp = int(time.time())
    output_path = OUTPUT_DIR / f"finetune_{timestamp}.jsonl"

    print(f"\n3️⃣  JSONL 파일 저장 중: {output_path}")
    with open(output_path, "w", encoding="utf-8") as f:
        for line in jsonl_lines:
            f.write(json.dumps(line, ensure_ascii=False) + "\n")

    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"   → 저장 완료: {len(jsonl_lines)}건 / {file_size_mb:.1f} MB")
    print(f"\n✅ 수집 완료: {output_path}")

    # 6. 경로를 환경 변수처럼 출력 (run_finetune.py 가 캡처해서 사용)
    print(f"\nOUTPUT_PATH={output_path}")


if __name__ == "__main__":
    main()
