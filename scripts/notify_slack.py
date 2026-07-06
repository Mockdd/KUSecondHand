"""
notify_slack.py
───────────────
파인튜닝 파이프라인 Slack Webhook 알림 유틸리티.

환경변수:
  SLACK_WEBHOOK_URL  Incoming Webhook URL (없으면 알림 skip)
"""

import json
import os
import urllib.request
from datetime import datetime, timezone
from typing import Optional


def _post(payload: dict) -> None:
    """SLACK_WEBHOOK_URL 이 없으면 무시, 실패해도 예외를 올리지 않는다."""
    url = os.getenv("SLACK_WEBHOOK_URL", "").strip()
    if not url:
        return

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10):
            pass
    except Exception as exc:
        print(f"[notify_slack] Slack 알림 전송 실패 (무시): {exc}")


def _now_kst() -> str:
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%d %H:%M UTC")


def notify_start(days: int, dry_run: bool = False) -> None:
    mode = " *(dry-run)*" if dry_run else ""
    _post({
        "text": (
            f":rocket: *파인튜닝 파이프라인 시작*{mode}\n"
            f"수집 기간: 최근 {days}일  |  {_now_kst()}"
        )
    })


def notify_success(fine_tuned_model: str, sample_count: int, version_label: Optional[str] = None) -> None:
    label_line = f"버전: `{version_label}`\n" if version_label else ""
    _post({
        "text": (
            f":white_check_mark: *파인튜닝 완료*\n"
            f"{label_line}"
            f"모델: `{fine_tuned_model}`\n"
            f"학습 샘플: {sample_count}건  |  {_now_kst()}"
        )
    })


def notify_failure(reason: str) -> None:
    _post({
        "text": (
            f":x: *파인튜닝 실패*\n"
            f"```{reason}```\n"
            f"{_now_kst()}"
        )
    })


def notify_skipped(reason: str) -> None:
    _post({
        "text": (
            f":warning: *파인튜닝 skip*\n"
            f"{reason}  |  {_now_kst()}"
        )
    })
