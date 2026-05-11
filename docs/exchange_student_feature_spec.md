# 교환학생 특화 기능 설계서

> 작성일: 2026-05-05
> 담당: 교환학생 파트
> 참조: schema.sql / exchange_student_data_doc.md / UX UI 관련 문서

---

## 목차

1. [개요](#1-개요)
2. [사용자 정의](#2-사용자-정의)
3. [기능 범위](#3-기능-범위)
4. [기능 상세 설계](#4-기능-상세-설계)
   - 4.1 온보딩 (미구현 예정)
   - 4.2 패키지 추천
   - 4.3 자동 매칭
   - 4.4 세탁 인증
   - 4.5 보완 시스템
5. [데이터 흐름](#5-데이터-흐름)
6. [화면 흐름 (UX Flow)](#6-화면-흐름-ux-flow)
7. [미결 사항](#7-미결-사항)

---

## 1. 개요

### 1.1 목적
고려대학교 교환학생(Incoming/Outgoing)을 위한 특화 기능 제공.
낯선 환경에서 필요한 물품을 빠르게 구하고, 학기 종료 후 물품을 효율적으로 처분할 수 있도록 지원.

### 1.2 핵심 가치
- 누구나(한국 학생 포함) 셀러·바이어 모두 가능
- 국가 코드로 역할 자동 분류 (KR → incoming, 그 외 → outgoing). 수동 선택 없음
- 체류 국가/거주형태 기반 필수 물품 패키지 자동 추천
- 학기 종료 후 보유 물품 패키지로 묶어 가격 책정·판매

### 1.3 구현 범위 (Phase 1)

| 기능 | 구현 여부 | 비고 |
|------|----------|------|
| 온보딩 | 🚫 제외됨 | Phase 1 범위에서 제외. DB에 직접 데이터 삽입으로 테스트 |
| 패키지 추천 | ✅ 구현 | Rule-based Fallback |
| 자동 매칭 | ✅ 구현 | 이전 학기 사용자 기반 |
| 세탁 인증 | ❌ 제거됨 | 불필요로 판단, 관련 코드 전면 삭제 |
| 보완 시스템 | ✅ 구현 | 일반 products 조회 방식 |

---

## 2. 사용자 정의

### 2.1 Incoming (바이어)
- 고려대로 교환 오는 외국인 학생
- 필요 물품을 모름 → 패키지 추천 필요
- 이전 학기 Outgoing 학생의 물품 매입

### 2.2 Outgoing (셀러)
- 다른 학교로 교환 가는 고려대생
- 학기 종료 후 물품 일괄 처분 필요
- 패키지 템플릿 기반으로 보유 물품 등록

### 2.3 지역 그룹 (23개)

| 코드 | 지역 | 주요 국가/도시 |
|------|------|--------------|
| E1 | 영어권 유럽 | 영국, 북유럽, 네덜란드 |
| E2 | 프랑스어권 | 프랑스, 스위스 일부 |
| E3 | 독일어권 | 독일, 오스트리아 |
| E4 | 남유럽 | 스페인, 이탈리아, 터키 |
| E5 | 동유럽 | 폴란드 |
| A1-N | 일본 북부 | 홋카이도 |
| A1-C | 일본 중부/수도권 | 도쿄, 나고야, 요코하마 |
| A1-W | 일본 서부 | 오사카, 교토, 규슈 |
| A2-N | 중국 북부 | 베이징, 하얼빈 |
| A2-C | 중국 중부/동부 | 상하이, 난징, 항저우 |
| A2-S | 중국 남부 | 광저우, 샤먼, 선전 |
| A3 | 동아시아/동남아 | 홍콩, 싱가포르, 대만 |
| N1-W | 미국 서부 | UC계열, UW, Oregon |
| N1-C | 미국 중부 | Wisconsin, Illinois |
| N1-E | 미국 동부 | Binghamton, UMD |
| N1-S | 미국 남부/하와이 | Hawaii, UT Austin |
| N2-W | 캐나다 서부 | UBC, SFU |
| N2-E | 캐나다 동부 | McGill, Queen's |
| O1 | 오세아니아 | 호주, 뉴질랜드 |
| S1 | 멕시코 | 멕시코시티, 몬테레이 |
| S2-BR | 브라질 | 상파울루 |
| S2-CL | 칠레 | 산티아고 |
| S2-REST | 중남미 기타 | 콜롬비아, 페루 등 |

---

## 3. 기능 범위

### 3.1 교환학생 전용 마켓 분리
- 패키지 매물은 일반 중고거래 상품 목록에 **노출되지 않음**
- 교환학생 전용 마켓 페이지에서만 접근 가능
- "패키지 매물 보러가기" → 셀러와 채팅 연결

### 3.2 패키지 템플릿 3종

| 템플릿 | 대상 | 구성 |
|--------|------|------|
| DORM_BASIC | 기숙사 입주형 | 침구 + 소형가전 + 생활용품 |
| FLAT_FULL | 자취/플랫셰어형 | 기숙사 패키지 + 주방용품 + 가구 |
| INCOMING_DORM | 고려대 incoming 전용 | 고려대 기숙사 맞춤 구성 |

---

## 4. 기능 상세 설계

### 4.1 온보딩 🚫 (Phase 1 제외)

> **결정 (2026-05-07)**: 온보딩은 Phase 1 범위에서 완전히 제외.
> 테스트 시 Supabase 대시보드에서 `exchange_students` 테이블에 직접 데이터 삽입.

**테스트 데이터 삽입 예시 (dev_guide Section 8 참조)**

```sql
INSERT INTO exchange_students (
  uid, country_id, region_group, housing_type,
  semester, language_pref, role, onboarding_completed
) VALUES (
  '본인-auth-uid', 3, 'E3', 'dorm', '2026-1', 'ko', 'incoming', TRUE
);
```

**저장 필드 정의 (향후 온보딩 구현 시 참고)**

| 필드 | 타입 | 내용 |
|------|------|------|
| `language_pref` | `'ko' \| 'en'` | 언어 선택 |
| `country_id`, `region_group` | `integer`, `string` | 출신 국가/지역 |
| `housing_type`, `semester` | `'dorm' \| 'flat'`, `string` | 거주형태 + 학기 |
| `role` | `'incoming' \| 'outgoing'` | 역할 |
| `onboarding_completed` | `boolean` | 완료 여부 — 반드시 `TRUE`로 삽입 |

---

### 4.2 패키지 추천

#### 4.2.1 목적
교환학생이 국가 + 거주형태만 입력하면 필요한 물품 묶음을 자동 추천.
Rule-based Fallback 구조로 ML/AI 없이 DB 쿼리만으로 구현.

#### 4.2.2 추천 로직 (Rule-based Fallback)

```
Step 1. 사용자 정보 조회
  exchange_students 에서 region_group, housing_type, semester 조회

Step 2. 패키지 템플릿 조회 (Fallback 순서)
  1순위: country_code + housing_type 정확히 매칭
         ↓ 결과 없으면
  2순위: region_group + housing_type 매칭
         ↓ 결과 없으면
  3순위: region_group 전체 범용 추천 (housing_type 무관)
         ↓ 결과 없으면
  → "현재 조건에 맞는 패키지가 없어요" 표시

Step 3. 셀러 목록 조회 (package_matches 기준)
  - 같은 region_group 셀러 조회
  - 같은 semester 셀러 우선 표시
    → 없으면 다른 학기 셀러도 포함
  - 세탁 인증 여부와 무관하게 전체 표시
    → 세탁완료 ✅ / 인증없음 배지로 구분

Step 4. 셀러별 점수 계산
  보유율 = 셀러의 package_listings 수 / package_items 전체 수
  세탁인증 비율 = 인증 완료 물품 수 / 세탁 인증 필요 물품 수

  최종 점수 = 보유율 * 0.7 + 세탁인증 비율 * 0.3

Step 5. 정렬 및 노출
  - 최종 점수 높은 순 정렬
  - 최대 5개 노출
  - 이미 매칭 요청한 셀러 → "요청 진행 중" 표시 (목록에서 제외 X)
```

#### 4.2.3 점수 계산 상세

| 항목 | 가중치 | 설명 |
|------|--------|------|
| 보유율 | 70% | 패키지 전체 물품 중 셀러가 보유한 비율 |
| 세탁인증 비율 | 30% | 세탁 인증 필요 물품 중 인증 완료 비율 |

**예시**
```
셀러 A: 패키지 10개 중 8개 보유 (보유율 0.8), 세탁 필요 3개 중 3개 인증 (인증율 1.0)
→ 최종 점수 = 0.8 * 0.7 + 1.0 * 0.3 = 0.56 + 0.30 = 0.86

셀러 B: 패키지 10개 중 9개 보유 (보유율 0.9), 세탁 필요 3개 중 0개 인증 (인증율 0.0)
→ 최종 점수 = 0.9 * 0.7 + 0.0 * 0.3 = 0.63 + 0.00 = 0.63

→ 셀러 A가 상단 노출
```

#### 4.2.4 학기 처리 방식

| 상황 | 처리 방식 |
|------|----------|
| 같은 학기 셀러 있음 | 같은 학기 셀러만 우선 표시 |
| 같은 학기 셀러 없음 | 다른 학기 셀러도 포함 + "다른 학기 매물이에요" 안내 텍스트 |

#### 4.2.5 관련 테이블

| 테이블 | 역할 |
|--------|------|
| `exchange_students` | 사용자 region_group, housing_type, semester 조회 |
| `essential_packages` | 패키지 템플릿 목록 |
| `package_items` | 패키지 구성 물품 + requires_hygiene_cert |
| `categories` | 물품 카테고리명 |
| `package_listings` | 셀러 보유 매물 (보유율 계산) |
| `hygiene_certifications` | 세탁 인증 상태 (인증율 계산) |
| `package_matches` | 이미 요청한 매칭 여부 확인 |

#### 4.2.6 화면 구성

**[패키지 추천 목록]**
- 적용된 추천 기준 텍스트 표시 (예: "독일 · 기숙사 기준")
- Fallback 적용 시 안내 텍스트 (예: "정확히 일치하는 패키지가 없어 독일 지역 기준으로 추천드려요")
- 다른 학기 셀러 포함 시 안내 텍스트
- 패키지 카드 (최대 5개, 점수 높은 순):
  - 패키지명 / 셀러명 / 보유율 프로그레스 바 / 학기
  - 이미 요청한 셀러: "요청 진행 중" 배지

**[패키지 상세]**
- 셀러 정보 (이름, 평점, 학기)
- 보유율 요약 (보유 물품 수 / 전체 물품 수 + 프로그레스 바)
- 물품 체크리스트 (is_required 기준 필수 항목 우선 정렬):
  - 보유 항목: ✅ + 세탁완료 배지 (인증 필요 물품에 한해)
  - 미보유 항목: ❌ + 보완 안내
- 거래 요청하기 버튼

#### 4.2.7 예외 처리

| 상황 | 처리 방식 |
|------|----------|
| 3순위까지 결과 없음 | "현재 조건에 맞는 패키지가 없어요" + 알림 신청 버튼 |
| 이미 pending 매칭 존재 | "요청 진행 중" 배지 표시 + 채팅방 이동 버튼 |
| 같은 학기 셀러 없음 | 다른 학기 셀러 포함 + 안내 텍스트 |
| 세탁 인증 없는 셀러 | 목록 포함 + "인증없음" 배지로 구분 |

---

### 4.3 자동 매칭

#### 4.3.1 목적
Outgoing 학생(셀러)과 Incoming 학생(바이어)을 자동으로 연결.
종강 D-14일에 같은 지역 파견 예정 바이어와 겹치는 물품 있으면 자동 매칭.

#### 4.3.2 매칭 로직

```
종강 D-14일
→ 같은 region_group 파견 예정 바이어 조회
→ package_listings ↔ exchange_wishlists 겹치는 category_id 확인
→ 겹치는 물품 있으면 package_matches INSERT (status = 'pending')
→ 양측 알림 발송
→ N일 내 수락 없으면 status = 'cancelled' 자동 처리
```

#### 4.3.3 관련 테이블

| 테이블 | 역할 |
|--------|------|
| `exchange_students` | region_group, semester, role 조회 |
| `package_listings` | 셀러 보유 매물 |
| `exchange_wishlists` | 바이어 알림 신청 목록 |
| `package_matches` | 매칭 결과 저장 |
| `chat_rooms` | 매칭 성사 시 채팅방 생성 |

#### 4.3.4 매칭 상태 흐름

```
pending → matched (양측 수락)
        → cancelled (N일 내 미수락)
matched → completed (거래 완료)
        → cancelled (취소)
```

#### 4.3.5 예외 처리

| 상황 | 처리 방식 |
|------|----------|
| 이미 매칭된 바이어 | 중복 매칭 방지 (UNIQUE 제약) |
| 매칭 만료 | status = 'cancelled' 자동 업데이트 |

---

### 4.4 세탁 인증

#### 4.4.1 목적
이불, 베개, 토퍼 등 몸에 닿는 물품의 위생 확인.
셀러가 세탁 완료 사진을 업로드해야 해당 물품 게시 가능.

#### 4.4.2 인증 대상 물품
`package_items.requires_hygiene_cert = true`인 물품.
(예: 이불, 베개, 토퍼)

#### 4.4.3 인증 흐름

```
셀러: 세탁 완료 사진 업로드
→ Supabase Storage 업로드
→ hygiene_certifications INSERT (status = 'pending')
→ 관리자 검토
→ status = 'approved' → 해당 물품 게시 가능
→ status = 'rejected' → 재업로드 필요
```

#### 4.4.4 관련 테이블

| 테이블 | 역할 |
|--------|------|
| `hygiene_certifications` | 인증 내역 저장 |
| `package_listings` | cert_id FK 연결 |
| `package_items` | requires_hygiene_cert 확인 |

#### 4.4.5 화면 구성

**[세탁 인증 화면]**
- 인증 대상 물품 목록
- 각 물품별: 물품명 / 인증 상태 / 사진 업로드 버튼
- 상태 표시
  - pending: "검토 중"
  - approved: "세탁완료 ✅"
  - rejected: "인증 반려됨 — 재업로드 필요"

#### 4.4.6 예외 처리

| 상황 | 처리 방식 |
|------|----------|
| 미인증 상태로 게시 시도 | 게시하기 버튼 비활성 |
| 업로드 실패 | "업로드에 실패했어요. 다시 시도해주세요" 토스트 |
| 지원하지 않는 파일 형식 | "JPG, PNG 파일만 업로드 가능해요" |

---

### 4.5 보완 시스템

#### 4.5.1 목적
셀러 패키지에 없는 물품을 일반 중고거래 상품에서 찾아서 안내.
별도 알고리즘 없이 같은 `category_id`로 `products` 테이블 조회.

#### 4.5.2 로직

```
package_items 전체 목록 조회
→ 셀러의 package_listings에 없는 category_id 확인 (미보유 항목)
→ 미보유 category_id로 products 테이블 조회
→ 판매중(status = 'selling')인 매물 표시
→ 없으면 exchange_wishlists 알림 신청 유도
```

#### 4.5.3 관련 테이블

| 테이블 | 역할 |
|--------|------|
| `package_items` | 패키지 전체 구성 물품 |
| `package_listings` | 셀러 보유 매물 |
| `products` | 일반 중고거래 매물 조회 (읽기 전용) |
| `exchange_wishlists` | 알림 신청 저장 |

#### 4.5.4 화면 구성

**[패키지 상세 — 미보유 항목]**
- 미보유 물품명 + ❌ 표시
- 일반 매물 있을 때: "일반 매물에서 찾아보기" 링크
- 일반 매물 없을 때: "현재 매물이 없어요 — 알림 신청하기" 버튼

#### 4.5.5 예외 처리

| 상황 | 처리 방식 |
|------|----------|
| 일반 매물도 없음 | exchange_wishlists INSERT → "알림 신청됨 ✅" |
| 이미 알림 신청한 항목 | "이미 알림 신청한 물품이에요" |

---

## 5. 데이터 흐름

### 5.1 패키지 추천 흐름

```
사용자 진입
→ exchange_students 조회 (region_group, housing_type)
→ essential_packages 조회 (Fallback 순서대로)
→ package_items 조회 (구성 물품 목록)
→ package_listings 조회 (셀러별 보유 현황)
→ 보유율 계산 후 패키지 카드 표시
```

### 5.2 거래 요청 흐름

```
바이어: 거래 요청하기 버튼
→ package_matches INSERT (status = 'pending')
→ chat_rooms INSERT (package_match_id 연결)
→ chat_participants INSERT (buyer, seller)
→ /chat/[room_id] 이동
```

### 5.3 세탁 인증 흐름

```
셀러: 사진 업로드
→ Supabase Storage 업로드
→ hygiene_certifications INSERT (status = 'pending')
→ 관리자 승인 → status = 'approved'
→ package_listings.cert_id 업데이트
```

---

## 6. 화면 흐름 (UX Flow)

### 6.1 바이어 흐름

```
메인 대시보드
→ 패키지 추천 목록 (/packages)
→ 패키지 상세 (/packages/[id])
→ 거래 요청하기
→ 채팅방 (/chat/[room_id])
```

### 6.2 셀러 흐름

```
메인 대시보드
→ 패키지 템플릿 선택 (/sell/template)
→ 보유 물품 체크 (/sell/register)
→ 세탁 인증 (필요 시) (/sell/hygiene)
→ 게시하기 완료
```

### 6.3 알림 신청 흐름

```
패키지 상세에서 미보유 물품 확인
→ "알림 신청하기" 버튼
→ exchange_wishlists INSERT
→ 알림 신청 목록 (/wishlist)
```

---

## 7. 미결 사항

| 항목 | 내용 | 확인 대상 |
|------|------|----------|
| 온보딩 연동 | Phase 1 제외 확정 (2026-05-07). DB 직접 삽입으로 테스트 | — |
| API 호출 방식 | Supabase 클라이언트 직접 호출 vs Edge Function | 팀 전체 |
| 프론트엔드 프레임워크 | Next.js 통일 여부 | 팀 전체 |
| 자동 매칭 스케줄러 | node-cron 담당 파트 | 자산 순환 파트 |
| 보완 시스템 연동 | 추천 시스템 파트와 연동 여부 | 추천 시스템 파트 |
| essential_packages.name | JSONB 유지 vs name_ko/name_en 분리 | 팀 전체 |
