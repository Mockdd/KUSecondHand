# 대학 중고거래 플랫폼 — 테이블 명세서

> DBMS: MySQL 8.0+  
> Charset: `utf8mb4` / Collation: `utf8mb4_unicode_ci`  
> 참조 ERD: `ERD.jpg` | 참조 설계 문서: `platformDataDoc.md`

---

## 목차

| # | 테이블 | 역할 요약 |
|---|--------|----------|
| 1 | [Region](#1-region) | 지역 마스터 |
| 2 | [User](#2-user) | 회원 정보 |
| 3 | [Category](#3-category) | 상품 카테고리 (계층형) |
| 4 | [Product](#4-product) | 판매 상품 |
| 5 | [ProductImage](#5-productimage) | 상품 이미지 |
| 6 | [Wishlist](#6-wishlist) | 찜 목록 (User ↔ Product M:N) |
| 7 | [ChatRoom](#7-chatroom) | 채팅방 |
| 8 | [ChatParticipant](#8-chatparticipant) | 채팅방 참여자 |
| 9 | [Transaction](#9-transaction) | 거래 내역 |
| 10 | [Review](#10-review) | 거래 후기 |
| 11 | [MannerKeyword](#11-mannerkeyword) | 매너 키워드 마스터 |
| 12 | [ReviewKeyword](#12-reviewkeyword) | 후기-키워드 연결 (M:N) |
| 13 | [Report](#13-report) | 신고 내역 |
| 14 | [ReportEvidence](#14-reportevidence) | 신고 증거 이미지 |
| 15 | [UserPenalty](#15-userpenalty) | 제재 이력 |

---

## 표기 규칙

| 기호 | 의미 |
|------|------|
| ✅ | 해당 |
| — | 비해당 / NULL 허용 |
| `AUTO` | AUTO_INCREMENT |
| `NOW()` | DEFAULT CURRENT_TIMESTAMP |
| `RESTRICT` | ON DELETE / ON UPDATE RESTRICT |
| `CASCADE` | ON DELETE CASCADE |
| `SET NULL` | ON DELETE SET NULL |

---

## 1. Region

**역할**: 선호 지역 마스터 데이터. 정밀 좌표 대신 지역 ID를 사용해 개인정보 보호.

| 컬럼명 | 데이터 타입 | PK | NOT NULL | UNIQUE | DEFAULT | CHECK | FK |
|--------|-----------|:--:|:--------:|:------:|---------|-------|----|
| region_id | INT | ✅ | ✅ | ✅ (`AUTO`) | — | — | — |
| name | VARCHAR(100) | — | ✅ | ✅ | — | — | — |

**제약 요약**

| 제약명 | 종류 | 대상 컬럼 | 내용 |
|--------|------|----------|------|
| PRIMARY KEY | PK | region_id | — |
| uq_region_name | UNIQUE | name | 지역명 중복 불가 |

---

## 2. User

**역할**: 플랫폼 회원 정보. 인증·프로필·상태·통계를 통합 관리. `deleted_at`으로 Soft Delete 처리.

| 컬럼명 | 데이터 타입 | PK | NOT NULL | UNIQUE | DEFAULT | CHECK | FK |
|--------|-----------|:--:|:--------:|:------:|---------|-------|----|
| uid | VARCHAR(36) | ✅ | ✅ | — | — | — | — |
| email | VARCHAR(255) | — | ✅ | ✅ | — | — | — |
| password_hash | VARCHAR(255) | — | ✅ | — | — | — | — |
| nickname | VARCHAR(50) | — | ✅ | ✅ | — | — | — |
| student_id | VARCHAR(20) | — | ✅ | — | — | — | — |
| school_domain | VARCHAR(100) | — | ✅ | — | — | — | — |
| profile_image_url | VARCHAR(512) | — | — | — | NULL | — | — |
| bio | TEXT | — | — | — | NULL | — | — |
| preferred_region_id | INT | — | — | — | NULL | — | → Region.region_id |
| joined_at | DATETIME | — | ✅ | — | `NOW()` | — | — |
| manner_temperature | FLOAT | — | ✅ | — | `36.5` | 0 ≤ x ≤ 100 | — |
| trade_count | INT | — | ✅ | — | `0` | x ≥ 0 | — |
| is_suspended | TINYINT(1) | — | ✅ | — | `0` | — | — |
| warning_count | INT | — | ✅ | — | `0` | x ≥ 0 | — |
| deleted_at | DATETIME | — | — | — | NULL | — | — |

**제약 요약**

| 제약명 | 종류 | 대상 컬럼 | 내용 |
|--------|------|----------|------|
| PRIMARY KEY | PK | uid | UUID (애플리케이션 생성) |
| uq_user_email | UNIQUE | email | 이메일 중복 불가 |
| uq_user_nickname | UNIQUE | nickname | 닉네임 중복 불가 |
| chk_user_manner | CHECK | manner_temperature | 0.0 ~ 100.0 |
| chk_user_trade_count | CHECK | trade_count | 0 이상 |
| chk_user_warning_count | CHECK | warning_count | 0 이상 |
| fk_user_region | FK | preferred_region_id | → Region(region_id) ON DELETE SET NULL |

> **Soft Delete**: 탈퇴 시 `DELETE` 금지. `deleted_at = NOW()` 로 처리. 조회 시 `WHERE deleted_at IS NULL` 조건 필수.  
> **PII**: `email`, `student_id` 는 애플리케이션 레이어에서 암호화 후 저장.

---

## 3. Category

**역할**: 상품 카테고리 마스터. `parent_id` 자기 참조로 무한 계층 구조 지원.

| 컬럼명 | 데이터 타입 | PK | NOT NULL | UNIQUE | DEFAULT | CHECK | FK |
|--------|-----------|:--:|:--------:|:------:|---------|-------|----|
| category_id | INT | ✅ | ✅ | — (`AUTO`) | — | — | — |
| parent_id | INT | — | — | — | NULL | — | → Category.category_id |
| name | VARCHAR(100) | — | ✅ | — | — | — | — |

**제약 요약**

| 제약명 | 종류 | 대상 컬럼 | 내용 |
|--------|------|----------|------|
| PRIMARY KEY | PK | category_id | — |
| fk_category_parent | FK | parent_id | → Category(category_id) ON DELETE SET NULL (자기 참조) |

> 최상위 카테고리는 `parent_id = NULL`.

---

## 4. Product

**역할**: 판매 상품 정보. `status`로 거래 상태 관리. `deleted_at`으로 Soft Delete 처리.

| 컬럼명 | 데이터 타입 | PK | NOT NULL | UNIQUE | DEFAULT | CHECK | FK |
|--------|-----------|:--:|:--------:|:------:|---------|-------|----|
| pid | VARCHAR(36) | ✅ | ✅ | — | — | — | — |
| seller_uid | VARCHAR(36) | — | ✅ | — | — | — | → User.uid |
| category_id | INT | — | ✅ | — | — | — | → Category.category_id |
| title | VARCHAR(200) | — | ✅ | — | — | — | — |
| price | INT | — | ✅ | — | — | x ≥ 0 | — |
| condition | ENUM | — | ✅ | — | — | 아래 참조 | — |
| description | TEXT | — | — | — | NULL | — | — |
| status | ENUM | — | ✅ | — | `'selling'` | 아래 참조 | — |
| created_at | DATETIME | — | ✅ | — | `NOW()` | — | — |
| updated_at | DATETIME | — | ✅ | — | `NOW()` | — | — |
| deleted_at | DATETIME | — | — | — | NULL | — | — |

**ENUM 값**

| 컬럼 | 허용 값 |
|------|--------|
| condition | `'new'`, `'like_new'`, `'good'`, `'fair'`, `'poor'` |
| status | `'selling'`, `'reserved'`, `'sold'` |

**제약 요약**

| 제약명 | 종류 | 대상 컬럼 | 내용 |
|--------|------|----------|------|
| PRIMARY KEY | PK | pid | UUID (애플리케이션 생성) |
| chk_product_price | CHECK | price | 0 이상 |
| fk_product_seller | FK | seller_uid | → User(uid) ON DELETE RESTRICT |
| fk_product_category | FK | category_id | → Category(category_id) ON DELETE RESTRICT |
| idx_product_seller | INDEX | seller_uid | 판매자별 조회 성능 |
| idx_product_status | INDEX | status | 판매 상태별 필터링 성능 |
| idx_product_category | INDEX | category_id | 카테고리별 조회 성능 |
| idx_product_created | INDEX | created_at | 최신순 정렬 성능 |

> `updated_at`은 행 수정 시 DB가 자동 갱신 (`ON UPDATE CURRENT_TIMESTAMP`).  
> Soft Delete: 삭제 시 `deleted_at = NOW()`. 목록 조회 시 `WHERE deleted_at IS NULL` 필수.

---

## 5. ProductImage

**역할**: 상품별 이미지 URL 목록. Product와 1:N 관계. Product 삭제(Soft) 시 이미지 URL은 유지.

| 컬럼명 | 데이터 타입 | PK | NOT NULL | UNIQUE | DEFAULT | CHECK | FK |
|--------|-----------|:--:|:--------:|:------:|---------|-------|----|
| image_id | BIGINT | ✅ | ✅ | — (`AUTO`) | — | — | — |
| pid | VARCHAR(36) | — | ✅ | — | — | — | → Product.pid |
| image_url | VARCHAR(512) | — | ✅ | — | — | — | — |
| display_order | INT | — | ✅ | — | `0` | x ≥ 0 | — |

**제약 요약**

| 제약명 | 종류 | 대상 컬럼 | 내용 |
|--------|------|----------|------|
| PRIMARY KEY | PK | image_id | — |
| chk_productimage_order | CHECK | display_order | 0 이상 |
| fk_productimage_product | FK | pid | → Product(pid) ON DELETE CASCADE |
| idx_productimage_pid | INDEX | pid | 상품별 이미지 조회 성능 |

---

## 6. Wishlist

**역할**: 사용자의 찜 목록. User ↔ Product M:N 중간 테이블. 동일 사용자-상품 중복 찜 불가.

| 컬럼명 | 데이터 타입 | PK | NOT NULL | UNIQUE | DEFAULT | CHECK | FK |
|--------|-----------|:--:|:--------:|:------:|---------|-------|----|
| wishlist_id | BIGINT | ✅ | ✅ | — (`AUTO`) | — | — | — |
| uid | VARCHAR(36) | — | ✅ | — | — | — | → User.uid |
| pid | VARCHAR(36) | — | ✅ | — | — | — | → Product.pid |
| created_at | DATETIME | — | ✅ | — | `NOW()` | — | — |

**제약 요약**

| 제약명 | 종류 | 대상 컬럼 | 내용 |
|--------|------|----------|------|
| PRIMARY KEY | PK | wishlist_id | — |
| uq_wishlist_user_product | UNIQUE | (uid, pid) | 중복 찜 방지 |
| fk_wishlist_user | FK | uid | → User(uid) ON DELETE CASCADE |
| fk_wishlist_product | FK | pid | → Product(pid) ON DELETE CASCADE |

---

## 7. ChatRoom

**역할**: 상품 거래를 위한 채팅방. 하나의 상품에 여러 채팅방 생성 가능 (구매 희망자 수만큼).

| 컬럼명 | 데이터 타입 | PK | NOT NULL | UNIQUE | DEFAULT | CHECK | FK |
|--------|-----------|:--:|:--------:|:------:|---------|-------|----|
| room_id | BIGINT | ✅ | ✅ | — (`AUTO`) | — | — | — |
| product_id | VARCHAR(36) | — | ✅ | — | — | — | → Product.pid |
| created_at | DATETIME | — | ✅ | — | `NOW()` | — | — |

**제약 요약**

| 제약명 | 종류 | 대상 컬럼 | 내용 |
|--------|------|----------|------|
| PRIMARY KEY | PK | room_id | — |
| fk_chatroom_product | FK | product_id | → Product(pid) ON DELETE RESTRICT |
| idx_chatroom_product | INDEX | product_id | 상품별 채팅방 조회 성능 |

---

## 8. ChatParticipant

**역할**: 채팅방 참여자 관리. `last_read_at`으로 읽음 확인 기능 구현.

| 컬럼명 | 데이터 타입 | PK | NOT NULL | UNIQUE | DEFAULT | CHECK | FK |
|--------|-----------|:--:|:--------:|:------:|---------|-------|----|
| cp_id | BIGINT | ✅ | ✅ | — (`AUTO`) | — | — | — |
| room_id | BIGINT | — | ✅ | — | — | — | → ChatRoom.room_id |
| uid | VARCHAR(36) | — | ✅ | — | — | — | → User.uid |
| last_read_at | DATETIME | — | — | — | NULL | — | — |

**제약 요약**

| 제약명 | 종류 | 대상 컬럼 | 내용 |
|--------|------|----------|------|
| PRIMARY KEY | PK | cp_id | — |
| uq_chatparticipant | UNIQUE | (room_id, uid) | 동일 채팅방 중복 참여 방지 |
| fk_chatparticipant_room | FK | room_id | → ChatRoom(room_id) ON DELETE CASCADE |
| fk_chatparticipant_user | FK | uid | → User(uid) ON DELETE RESTRICT |

> 읽지 않은 메시지 수 계산: MongoDB의 메시지 `created_at`과 `last_read_at`을 비교해 산출.

---

## 9. Transaction

**역할**: 거래 완료 내역. `agreed_price`로 거래 시점 가격 스냅샷 보존. 구매자 ≠ 판매자 강제.

| 컬럼명 | 데이터 타입 | PK | NOT NULL | UNIQUE | DEFAULT | CHECK | FK |
|--------|-----------|:--:|:--------:|:------:|---------|-------|----|
| transaction_id | BIGINT | ✅ | ✅ | — (`AUTO`) | — | — | — |
| pid | VARCHAR(36) | — | ✅ | — | — | — | → Product.pid |
| buyer_uid | VARCHAR(36) | — | ✅ | — | — | — | → User.uid |
| seller_uid | VARCHAR(36) | — | ✅ | — | — | — | → User.uid |
| agreed_price | INT | — | ✅ | — | — | x ≥ 0 | — |
| status | ENUM | — | ✅ | — | `'pending'` | 아래 참조 | — |
| completed_at | DATETIME | — | — | — | NULL | — | — |

**ENUM 값**

| 컬럼 | 허용 값 |
|------|--------|
| status | `'pending'`, `'completed'`, `'cancelled'` |

**제약 요약**

| 제약명 | 종류 | 대상 컬럼 | 내용 |
|--------|------|----------|------|
| PRIMARY KEY | PK | transaction_id | — |
| chk_transaction_price | CHECK | agreed_price | 0 이상 |
| chk_transaction_self | CHECK | (buyer_uid, seller_uid) | buyer_uid ≠ seller_uid |
| fk_transaction_product | FK | pid | → Product(pid) ON DELETE RESTRICT |
| fk_transaction_buyer | FK | buyer_uid | → User(uid) ON DELETE RESTRICT |
| fk_transaction_seller | FK | seller_uid | → User(uid) ON DELETE RESTRICT |
| idx_transaction_buyer | INDEX | buyer_uid | 구매 내역 조회 성능 |
| idx_transaction_seller | INDEX | seller_uid | 판매 내역 조회 성능 |
| idx_transaction_pid | INDEX | pid | 상품별 거래 조회 성능 |

---

## 10. Review

**역할**: 거래 완료 후 작성하는 후기. 하나의 거래에서 작성자(reviewer) 1인이 1개만 작성 가능.

| 컬럼명 | 데이터 타입 | PK | NOT NULL | UNIQUE | DEFAULT | CHECK | FK |
|--------|-----------|:--:|:--------:|:------:|---------|-------|----|
| review_id | BIGINT | ✅ | ✅ | — (`AUTO`) | — | — | — |
| transaction_id | BIGINT | — | ✅ | — | — | — | → Transaction.transaction_id |
| reviewer_uid | VARCHAR(36) | — | ✅ | — | — | — | → User.uid |
| reviewee_uid | VARCHAR(36) | — | ✅ | — | — | — | → User.uid |
| rating | TINYINT | — | ✅ | — | — | 1 ≤ x ≤ 5 | — |
| content | TEXT | — | — | — | NULL | — | — |
| created_at | DATETIME | — | ✅ | — | `NOW()` | — | — |

**제약 요약**

| 제약명 | 종류 | 대상 컬럼 | 내용 |
|--------|------|----------|------|
| PRIMARY KEY | PK | review_id | — |
| uq_review_per_transaction | UNIQUE | (transaction_id, reviewer_uid) | 동일 거래 중복 후기 방지 |
| chk_review_rating | CHECK | rating | 1 ~ 5 |
| chk_review_self | CHECK | (reviewer_uid, reviewee_uid) | reviewer ≠ reviewee |
| fk_review_transaction | FK | transaction_id | → Transaction(transaction_id) ON DELETE RESTRICT |
| fk_review_reviewer | FK | reviewer_uid | → User(uid) ON DELETE RESTRICT |
| fk_review_reviewee | FK | reviewee_uid | → User(uid) ON DELETE RESTRICT |
| idx_review_reviewee | INDEX | reviewee_uid | 피평가자 후기 조회 성능 |

---

## 11. MannerKeyword

**역할**: 매너 키워드 마스터 데이터. 관리자가 사전에 정의한 선택지.

| 컬럼명 | 데이터 타입 | PK | NOT NULL | UNIQUE | DEFAULT | CHECK | FK |
|--------|-----------|:--:|:--------:|:------:|---------|-------|----|
| keyword_id | INT | ✅ | ✅ | — (`AUTO`) | — | — | — |
| label | VARCHAR(100) | — | ✅ | ✅ | — | — | — |

**제약 요약**

| 제약명 | 종류 | 대상 컬럼 | 내용 |
|--------|------|----------|------|
| PRIMARY KEY | PK | keyword_id | — |
| uq_mannerkeyword_label | UNIQUE | label | 키워드 텍스트 중복 불가 |

---

## 12. ReviewKeyword

**역할**: Review ↔ MannerKeyword M:N 중간 테이블. 복합 PK 사용.

| 컬럼명 | 데이터 타입 | PK | NOT NULL | UNIQUE | DEFAULT | CHECK | FK |
|--------|-----------|:--:|:--------:|:------:|---------|-------|----|
| review_id | BIGINT | ✅ | ✅ | — | — | — | → Review.review_id |
| keyword_id | INT | ✅ | ✅ | — | — | — | → MannerKeyword.keyword_id |

**제약 요약**

| 제약명 | 종류 | 대상 컬럼 | 내용 |
|--------|------|----------|------|
| PRIMARY KEY | 복합 PK | (review_id, keyword_id) | — |
| fk_reviewkeyword_review | FK | review_id | → Review(review_id) ON DELETE CASCADE |
| fk_reviewkeyword_keyword | FK | keyword_id | → MannerKeyword(keyword_id) ON DELETE RESTRICT |

---

## 13. Report

**역할**: 불량 사용자 신고 내역. `reporter_uid`는 DB에 저장하되 앱 레이어에서 익명 처리. 자기 신고 방지.

| 컬럼명 | 데이터 타입 | PK | NOT NULL | UNIQUE | DEFAULT | CHECK | FK |
|--------|-----------|:--:|:--------:|:------:|---------|-------|----|
| report_id | BIGINT | ✅ | ✅ | — (`AUTO`) | — | — | — |
| reporter_uid | VARCHAR(36) | — | ✅ | — | — | — | → User.uid |
| target_uid | VARCHAR(36) | — | ✅ | — | — | — | → User.uid |
| reason | VARCHAR(255) | — | ✅ | — | — | — | — |
| created_at | DATETIME | — | ✅ | — | `NOW()` | — | — |

**제약 요약**

| 제약명 | 종류 | 대상 컬럼 | 내용 |
|--------|------|----------|------|
| PRIMARY KEY | PK | report_id | — |
| chk_report_self | CHECK | (reporter_uid, target_uid) | reporter ≠ target (자기 신고 방지) |
| fk_report_reporter | FK | reporter_uid | → User(uid) ON DELETE RESTRICT |
| fk_report_target | FK | target_uid | → User(uid) ON DELETE RESTRICT |
| idx_report_target | INDEX | target_uid | 신고 대상별 조회 성능 |
| idx_report_reporter_target | INDEX | (reporter_uid, target_uid) | 중복 신고 확인 성능 |

> 동일 사용자의 동일 대상 중복 신고 여부는 애플리케이션 레이어에서 `created_at` 기간 조건으로 제어.

---

## 14. ReportEvidence

**역할**: 신고 시 첨부한 증거 이미지 URL. Report 삭제 시 CASCADE.

| 컬럼명 | 데이터 타입 | PK | NOT NULL | UNIQUE | DEFAULT | CHECK | FK |
|--------|-----------|:--:|:--------:|:------:|---------|-------|----|
| evidence_id | BIGINT | ✅ | ✅ | — (`AUTO`) | — | — | — |
| report_id | BIGINT | — | ✅ | — | — | — | → Report.report_id |
| image_url | VARCHAR(512) | — | ✅ | — | — | — | — |

**제약 요약**

| 제약명 | 종류 | 대상 컬럼 | 내용 |
|--------|------|----------|------|
| PRIMARY KEY | PK | evidence_id | — |
| fk_reportevidence_report | FK | report_id | → Report(report_id) ON DELETE CASCADE |
| idx_reportevidence_report | INDEX | report_id | 신고별 증거 조회 성능 |

---

## 15. UserPenalty

**역할**: 사용자 제재 이력. `expires_at = NULL`이면 영구 제재. 법적 증거 자료로서 보존.

| 컬럼명 | 데이터 타입 | PK | NOT NULL | UNIQUE | DEFAULT | CHECK | FK |
|--------|-----------|:--:|:--------:|:------:|---------|-------|----|
| penalty_id | BIGINT | ✅ | ✅ | — (`AUTO`) | — | — | — |
| uid | VARCHAR(36) | — | ✅ | — | — | — | → User.uid |
| type | ENUM | — | ✅ | — | — | 아래 참조 | — |
| issued_at | DATETIME | — | ✅ | — | `NOW()` | — | — |
| expires_at | DATETIME | — | — | — | NULL | — | — |

**ENUM 값**

| 컬럼 | 허용 값 |
|------|--------|
| type | `'warning'`, `'suspend'`, `'ban'` |

**제약 요약**

| 제약명 | 종류 | 대상 컬럼 | 내용 |
|--------|------|----------|------|
| PRIMARY KEY | PK | penalty_id | — |
| fk_userpenalty_user | FK | uid | → User(uid) ON DELETE RESTRICT |
| idx_userpenalty_uid | INDEX | uid | 사용자별 제재 이력 조회 성능 |

---

## 참조 무결성 전체 요약

| FK 제약명 | 테이블 | FK 컬럼 | 참조 테이블 | 참조 컬럼 | ON DELETE | ON UPDATE |
|----------|--------|--------|------------|---------|-----------|-----------|
| fk_user_region | User | preferred_region_id | Region | region_id | SET NULL | RESTRICT |
| fk_category_parent | Category | parent_id | Category | category_id | SET NULL | RESTRICT |
| fk_product_seller | Product | seller_uid | User | uid | RESTRICT | RESTRICT |
| fk_product_category | Product | category_id | Category | category_id | RESTRICT | RESTRICT |
| fk_productimage_product | ProductImage | pid | Product | pid | CASCADE | RESTRICT |
| fk_wishlist_user | Wishlist | uid | User | uid | CASCADE | RESTRICT |
| fk_wishlist_product | Wishlist | pid | Product | pid | CASCADE | RESTRICT |
| fk_chatroom_product | ChatRoom | product_id | Product | pid | RESTRICT | RESTRICT |
| fk_chatparticipant_room | ChatParticipant | room_id | ChatRoom | room_id | CASCADE | RESTRICT |
| fk_chatparticipant_user | ChatParticipant | uid | User | uid | RESTRICT | RESTRICT |
| fk_transaction_product | Transaction | pid | Product | pid | RESTRICT | RESTRICT |
| fk_transaction_buyer | Transaction | buyer_uid | User | uid | RESTRICT | RESTRICT |
| fk_transaction_seller | Transaction | seller_uid | User | uid | RESTRICT | RESTRICT |
| fk_review_transaction | Review | transaction_id | Transaction | transaction_id | RESTRICT | RESTRICT |
| fk_review_reviewer | Review | reviewer_uid | User | uid | RESTRICT | RESTRICT |
| fk_review_reviewee | Review | reviewee_uid | User | uid | RESTRICT | RESTRICT |
| fk_reviewkeyword_review | ReviewKeyword | review_id | Review | review_id | CASCADE | RESTRICT |
| fk_reviewkeyword_keyword | ReviewKeyword | keyword_id | MannerKeyword | keyword_id | RESTRICT | RESTRICT |
| fk_report_reporter | Report | reporter_uid | User | uid | RESTRICT | RESTRICT |
| fk_report_target | Report | target_uid | User | uid | RESTRICT | RESTRICT |
| fk_reportevidence_report | ReportEvidence | report_id | Report | report_id | CASCADE | RESTRICT |
| fk_userpenalty_user | UserPenalty | uid | User | uid | RESTRICT | RESTRICT |

> **ON DELETE RESTRICT**: 참조 중인 부모 행 삭제 불가. User·Product는 Soft Delete로 처리하므로 물리 삭제 자체를 막는 것이 안전.  
> **ON DELETE CASCADE**: 부모 삭제 시 자식 자동 삭제. 이미지·증거·참여자 등 부모 없이는 의미 없는 데이터에 적용.  
> **ON DELETE SET NULL**: Region 삭제 시 User의 preferred_region_id를 NULL로 처리. Category 계층 삭제 시 하위 카테고리를 최상위로 승격.
