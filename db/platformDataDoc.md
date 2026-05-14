# 대학 중고거래 플랫폼 — 데이터 설계 문서

> 참조 문서: `platformPlanningDoc.md`
> ERD 이미지: `ERD.jpg`

---

## 변경 이력

| 버전 | 변경 내용 |
|------|----------|
| v1 | 최초 작성 — 15개 테이블 정의 |
| v2 | 확장성·안정성 검토 반영 — 7개 컬럼 추가, 1개 컬럼 설계 수정 |

### v2 변경 상세

| 테이블 | 추가/수정 컬럼 | 분류 | 사유 |
|--------|--------------|------|------|
| `User` | `school_domain` 추가 | 확장성 | 멀티 학교 확장 대비 |
| `User` | `deleted_at` 추가 | 안정성 | Soft Delete — 탈퇴 후 거래 이력 보존 |
| `Product` | `updated_at` 추가 | 안정성 | 수정 이력 추적, 가격 조작 감지 |
| `Product` | `deleted_at` 추가 | 안정성 | Soft Delete — 삭제 후 Transaction 참조 보존 |
| `Category` | `parent_id` 추가 | 확장성 | 카테고리 계층 구조 (자기 참조 FK) |
| `ChatParticipant` | `last_read_at` 추가 | 기능 | 채팅 읽음 확인 (기획서 논의사항 반영) |
| `Transaction` | `agreed_price` 추가 | 안정성 | 거래 시점 가격 스냅샷 — 사후 price 수정 무관 |
| `Report` | `reporter_uid` 추가 | 안정성 | 중복 신고 방지, 허위 신고 추적 (익명성은 앱 레이어에서 보장) |

---

## 1. 동작별 ERD 데이터 구분

### 1.1 학교 인증 및 회원가입

#### ERD 대상 (RDB 영구 저장)

| 데이터 | 저장 테이블 | 비고 |
|--------|------------|------|
| 고유 UID | `User` | PK, UUID |
| 이메일 (ID) | `User` | 학교 메일, 로그인 식별자 |
| PW 해시값 | `User` | Bcrypt 해시, PII 암호화 대상 |
| 닉네임 | `User` | |
| 학번 | `User` | PII 암호화 대상 |
| 학교 도메인 | `User` | `school_domain` — 멀티 학교 확장 대비 |
| 가입 승인일 | `User` | `joined_at` |

#### ERD 비대상 (RDB 외부에서 처리)

| 데이터 | 저장 위치 | 이유 |
|--------|----------|------|
| 인증번호 | Redis (TTL) | 만료 후 자동 삭제되는 임시 데이터 |
| JWT 토큰 | 클라이언트 | Stateless, DB 저장 불필요 |
| PW Salt | 해시값 내포 | 독립 엔티티로 저장 불필요 |
| 인증 메일 발송 로그 | 외부 SMTP 서비스 | RDB 범위 외 |

---

### 1.2 내 정보 및 설정

#### ERD 대상 (RDB 영구 저장)

| 데이터 | 저장 테이블 | 비고 |
|--------|------------|------|
| 프로필 이미지 URL | `User` | S3 파일의 참조값 |
| 한 줄 소개 | `User` | `bio` |
| 선호 지역 ID | `User` | FK → `Region.region_id` |
| 지역명 | `Region` | 지역 마스터 데이터 |

#### ERD 비대상 (RDB 외부에서 처리)

| 데이터 | 저장 위치 | 이유 |
|--------|----------|------|
| 실제 이미지 파일 | S3 Object Storage | 바이너리 파일, ERD는 URL만 표현 |
| 접속 IP / 기기 정보 | 감사 로그(Audit Log) 시스템 | 보안 로그 전용, RDB 핵심 엔티티 아님 |
| Presigned URL | S3 (임시 URL) | 업로드용 단기 토큰, 만료 후 무효 |
| EXIF 메타데이터 | — (삭제 처리) | 이미지에서 제거 후 보관하지 않음 |

---

### 1.3 판매 물건 등록/수정

