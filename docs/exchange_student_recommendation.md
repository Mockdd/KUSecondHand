# 패키지 추천 기능 상세 설계서

> 작성일: 2026-05-05
> 담당: 교환학생 파트
> 참조: exchange_student_feature_spec.md / schema.sql

---

## 목차

1. [개요](#1-개요)
2. [패키지 구성 데이터](#2-패키지-구성-데이터)
3. [추천 로직 상세](#3-추천-로직-상세)
4. [점수 계산 상세](#4-점수-계산-상세)
5. [화면 구성 상세](#5-화면-구성-상세)
6. [예외 처리](#6-예외-처리)
7. [데이터 예시](#7-데이터-예시)

---

## 1. 개요

### 1.1 목적
교환학생이 체류 국가 + 거주형태만 입력하면 필요한 물품 묶음(패키지)을 자동 추천.
ML/AI 없이 Rule-based Fallback 구조로 구현.

### 1.2 추천 방식 요약

| 항목 | 내용 |
|------|------|
| 추천 방식 | Rule-based Fallback (3순위) |
| 정렬 기준 | 보유율 70% + 세탁인증 비율 30% |
| 최대 노출 수 | 5개 |
| 학기 처리 | 같은 학기 우선, 없으면 다른 학기 포함 |
| 세탁 인증 | 미인증 셀러도 노출, 배지로 구분 |

---

## 2. 패키지 구성 데이터

### 2.1 패키지 템플릿 3종

> ⚠️ **필수 여부는 추후 팀 논의 후 확정 예정** — 지역별 기숙사 환경 차이 고려 필요

#### DORM_BASIC (기숙사 기본 패키지)
> 대상: 기숙사 입주 교환학생

| 물품 | 카테고리 | 필수 여부 | 세탁 인증 필요 |
|------|---------|----------|--------------|
| 이불 | 생활용품 > 침구 | 🔲 추후 확정 | ✅ 필요 |
| 베개 | 생활용품 > 침구 | 🔲 추후 확정 | ✅ 필요 |
| 토퍼 | 생활용품 > 침구 | 🔲 추후 확정 | ✅ 필요 |
| 전기밥솥 | 생활용품 > 소형가전 | 🔲 추후 확정 | ❌ 불필요 |
| 전기포트 | 생활용품 > 소형가전 | 🔲 추후 확정 | ❌ 불필요 |
| 스탠드 조명 | 생활용품 > 인테리어 | 🔲 추후 확정 | ❌ 불필요 |
| 멀티탭 | 생활용품 > 기타 | 🔲 추후 확정 | ❌ 불필요 |
| 청소기 | 생활용품 > 청소 | 🔲 추후 확정 | ❌ 불필요 |
| 빨래 건조대 | 생활용품 > 청소/세탁 | 🔲 추후 확정 | ❌ 불필요 |
| 옷걸이 세트 | 생활용품 > 기타 | 🔲 추후 확정 | ❌ 불필요 |
| 욕실 슬리퍼 | 생활용품 > 기타 | 🔲 추후 확정 | ❌ 불필요 |
| 수건 세트 | 생활용품 > 침구 | 🔲 추후 확정 | ✅ 필요 |
| 샤워 커튼 | 생활용품 > 기타 | 🔲 추후 확정 | ❌ 불필요 |
| 작은 선풍기 | 생활용품 > 소형가전 | 🔲 추후 확정 | ❌ 불필요 |

#### FLAT_FULL (자취/플랫셰어 풀 패키지)
> 대상: 자취/플랫셰어 교환학생
> DORM_BASIC 구성 + 아래 추가

| 물품 | 카테고리 | 필수 여부 | 세탁 인증 필요 |
|------|---------|----------|--------------|
| 냄비 세트 | 생활용품 > 주방용품 | 🔲 추후 확정 | ❌ 불필요 |
| 프라이팬 | 생활용품 > 주방용품 | 🔲 추후 확정 | ❌ 불필요 |
| 식기 세트 (그릇/컵/수저) | 생활용품 > 주방용품 | 🔲 추후 확정 | ❌ 불필요 |
| 전자레인지 | 생활용품 > 소형가전 | 🔲 추후 확정 | ❌ 불필요 |
| 도마/칼 세트 | 생활용품 > 주방용품 | 🔲 추후 확정 | ❌ 불필요 |
| 세제/청소용품 세트 | 생활용품 > 청소 | 🔲 추후 확정 | ❌ 불필요 |
| 책상/의자 | 생활용품 > 가구 | 🔲 추후 확정 | ❌ 불필요 |
| 수납장 | 생활용품 > 가구 | 🔲 추후 확정 | ❌ 불필요 |
| 쓰레기통 | 생활용품 > 기타 | 🔲 추후 확정 | ❌ 불필요 |
| 빨래바구니 | 생활용품 > 기타 | 🔲 추후 확정 | ❌ 불필요 |

#### INCOMING_DORM (고려대 기숙사 입주 패키지)
> 대상: 고려대 기숙사 배정된 incoming 교환학생
> 고려대 기숙사 규격에 맞춘 구성

| 물품 | 카테고리 | 필수 여부 | 세탁 인증 필요 |
|------|---------|----------|--------------|
| 이불 (싱글) | 생활용품 > 침구 | 🔲 추후 확정 | ✅ 필요 |
| 베개 | 생활용품 > 침구 | 🔲 추후 확정 | ✅ 필요 |
| 토퍼 (싱글) | 생활용품 > 침구 | 🔲 추후 확정 | ✅ 필요 |
| 수건 세트 | 생활용품 > 침구 | 🔲 추후 확정 | ✅ 필요 |
| 전기밥솥 (소형) | 생활용품 > 소형가전 | 🔲 추후 확정 | ❌ 불필요 |
| 전기포트 | 생활용품 > 소형가전 | 🔲 추후 확정 | ❌ 불필요 |
| 스탠드 조명 | 생활용품 > 인테리어 | 🔲 추후 확정 | ❌ 불필요 |
| 멀티탭 (국제용) | 생활용품 > 기타 | 🔲 추후 확정 | ❌ 불필요 |
| 샤워 용품 세트 | 생활용품 > 기타 | 🔲 추후 확정 | ❌ 불필요 |
| 자전거 자물쇠 | 생활용품 > 기타 | 🔲 추후 확정 | ❌ 불필요 |
| 빨래 건조대 | 생활용품 > 청소/세탁 | 🔲 추후 확정 | ❌ 불필요 |
| 우산 | 생활용품 > 기타 | 🔲 추후 확정 | ❌ 불필요 |

---

### 2.3 지역별 추가 추천 물품

> 패키지 기본 구성 외 지역 특성에 따라 추가로 필요한 물품 안내.
> **DB 별도 저장 없이 UI 레이어에서 안내 텍스트로 표시.**

| 지역 그룹 | 추가 추천 물품 | 이유 |
|----------|-------------|------|
| E1, E2, E3, E4, E5 (유럽 전체) | 어댑터/변환 플러그 | 유럽 콘센트 규격 다름 (Type C/F) |
| E1, E2, E3 | 두꺼운 패딩/방한용품 | 겨울 혹독한 유럽 날씨 |
| E3, E4 (독일/남유럽) | 자전거 | 자전거 도시 많음 |
| A1-N (일본 북부) | 방한 내복/핫팩 | 홋카이도 극한 추위 |
| A1-C, A1-W (일본 중부/서부) | 우산/우비 | 일본 장마철 |
| A2-N, A2-C, A2-S (중국 전체) | 어댑터/변환 플러그 | 중국 콘센트 규격 다름 (Type A/I) |
| N1-W, N1-C, N1-E, N1-S (미국 전체) | 차량 없이 이동 어려운 지역 → 자전거 추천 | 대중교통 열악 |
| N2-W, N2-E (캐나다) | 두꺼운 방한용품 | 혹독한 캐나다 겨울 |
| O1 (오세아니아) | 선크림/자외선 차단용품 | 강한 자외선 |
| S1, S2-BR, S2-CL, S2-REST (중남미) | 어댑터/변환 플러그 | 국가별 콘센트 규격 다양 |

#### UI 표시 방식
```
패키지 상세 화면 하단에 "이 지역에서 추가로 필요할 수 있어요" 섹션 표시

예시 (E3 독일):
┌─────────────────────────────────────┐
│  🌍 독일에서 추가로 필요할 수 있어요   │
│                                     │
│  • 어댑터/변환 플러그 (Type C/F)      │
│  • 두꺼운 패딩/방한용품               │
│  • 자전거                            │
│                                     │
│  → 관련 매물 보러가기                 │
└─────────────────────────────────────┘
```

### 2.2 지역별 추천 패키지 매핑

| 지역 그룹 | 거주형태 | 추천 패키지 | 비고 |
|----------|---------|-----------|------|
| 전체 | dorm | DORM_BASIC | 기본 |
| 전체 | flat | FLAT_FULL | 기본 |
| 고려대 incoming | dorm | INCOMING_DORM | 고려대 전용 |
| E2, O1, N2-E | flat | FLAT_FULL | 기숙사 구하기 어려운 지역 → 자취형 자동 안내 |

> **참고**: 프랑스(E2), 호주(O1), 캐나다 동부(N2-E)는 기숙사 접근성이 낮아 자취형으로 자동 안내

---

## 3. 추천 로직 상세

### 3.1 전체 흐름

```
[1] 사용자 정보 조회
      ↓
[2] 패키지 템플릿 조회 (Fallback)
      ↓
[3] 셀러 목록 조회
      ↓
[4] 셀러별 점수 계산
      ↓
[5] 정렬 및 노출
```

---

### 3.2 Step 1 — 사용자 정보 조회

`exchange_students` 테이블에서 조회:

```sql
SELECT
    uid,
    region_group,
    housing_type,
    semester
FROM exchange_students
WHERE uid = :current_user_uid
  AND onboarding_completed = TRUE;
```

**조회 결과 예시**
```json
{
  "uid": "uuid-...",
  "region_group": "E3",
  "housing_type": "dorm",
  "semester": "2026-1"
}
```

---

### 3.3 Step 2 — 패키지 템플릿 조회 (Fallback)

#### 1순위: country_code + housing_type 정확히 매칭
```sql
SELECT *
FROM essential_packages
WHERE country_code = :country_code    -- 예: 'E3'
  AND (housing_type = :housing_type OR housing_type IS NULL)
LIMIT 1;
```

#### 2순위: region_group + housing_type 매칭 (1순위 결과 없을 때)
```sql
SELECT *
FROM essential_packages
WHERE region_group = :region_group    -- 예: 'E3'
  AND (housing_type = :housing_type OR housing_type IS NULL)
LIMIT 1;
```

#### 3순위: region_group 전체 범용 (2순위 결과 없을 때)
```sql
SELECT *
FROM essential_packages
WHERE region_group IS NULL
  AND housing_type IS NULL
LIMIT 1;
```

**Fallback 적용 시 UI 안내 텍스트**

| 적용 순위 | 안내 텍스트 |
|----------|-----------|
| 1순위 | (텍스트 없음, 정확히 매칭) |
| 2순위 | "정확히 일치하는 패키지가 없어 독일 지역 기준으로 추천드려요" |
| 3순위 | "해당 지역 패키지가 없어 전체 범용 패키지를 추천드려요" |
| 결과 없음 | "현재 조건에 맞는 패키지가 없어요" |

---

### 3.4 Step 3 — 셀러 목록 조회

#### 기본 조회 (같은 학기 우선)
```sql
-- 같은 학기 셀러
SELECT
    pm.match_id,
    pm.seller_uid,
    u.nickname AS seller_name,
    pm.semester,
    COUNT(pl.listing_id) AS owned_count,
    (SELECT COUNT(*) FROM package_items WHERE package_id = pm.package_id) AS total_count
FROM package_matches pm
JOIN users u ON u.uid = pm.seller_uid
LEFT JOIN package_listings pl
    ON pl.match_id = pm.match_id
    AND pl.status = 'selling'
WHERE pm.package_id = :package_id
  AND pm.status IN ('pending', 'matched')
  AND pm.semester = :user_semester       -- 같은 학기 우선
GROUP BY pm.match_id, pm.seller_uid, u.nickname, pm.semester;
```

#### Fallback: 같은 학기 결과 없으면 다른 학기 포함
```sql
-- 다른 학기 셀러 (같은 학기 없을 때만 실행)
SELECT
    pm.match_id,
    pm.seller_uid,
    u.nickname AS seller_name,
    pm.semester,
    COUNT(pl.listing_id) AS owned_count,
    (SELECT COUNT(*) FROM package_items WHERE package_id = pm.package_id) AS total_count,
    TRUE AS is_different_semester        -- UI에서 "다른 학기 매물" 배지 표시용
FROM package_matches pm
JOIN users u ON u.uid = pm.seller_uid
LEFT JOIN package_listings pl
    ON pl.match_id = pm.match_id
    AND pl.status = 'selling'
WHERE pm.package_id = :package_id
  AND pm.status IN ('pending', 'matched')
  AND pm.semester != :user_semester      -- 다른 학기
GROUP BY pm.match_id, pm.seller_uid, u.nickname, pm.semester;
```

---

### 3.5 Step 4 — 셀러별 점수 계산

#### 보유율 계산
```
보유율 = owned_count / total_count
```

#### 세탁 인증 비율 계산
```sql
SELECT
    COUNT(*) FILTER (WHERE hc.status = 'approved') AS certified_count,
    COUNT(*) AS hygiene_required_count
FROM package_items pi
JOIN hygiene_certifications hc
    ON hc.category_id = pi.category_id
    AND hc.seller_uid = :seller_uid
WHERE pi.package_id = :package_id
  AND pi.requires_hygiene_cert = TRUE;
```

```
세탁인증 비율 = certified_count / hygiene_required_count
             (세탁 인증 필요 물품이 0개면 1.0으로 처리)
```

#### 최종 점수
```
최종 점수 = 보유율 * 0.7 + 세탁인증 비율 * 0.3
```

#### 동점 처리
동점일 경우 아래 순서로 정렬:
1. 보유율 높은 순
2. 세탁 인증 비율 높은 순
3. 매칭 등록일 최신순 (`package_matches.created_at DESC`)

---

### 3.6 Step 5 — 정렬 및 노출

```
최종 점수 높은 순 정렬
→ 상위 5개 노출
→ 이미 바이어가 요청한 셀러: 목록 유지 + "요청 진행 중" 배지 표시
→ 점수 0점 셀러 (보유 물품 0개): 목록 하단에 표시
```

---

## 4. 점수 계산 상세

### 4.1 점수 계산 예시

| 셀러 | 보유율 | 세탁인증 비율 | 최종 점수 | 순위 |
|------|--------|-------------|---------|------|
| 셀러 A | 8/10 = 0.80 | 3/3 = 1.00 | 0.80×0.7 + 1.00×0.3 = **0.86** | 1위 |
| 셀러 B | 9/10 = 0.90 | 0/3 = 0.00 | 0.90×0.7 + 0.00×0.3 = **0.63** | 3위 |
| 셀러 C | 7/10 = 0.70 | 3/3 = 1.00 | 0.70×0.7 + 1.00×0.3 = **0.79** | 2위 |
| 셀러 D | 5/10 = 0.50 | 2/3 = 0.67 | 0.50×0.7 + 0.67×0.3 = **0.55** | 4위 |
| 셀러 E | 3/10 = 0.30 | 0/3 = 0.00 | 0.30×0.7 + 0.00×0.3 = **0.21** | 5위 |

### 4.2 세탁 인증 필요 물품 없을 때

패키지에 세탁 인증 필요 물품이 없으면:
```
세탁인증 비율 = 1.0 (만점 처리)
최종 점수 = 보유율 * 0.7 + 1.0 * 0.3 = 보유율 * 0.7 + 0.3
```

---

## 5. 화면 구성 상세

### 5.1 패키지 추천 목록 (/packages)

```
┌─────────────────────────────────────┐
│  추천 패키지                          │
│  독일 · 기숙사 기준                    │  ← 추천 기준 텍스트
│                                     │
│  ⚠️ 정확히 일치하는 패키지가 없어       │  ← Fallback 시에만 표시
│     독일 지역 기준으로 추천드려요       │
├─────────────────────────────────────┤
│  [패키지 카드 1] — 점수 0.86           │
│  기숙사 기본 패키지                    │
│  셀러: 김민준 / 2026-1               │
│  ████████░░ 80% 보유                 │  ← 프로그레스 바
├─────────────────────────────────────┤
│  [패키지 카드 2] — 점수 0.79           │
│  기숙사 기본 패키지                    │
│  셀러: 이서연 / 2026-1               │
│  ███████░░░ 70% 보유                 │
│  🔄 요청 진행 중                      │  ← 이미 요청한 셀러
├─────────────────────────────────────┤
│  [패키지 카드 3] — 다른 학기 매물       │  ← 다른 학기 배지
│  기숙사 기본 패키지                    │
│  셀러: 박지호 / 2025-2               │
│  █████░░░░░ 50% 보유                 │
└─────────────────────────────────────┘
│  조건 변경하기                        │  ← 온보딩 Step 3으로 이동
└─────────────────────────────────────┘
```

### 5.2 패키지 상세 (/packages/[id])

```
┌─────────────────────────────────────┐
│  ← 기숙사 기본 패키지                  │
├─────────────────────────────────────┤
│  셀러: 김민준  ⭐ 4.8  2026-1         │
│  ████████░░ 8/10 보유               │
├─────────────────────────────────────┤
│  📋 물품 체크리스트                    │
│                                     │
│  [필수 항목]                          │
│  ✅ 이불      세탁완료 ✅              │
│  ✅ 베개      세탁완료 ✅              │
│  ✅ 토퍼      인증없음 ⚠️             │
│  ✅ 전기밥솥                          │
│  ✅ 스탠드 조명                        │
│                                     │
│  [선택 항목]                          │
│  ❌ 청소기    → 일반 매물 보러가기 →   │  ← 보완 시스템 연동
│  ❌ 빨래 건조대 → 현재 매물 없음        │
│              [알림 신청하기]           │
├─────────────────────────────────────┤
│        [거래 요청하기]                 │
└─────────────────────────────────────┘
```

### 5.3 카드 배지 종류

| 배지 | 조건 | 표시 방식 |
|------|------|---------|
| 세탁완료 ✅ | `hygiene_certifications.status = 'approved'` | 초록색 배지 |
| 인증없음 ⚠️ | 세탁 인증 필요한데 미인증 | 노란색 배지 |
| 요청 진행 중 🔄 | 이미 `package_matches` 존재 | 파란색 배지 |
| 다른 학기 📅 | `pm.semester != user.semester` | 회색 배지 |

---

## 6. 예외 처리

### 6.1 전체 예외 처리 목록

| 상황 | 처리 방식 | UI 표시 |
|------|----------|--------|
| 온보딩 미완료 | 추천 페이지 접근 불가 | 온보딩 페이지로 리다이렉트 |
| 3순위까지 패키지 없음 | 빈 상태 표시 | "현재 조건에 맞는 패키지가 없어요" + 알림 신청 버튼 |
| 셀러 0명 | 빈 상태 표시 | "현재 등록된 셀러가 없어요" + 알림 신청 버튼 |
| 같은 학기 셀러 없음 | 다른 학기 셀러 포함 | "다른 학기 매물이에요" 배지 |
| 이미 요청한 셀러 | 목록 유지 | "요청 진행 중 🔄" 배지 + 채팅방 이동 버튼 |
| 보유율 0% 셀러 | 목록 하단 표시 | 점수 최하위로 정렬 |
| 세탁 인증 없는 셀러 | 목록 포함 | "인증없음 ⚠️" 배지 |
| 거래 요청 중복 | INSERT 차단 | "이미 요청한 패키지예요" 토스트 |

### 6.2 거래 요청 중복 방지
```sql
-- package_matches에 UNIQUE 제약으로 중복 방지
-- 같은 buyer_uid + package_id + seller_uid 조합은 1건만 허용
INSERT INTO package_matches (package_id, buyer_uid, seller_uid, semester)
VALUES (:package_id, :buyer_uid, :seller_uid, :semester)
ON CONFLICT DO NOTHING;
```

---

## 7. 데이터 예시

### 7.1 exchange_students 예시

```json
{
  "uid": "uuid-buyer-001",
  "country_id": 3,
  "region_group": "E3",
  "housing_type": "dorm",
  "semester": "2026-1",
  "language_pref": "en",
  "role": "incoming",
  "onboarding_completed": true
}
```

### 7.2 essential_packages 예시

```json
{
  "package_id": 1,
  "template_type": "DORM_BASIC",
  "name": { "ko": "기숙사 기본 패키지", "en": "Dorm Basic Package" },
  "region_group": null,
  "housing_type": "dorm"
}
```

### 7.3 package_matches 예시

```json
{
  "match_id": 101,
  "package_id": 1,
  "buyer_uid": "uuid-buyer-001",
  "seller_uid": "uuid-seller-001",
  "status": "pending",
  "semester": "2026-1"
}
```

### 7.4 추천 결과 예시 (최종 응답)

```json
{
  "applied_tier": 2,
  "applied_label": "독일 지역 기준",
  "package": {
    "package_id": 1,
    "template_type": "DORM_BASIC",
    "name": "기숙사 기본 패키지"
  },
  "sellers": [
    {
      "match_id": 101,
      "seller_name": "김민준",
      "semester": "2026-1",
      "is_different_semester": false,
      "owned_count": 8,
      "total_count": 10,
      "ownership_rate": 0.80,
      "hygiene_cert_rate": 1.00,
      "score": 0.86,
      "match_status": "pending",
      "already_requested": false
    },
    {
      "match_id": 102,
      "seller_name": "이서연",
      "semester": "2026-1",
      "is_different_semester": false,
      "owned_count": 7,
      "total_count": 10,
      "ownership_rate": 0.70,
      "hygiene_cert_rate": 1.00,
      "score": 0.79,
      "match_status": "pending",
      "already_requested": true
    }
  ]
}
```

### 7.5 package_items seed 데이터 예시 (DORM_BASIC)

```sql
-- DORM_BASIC 패키지 구성 물품 seed
INSERT INTO package_items
    (package_id, category_id, is_required, priority_order, requires_hygiene_cert)
VALUES
    (1, :이불_category_id,    TRUE,  1, TRUE),
    (1, :베개_category_id,    TRUE,  2, TRUE),
    (1, :토퍼_category_id,    TRUE,  3, TRUE),
    (1, :밥솥_category_id,    TRUE,  4, FALSE),
    (1, :스탠드_category_id,  TRUE,  5, FALSE),
    (1, :청소기_category_id,  FALSE, 6, FALSE),
    (1, :건조대_category_id,  FALSE, 7, FALSE),
    (1, :옷걸이_category_id,  FALSE, 8, FALSE);
```
