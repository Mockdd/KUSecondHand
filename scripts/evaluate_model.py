"""
evaluate_model.py
─────────────────
데이터 플라이휠 Step 6 — 모델 평가 스크립트

흐름:
  1. 테스트 데이터셋 로드 (하드코딩된 이미지 URL + 정답 태그)
  2. 현재 활성 모델로 각 이미지 태그 예측 (/api/tags/predict 호출)
  3. Precision · Recall 계산
  4. model_versions 테이블에 점수 기록
  5. 이전 모델 점수와 비교 → 경고 출력 (자동 롤백은 하지 않음)

평가 방식:
  옵션 C (현재): 하드코딩된 소규모 테스트셋 (이미지 URL + 정답 태그)
  옵션 A (추후 확장): tag_feedback_logs 에서 최근 N건을 자동으로 평가셋으로 분리

사용법:
  python scripts/evaluate_model.py
  python scripts/evaluate_model.py --dry-run   # DB 기록 없이 점수만 출력

필요 환경변수:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  APP_URL   (predict API 호출용, 예: https://ku-secondhand-debug.up.railway.app)
"""

import argparse
import json
import os
import sys
import time

import requests
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# ── 설정 ──────────────────────────────────────────────────────────────────────

SUPABASE_URL         = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
APP_URL              = os.environ["APP_URL"].rstrip("/")

PREDICT_ENDPOINT = f"{APP_URL}/api/tags/predict"
REQUEST_TIMEOUT  = 20   # seconds
REQUEST_DELAY    = 1.0  # 예측 호출 사이 딜레이 (rate limit 방지)


# ── 테스트 데이터셋 (옵션 C) ──────────────────────────────────────────────────
#
# 각 항목: { "image_url": ..., "expected_tags": [...] }
# expected_tags: 이 이미지에 반드시 포함되어야 할 핵심 태그
#
# 확장 방법 (옵션 A):
#   아래 TEST_DATASET 을 하드코딩 대신 tag_feedback_logs 에서
#   자동으로 불러오는 함수로 교체. collect_training_data.py 의
#   fetch_feedback_logs() 참고.

TEST_DATASET = [
    {
        "image_url": "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400",
        "expected_tags": ["노트북", "전자기기"],
        "description": "노트북",
    },
    {
        "image_url": "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=400",
        "expected_tags": ["도서", "책"],
        "description": "책/교재",
    },
    {
        "image_url": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400",
        "expected_tags": ["커피", "음료"],
        "description": "커피",
    },
    {
        "image_url": "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=400",
        "expected_tags": ["단백질", "보충제"],
        "description": "프로틴",
    },
    {
        "image_url": "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400",
        "expected_tags": ["이어폰", "전자기기"],
        "description": "이어폰",
    },
]


# ── Supabase 클라이언트 ────────────────────────────────────────────────────────

def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# ── 활성 모델 조회 ────────────────────────────────────────────────────────────

def fetch_active_model(supabase: Client) -> dict | None:
    resp = (
        supabase.table("model_versions")
        .select("model_version_id, version_label, openai_model_id, precision_score, recall_score")
        .eq("is_active", True)
        .maybeSingle()
        .execute()
    )
    return resp.data


# ── 태그 예측 호출 ────────────────────────────────────────────────────────────