#### ERD 대상 (RDB 영구 저장)

| 데이터 | 저장 테이블 | 비고 |
|--------|------------|------|
| 상품 고유 PID | `Product` | PK, UUID |
| 판매자 UID | `Product` | FK → `User.uid` |
| 카테고리 ID | `Product` | FK → `Category.category_id` |
| 상품명 | `Product` | |
| 가격 | `Product` | 현재 게시 가격 |
| 상태 (새상품/중고 등) | `Product` | `condition` ENUM |
| 본문 | `Product` | |
| 판매 상태 | `Product` | `status` ENUM (판매중/예약중/판매완료) |
| 등록 시각 | `Product` | `created_at` |
| 수정 시각 | `Product` | `updated_at` — 가격/내용 변조 추적 |
| 이미지 URL | `ProductImage` | S3 참조값, Product와 1:N |
| 이미지 순서 | `ProductImage` | `display_order` |
| 카테고리명 | `Category` | 카테고리 마스터 데이터 |
| 상위 카테고리 ID | `Category` | `parent_id` — 카테고리 계층 구조 |

#### ERD 비대상 (RDB 외부에서 처리)

| 데이터 | 저장 위치 | 이유 |
|--------|----------|------|
| 실제 이미지 파일 | S3 Object Storage | 바이너리 파일 |
| Elasticsearch 인덱스 | Elasticsearch | 검색 엔진 내부 구조, RDB와 동기화되나 ERD 범위 외 |
| 금칙어·스팸 필터링 결과 로그 | 모니터링 시스템 | 처리 후 폐기되거나 별도 시스템에서 관리 |

---

### 1.4 탐색 및 상호작용

#### ERD 대상 (RDB 영구 저장)

| 데이터 | 저장 테이블 | 비고 |
|--------|------------|------|
| 찜 관계 (사용자 ↔ 상품) | `Wishlist` | User FK + Product FK, M:N 중간 테이블 |
| 찜 등록 시각 | `Wishlist` | |
| 채팅방 ID | `ChatRoom` | PK |
| 채팅방 연관 상품 | `ChatRoom` | FK → `Product.pid` |
| 채팅 참여자 정보 | `ChatParticipant` | ChatRoom FK + User FK |
| 채팅 마지막 읽음 시각 | `ChatParticipant` | `last_read_at` — 읽음 확인 기능 |

#### ERD 비대상 (RDB 외부에서 처리)

| 데이터 | 저장 위치 | 이유 |
|--------|----------|------|
| 조회수 | Redis (캐시) | 실시간 카운터, RDB flush는 선택적 |
| 찜 횟수 | Redis (캐시) | Wishlist 행 수로 산출 가능한 파생값 |
| 채팅 메시지 내용 | MongoDB (NoSQL) | 대용량 비정형 데이터, NoSQL 문서 구조 |
| 채팅 메시지 전송 시각 | MongoDB (NoSQL) | 메시지 문서 내 속성 |
| 검색 키워드 / 필터 결과 | Elasticsearch | RDB 엔티티 아님 |

---

### 1.5 거래 완료 및 평가

#### ERD 대상 (RDB 영구 저장)

| 데이터 | 저장 테이블 | 비고 |
|--------|------------|------|
| 거래 ID | `Transaction` | PK |
| 거래 상품 | `Transaction` | FK → `Product.pid` |
| 구매자 / 판매자 UID | `Transaction` | FK → `User.uid` (2개) |
| **실제 거래 가격** | `Transaction` | `agreed_price` — 거래 시점 가격 스냅샷 |
| 거래 상태 | `Transaction` | `status` ENUM |
| 거래 완료 시각 | `Transaction` | `completed_at` |
| 리뷰 ID | `Review` | PK |
| 거래 참조 | `Review` | FK → `Transaction.transaction_id` |
| 작성자 / 피평가자 UID | `Review` | FK → `User.uid` (2개) |
| 별점 | `Review` | `rating` TINYINT |
| 리뷰 내용 | `Review` | |
| 매너 키워드 목록 | `MannerKeyword` | 키워드 마스터 데이터 |
| 리뷰-키워드 연결 | `ReviewKeyword` | Review FK + MannerKeyword FK, M:N 중간 테이블 |
| 거래 횟수 (누적) | `User` | `trade_count` 컬럼 |
| 매너 온도 (저장값) | `User` | `manner_temperature` 컬럼, 계산 결과 저장 |

