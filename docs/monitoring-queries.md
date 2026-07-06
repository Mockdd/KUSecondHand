# 모니터링 쿼리

Supabase Dashboard → SQL Editor에서 실행.

---

## 1. 일별 피드백 로그 수

```sql
SELECT
    DATE(created_at) AS day,
    COUNT(*)         AS log_count
FROM tag_feedback_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY day
ORDER BY day DESC;
```

---

## 2. removed_tags 비율 추이 (모델 정확도 간접 지표)

비율이 낮을수록 AI 예측이 사용자 기대에 가깝다는 의미.

```sql
SELECT
    DATE(created_at)                                         AS day,
    COUNT(*)                                                 AS total,
    COUNT(*) FILTER (WHERE array_length(removed_tags, 1) > 0) AS sessions_with_removal,
    ROUND(
        COUNT(*) FILTER (WHERE array_length(removed_tags, 1) > 0)::numeric
        / NULLIF(COUNT(*), 0) * 100,
        1
    )                                                        AS removal_rate_pct
FROM tag_feedback_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY day
ORDER BY day DESC;
```

---

## 3. 모델 버전별 precision / recall 추이

```sql
SELECT
    version_label,
    openai_model_id,
    is_active,
    precision_score,
    recall_score,
    sample_count,
    created_at
FROM model_versions
ORDER BY created_at DESC;
```

---

## 4. 태그 예측 캐시 hit rate

```sql
SELECT
    COUNT(*)                                               AS total_cached,
    COUNT(*) FILTER (WHERE expires_at > NOW())             AS still_valid,
    COUNT(*) FILTER (WHERE expires_at <= NOW())            AS expired,
    ROUND(
        COUNT(*) FILTER (WHERE expires_at > NOW())::numeric
        / NULLIF(COUNT(*), 0) * 100,
        1
    )                                                      AS valid_rate_pct
FROM tag_prediction_cache;
```

---

## 5. 자주 제거되는 태그 Top 10 (프롬프트 개선 참고용)

```sql
SELECT
    tag,
    COUNT(*) AS removed_count
FROM tag_feedback_logs,
     UNNEST(removed_tags) AS tag
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY tag
ORDER BY removed_count DESC
LIMIT 10;
```

---

## 6. 자주 추가되는 태그 Top 10 (프롬프트 개선 참고용)

```sql
SELECT
    tag,
    COUNT(*) AS added_count
FROM tag_feedback_logs,
     UNNEST(added_tags) AS tag
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY tag
ORDER BY added_count DESC
LIMIT 10;
```

---

## 7. 활성 모델 확인

```sql
SELECT model_version_id, version_label, openai_model_id, is_active, created_at
FROM model_versions
WHERE is_active = true;
```