def predict_tags(image_url: str, product_id: str = "eval-test") -> list[str]:
    """predict API 를 호출하고 태그 목록 반환."""
    try:
        resp = requests.post(
            PREDICT_ENDPOINT,
            json={"imageUrl": image_url, "productId": product_id},
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json().get("tags", [])
    except Exception as e:
        print(f"  ⚠️  예측 실패 ({image_url[:50]}...): {e}", file=sys.stderr)
        return []


# ── Precision · Recall 계산 ───────────────────────────────────────────────────

def calc_precision_recall(
    predicted: list[str], expected: list[str]
) -> tuple[float, float]:
    """
    Precision = 예측 태그 중 정답인 비율
    Recall    = 정답 태그 중 예측된 비율

    부분 매칭: 예측 태그가 정답 태그를 포함하거나 그 반대인 경우도 hit 으로 처리.
    예) 예측 "전자기기" ↔ 정답 "전자기기" → hit
        예측 "노트북/태블릿" ↔ 정답 "노트북" → hit (contains)
    """
    if not predicted or not expected:
        return 0.0, 0.0

    def is_match(p: str, e: str) -> bool:
        return p == e or p in e or e in p

    hits_p = sum(1 for p in predicted if any(is_match(p, e) for e in expected))
    hits_r = sum(1 for e in expected if any(is_match(p, e) for p in predicted))

    precision = hits_p / len(predicted)
    recall    = hits_r / len(expected)
    return round(precision, 4), round(recall, 4)


# ── DB 점수 기록 ──────────────────────────────────────────────────────────────

def save_scores(
    supabase: Client,
    model_version_id: int,
    precision: float,
    recall: float,
) -> None:
    supabase.table("model_versions").update(
        {"precision_score": precision, "recall_score": recall}
    ).eq("model_version_id", model_version_id).execute()


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="모델 평가")
    parser.add_argument("--dry-run", action="store_true",
                        help="DB 기록 없이 점수만 출력")
    args = parser.parse_args()

    print("\n📊 모델 평가 시작")
    if args.dry_run:
        print("   ⚡ dry-run 모드: DB 기록 안 함\n")

    supabase = get_supabase()

    # 1. 활성 모델 조회
    model = fetch_active_model(supabase)
    if not model:
        print("❌ 활성 모델이 없습니다. model_versions 테이블을 확인하세요.", file=sys.stderr)
        sys.exit(1)

    print(f"   활성 모델: {model['version_label']} ({model['openai_model_id']})")
    prev_precision = model.get("precision_score")
    prev_recall    = model.get("recall_score")
    if prev_precision is not None:
        print(f"   이전 점수: Precision={prev_precision:.4f} / Recall={prev_recall:.4f}")

    # 2. 테스트 데이터셋 평가
    print(f"\n   테스트 샘플: {len(TEST_DATASET)}개\n")
    precisions, recalls = [], []

    for i, sample in enumerate(TEST_DATASET, 1):
        desc     = sample["description"]
        expected = sample["expected_tags"]

        predicted = predict_tags(sample["image_url"], f"eval-{i}")
        p, r = calc_precision_recall(predicted, expected)
        precisions.append(p)
        recalls.append(r)

        status = "✅" if r >= 0.5 else "⚠️ "
        print(f"   {status} [{i}/{len(TEST_DATASET)}] {desc}")
        print(f"      예측: {predicted}")
        print(f"      정답: {expected}")
        print(f"      Precision={p:.4f}  Recall={r:.4f}")

        if i < len(TEST_DATASET):
            time.sleep(REQUEST_DELAY)

    # 3. 평균 점수
    avg_precision = round(sum(precisions) / len(precisions), 4)
    avg_recall    = round(sum(recalls)    / len(recalls),    4)

    print(f"\n📈 평균 점수")
    print(f"   Precision : {avg_precision:.4f}")
    print(f"   Recall    : {avg_recall:.4f}")

    # 4. 이전 모델 대비 비교
    if prev_precision is not None:
        p_diff = avg_precision - float(prev_precision)
        r_diff = avg_recall    - float(prev_recall)
        p_icon = "📈" if p_diff >= 0 else "📉"
        r_icon = "📈" if r_diff >= 0 else "📉"
        print(f"\n   이전 대비")
        print(f"   {p_icon} Precision: {p_diff:+.4f}")
        print(f"   {r_icon} Recall   : {r_diff:+.4f}")

        if avg_precision < float(prev_precision) or avg_recall < float(prev_recall):
            print(
                "\n   ⚠️  경고: 새 모델의 점수가 이전보다 낮습니다."
                "\n   자동 롤백은 하지 않습니다. 수동으로 model_versions.is_active 를 확인하세요."
            )

    # 5. DB 기록
    if not args.dry_run:
        save_scores(supabase, model["model_version_id"], avg_precision, avg_recall)
        print(f"\n✅ 점수 기록 완료 (model_version_id: {model['model_version_id']})")
    else:
        print("\n✅ dry-run 완료. DB 기록 없이 종료합니다.")


if __name__ == "__main__":
    main()