#### ERD 비대상 (RDB 외부에서 처리)

| 데이터 | 저장 위치 | 이유 |
|--------|----------|------|
| 매너 온도 재계산 로직 | 백엔드 서비스 레이어 | 비즈니스 로직, ERD 범위 외 |
| 어뷰징 감지 로그 | 감사 로그 시스템 | 평점 조작 감지 이벤트 로그 |

---

### 1.6 불량 사용자 신고

#### ERD 대상 (RDB 영구 저장)

| 데이터 | 저장 테이블 | 비고 |
|--------|------------|------|
| 신고 접수 번호 | `Report` | PK |
| **신고자 UID** | `Report` | `reporter_uid` FK → `User.uid` — 중복 신고 방지, 허위 신고 추적 |
| 신고 대상 UID | `Report` | `target_uid` FK → `User.uid` |
| 신고 사유 | `Report` | |
| 신고 접수 시각 | `Report` | `created_at` |
| 증거 사진 URL | `ReportEvidence` | S3 참조값, Report와 1:N |
| 누적 경고 횟수 | `User` | `warning_count` 컬럼 |
| 이용 제한 상태 | `User` | `is_suspended` 컬럼 |
| 제재 이력 | `UserPenalty` | 경고/정지/영구정지 이력 |

> **신고자 익명성**: `reporter_uid`는 DB에 저장하되, 애플리케이션 레이어에서 신고 대상에게 노출하지 않음으로써 익명성을 보장합니다. DB 레이어에서 삭제하면 중복 신고 방지 및 허위 신고 추적이 불가합니다.

#### ERD 비대상 (RDB 외부에서 처리)

| 데이터 | 저장 위치 | 이유 |
|--------|----------|------|
| 실제 증거 사진 파일 | S3 Object Storage | 바이너리 파일, ERD는 URL만 |
| 관리자 알림 (Slack/Mail) | 외부 알림 서비스 | RDB 저장 대상 아님 |

---

## 2. 전체 데이터 테이블 정의

### 2.1 User

| 컬럼 | 타입 | 키 | 설명 |
|------|------|----|------|
| uid | VARCHAR(36) | PK | UUID |
| email | VARCHAR(255) | UNIQUE | 학교 이메일, PII 암호화 |
| password_hash | VARCHAR(255) | | Bcrypt 해시 |
| nickname | VARCHAR(50) | UNIQUE | 닉네임 |
| student_id | VARCHAR(20) | | 학번, PII 암호화 |
| **school_domain** | VARCHAR(100) | | 학교 도메인 (예: snu.ac.kr) — 멀티 학교 확장 대비 |
| profile_image_url | VARCHAR(512) | | S3 이미지 URL |
| bio | TEXT | | 한 줄 소개 |
| preferred_region_id | INT | FK | → `Region.region_id` |
| joined_at | DATETIME | | 가입 승인일 |
| manner_temperature | FLOAT | | 매너 온도 (기본값 36.5) |
| trade_count | INT | | 누적 거래 횟수 |
| is_suspended | BOOLEAN | | 이용 정지 여부 |
| warning_count | INT | | 누적 경고 횟수 |
| **deleted_at** | DATETIME NULL | | Soft Delete — NULL이면 활성 계정 |

---

### 2.2 Region

| 컬럼 | 타입 | 키 | 설명 |
|------|------|----|------|
| region_id | INT | PK | Auto Increment |
| name | VARCHAR(100) | | 지역명 |

---

### 2.3 Product

| 컬럼 | 타입 | 키 | 설명 |
|------|------|----|------|
| pid | VARCHAR(36) | PK | UUID |
| seller_uid | VARCHAR(36) | FK | → `User.uid` |
| category_id | INT | FK | → `Category.category_id` |
| title | VARCHAR(200) | | 상품명 |
| price | INT | | 현재 게시 가격 (원) |
| condition | ENUM | | 'high', 'medium', 'low' (상·중·하) |
| description | TEXT | | 본문 |
| status | ENUM | | 'selling', 'reserved', 'sold' |
| created_at | DATETIME | | 등록 시각 |
| **updated_at** | DATETIME | | 최종 수정 시각 — 가격·내용 변조 추적 |
| **deleted_at** | DATETIME NULL | | Soft Delete — NULL이면 공개 게시물 |

---

### 2.4 Category

| 컬럼 | 타입 | 키 | 설명 |
|------|------|----|------|
| category_id | INT | PK | Auto Increment |
| **parent_id** | INT NULL | FK | → `Category.category_id` (자기 참조 — 최상위면 NULL) |
| name | VARCHAR(100) | | 카테고리명 |

> 예시: `전자기기(parent_id=NULL)` → `스마트폰(parent_id=전자기기)` → `아이폰(parent_id=스마트폰)`

---

### 2.5 ProductImage

| 컬럼 | 타입 | 키 | 설명 |
|------|------|----|------|
| image_id | BIGINT | PK | Auto Increment |
| pid | VARCHAR(36) | FK | → `Product.pid` |
| image_url | VARCHAR(512) | | S3 이미지 URL |
| display_order | INT | | 이미지 표시 순서 |

---

### 2.6 Wishlist

| 컬럼 | 타입 | 키 | 설명 |
|------|------|----|------|
| wishlist_id | BIGINT | PK | Auto Increment |
| uid | VARCHAR(36) | FK | → `User.uid` |
| pid | VARCHAR(36) | FK | → `Product.pid` |
| created_at | DATETIME | | 찜 등록 시각 |

> UNIQUE (uid, pid): 동일 사용자가 동일 상품을 중복 찜 불가

---

### 2.7 ChatRoom

| 컬럼 | 타입 | 키 | 설명 |
|------|------|----|------|
| room_id | BIGINT | PK | Auto Increment |
| product_id | VARCHAR(36) | FK | → `Product.pid` |
| created_at | DATETIME | | 채팅방 생성 시각 |

---

### 2.8 ChatParticipant

| 컬럼 | 타입 | 키 | 설명 |
|------|------|----|------|
| cp_id | BIGINT | PK | Auto Increment |
| room_id | BIGINT | FK | → `ChatRoom.room_id` |
| uid | VARCHAR(36) | FK | → `User.uid` |
| **last_read_at** | DATETIME NULL | | 마지막 읽음 시각 — 읽음 확인 기능 (NULL이면 미읽음) |

> UNIQUE (room_id, uid): 채팅방 내 참여자 중복 방지

---

### 2.9 Transaction

| 컬럼 | 타입 | 키 | 설명 |
|------|------|----|------|
| transaction_id | BIGINT | PK | Auto Increment |
| pid | VARCHAR(36) | FK | → `Product.pid` |
| buyer_uid | VARCHAR(36) | FK | → `User.uid` (구매자) |
| seller_uid | VARCHAR(36) | FK | → `User.uid` (판매자) |
| **agreed_price** | INT | | 거래 확정 시점 가격 스냅샷 — Product.price 사후 변경과 무관 |
| status | ENUM | | 'pending', 'completed', 'cancelled' |
| completed_at | DATETIME | | 거래 완료 시각 |

---

### 2.10 Review

| 컬럼 | 타입 | 키 | 설명 |
|------|------|----|------|
| review_id | BIGINT | PK | Auto Increment |
| transaction_id | BIGINT | FK | → `Transaction.transaction_id` |
| reviewer_uid | VARCHAR(36) | FK | → `User.uid` (작성자) |
| reviewee_uid | VARCHAR(36) | FK | → `User.uid` (피평가자) |
| rating | TINYINT | | 별점 (1~5) |
| content | TEXT | | 리뷰 내용 |
| created_at | DATETIME | | 작성 시각 |

---

### 2.11 MannerKeyword

| 컬럼 | 타입 | 키 | 설명 |
|------|------|----|------|
| keyword_id | INT | PK | Auto Increment |
| label | VARCHAR(100) | | 매너 키워드 텍스트 |

---

### 2.12 ReviewKeyword (M:N 중간 테이블)

| 컬럼 | 타입 | 키 | 설명 |
|------|------|----|------|
| review_id | BIGINT | PK, FK | → `Review.review_id` |
| keyword_id | INT | PK, FK | → `MannerKeyword.keyword_id` |

> 복합 PK (review_id, keyword_id)

---

### 2.13 Report

| 컬럼 | 타입 | 키 | 설명 |
|------|------|----|------|
| report_id | BIGINT | PK | Auto Increment |
| **reporter_uid** | VARCHAR(36) | FK | → `User.uid` (신고자 — 앱 레이어에서 익명 처리) |
| target_uid | VARCHAR(36) | FK | → `User.uid` (신고 대상) |
| reason | VARCHAR(255) | | 신고 사유 |
| created_at | DATETIME | | 신고 접수 시각 |

> UNIQUE (reporter_uid, target_uid): 동일 사용자가 동일 대상을 중복 신고 불가 (중복 신고 방지 인덱스)

---

### 2.14 ReportEvidence

| 컬럼 | 타입 | 키 | 설명 |
|------|------|----|------|
| evidence_id | BIGINT | PK | Auto Increment |
| report_id | BIGINT | FK | → `Report.report_id` |
| image_url | VARCHAR(512) | | S3 증거 이미지 URL |

---

### 2.15 UserPenalty

| 컬럼 | 타입 | 키 | 설명 |
|------|------|----|------|
| penalty_id | BIGINT | PK | Auto Increment |
| uid | VARCHAR(36) | FK | → `User.uid` |
| type | ENUM | | 'warning', 'suspend', 'ban' |
| issued_at | DATETIME | | 제재 발효 시각 |
| expires_at | DATETIME NULL | | 제재 만료 시각 (NULL = 영구정지) |

---

### 2.16 외래키(FK) 관계 전체 요약

| 테이블 | FK 컬럼 | 참조 테이블 | 참조 컬럼 |
|--------|--------|------------|---------|
| User | preferred_region_id | Region | region_id |
| Product | seller_uid | User | uid |
| Product | category_id | Category | category_id |
| **Category** | **parent_id** | **Category** | **category_id** (자기 참조) |
| ProductImage | pid | Product | pid |
| Wishlist | uid | User | uid |
| Wishlist | pid | Product | pid |
| ChatRoom | product_id | Product | pid |
| ChatParticipant | room_id | ChatRoom | room_id |
| ChatParticipant | uid | User | uid |
| Transaction | pid | Product | pid |
| Transaction | buyer_uid | User | uid |
| Transaction | seller_uid | User | uid |
| Review | transaction_id | Transaction | transaction_id |
| Review | reviewer_uid | User | uid |
| Review | reviewee_uid | User | uid |
| ReviewKeyword | review_id | Review | review_id |
| ReviewKeyword | keyword_id | MannerKeyword | keyword_id |
| **Report** | **reporter_uid** | **User** | **uid** |
| Report | target_uid | User | uid |
| ReportEvidence | report_id | Report | report_id |
| UserPenalty | uid | User | uid |

---

## 3. 동작별 관련 테이블 매핑

### 3.1 학교 인증 및 회원가입

| 사용자 동작 | 관련 테이블 | SQL 유형 | 설명 |
|-----------|------------|---------|------|
| 이메일 중복 확인 | `User` | SELECT | email 컬럼 조회 |
| 닉네임 중복 확인 | `User` | SELECT | nickname 컬럼 조회 |
| 회원가입 완료 | `User` | INSERT | uid, email, password_hash, nickname, student_id, school_domain, joined_at 저장 |

---

### 3.2 내 정보 및 설정

| 사용자 동작 | 관련 테이블 | SQL 유형 | 설명 |
|-----------|------------|---------|------|
| 프로필 사진 변경 | `User` | UPDATE | profile_image_url 업데이트 |
| 한 줄 소개 수정 | `User` | UPDATE | bio 업데이트 |
| 선호 지역 설정 | `User`, `Region` | UPDATE / SELECT | preferred_region_id 업데이트, Region 목록 조회 |

---

### 3.3 판매 물건 등록/수정

| 사용자 동작 | 관련 테이블 | SQL 유형 | 설명 |
|-----------|------------|---------|------|
| 카테고리 목록 조회 | `Category` | SELECT | parent_id 기준 계층 조회 가능 |
| 상품 등록 | `Product` | INSERT | created_at, updated_at 동시 설정 |
| 상품 이미지 등록 | `ProductImage` | INSERT | 다중 이미지, Product와 1:N |
| 상품 정보 수정 | `Product` | UPDATE | updated_at 갱신 |
| 이미지 수정 | `ProductImage` | DELETE + INSERT | 기존 이미지 삭제 후 재등록 |
| 상품 삭제 | `Product` | UPDATE | deleted_at 설정 (Soft Delete, 실제 행 삭제 금지) |

---

### 3.4 탐색 및 상호작용

| 사용자 동작 | 관련 테이블 | SQL 유형 | 설명 |
|-----------|------------|---------|------|
| 상품 목록 조회 | `Product`, `ProductImage`, `Category` | SELECT | WHERE deleted_at IS NULL 조건 필수 |
| 상품 상세 조회 | `Product`, `ProductImage`, `User` | SELECT JOIN | 판매자 정보 포함, deleted_at IS NULL |
| 찜 등록 | `Wishlist` | INSERT | |
| 찜 취소 | `Wishlist` | DELETE | |
| 내 찜 목록 조회 | `Wishlist`, `Product` | SELECT JOIN | |
| 채팅방 생성 | `ChatRoom`, `ChatParticipant` | INSERT | 구매자+판매자 ChatParticipant 동시 등록 |
| 채팅방 목록 조회 | `ChatRoom`, `ChatParticipant` | SELECT JOIN | |
| 메시지 읽음 처리 | `ChatParticipant` | UPDATE | last_read_at = NOW() |

---

### 3.5 거래 완료 및 평가

| 사용자 동작 | 관련 테이블 | SQL 유형 | 설명 |
|-----------|------------|---------|------|
| 거래 완료 확정 | `Transaction`, `Product` | INSERT + UPDATE | Transaction 생성 시 agreed_price = Product.price 스냅샷, Product.status → 'sold' |
| 거래 횟수 갱신 | `User` | UPDATE | trade_count +1 |
| 리뷰 + 별점 작성 | `Review` | INSERT | |
| 매너 키워드 선택 | `ReviewKeyword`, `MannerKeyword` | INSERT / SELECT | |
| 매너 온도 재계산 | `User`, `Review` | UPDATE / SELECT AVG | |

---

### 3.6 불량 사용자 신고

| 사용자 동작 | 관련 테이블 | SQL 유형 | 설명 |
|-----------|------------|---------|------|
| 중복 신고 확인 | `Report` | SELECT | WHERE reporter_uid = ? AND target_uid = ? |
| 신고 접수 | `Report` | INSERT | reporter_uid, target_uid, reason, created_at 저장 |
| 증거 사진 첨부 | `ReportEvidence` | INSERT | |
| 경고 누적 | `User` | UPDATE | warning_count +1 |
| 이용 정지 | `User`, `UserPenalty` | UPDATE + INSERT | is_suspended → true, UserPenalty 이력 추가 |
| 제재 이력 조회 (관리자) | `UserPenalty`, `User` | SELECT JOIN | |
| 계정 탈퇴 처리 | `User` | UPDATE | deleted_at = NOW() (Soft Delete) |
