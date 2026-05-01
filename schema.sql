-- ============================================================
--  대학 중고거래 플랫폼 — Database Schema
-- ============================================================
--  DBMS    : MySQL 8.0+
--  Charset : utf8mb4 / Collation: utf8mb4_unicode_ci
--  작성일  : 2026-05-01
--  참조    : tableSpec.md / platformDataDoc.md / ERD.jpg
-- ============================================================
--
--  [실행 순서]
--    1. DB 생성 및 선택
--    2. 테이블 생성 (FK 의존성 순서 준수)
--       Region → User → Category → Product → ProductImage
--       → Wishlist → ChatRoom → ChatParticipant → Transaction
--       → Review → MannerKeyword → ReviewKeyword
--       → Report → ReportEvidence → UserPenalty
--    3. 초기 시드 데이터 (Region, Category, MannerKeyword)
--
--  [Soft Delete 규칙]
--    User, Product 는 물리 삭제(DELETE) 금지.
--    deleted_at = NOW() 로 논리 삭제. 조회 시 WHERE deleted_at IS NULL 필수.
--
--  [UUID 생성]
--    uid(User), pid(Product) 는 애플리케이션에서 UUID v4 생성 후 삽입.
-- ============================================================

-- ── 0. 데이터베이스 생성 ──────────────────────────────────────
CREATE DATABASE IF NOT EXISTS marketplace
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE marketplace;

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
--  1. Region
--     역할: 선호 지역 마스터. 정밀 좌표 대신 지역 ID 사용.
-- ============================================================
DROP TABLE IF EXISTS Region;
CREATE TABLE Region (
    region_id   INT             NOT NULL AUTO_INCREMENT    COMMENT '지역 ID (PK)',
    name        VARCHAR(100)    NOT NULL                   COMMENT '지역명',

    PRIMARY KEY (region_id),
    UNIQUE KEY  uq_region_name (name)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='지역 마스터';

-- ============================================================
--  2. User
--     역할: 플랫폼 회원. Soft Delete(deleted_at) 적용.
--     PII : email, student_id → 애플리케이션 레이어 암호화 필수.
-- ============================================================
DROP TABLE IF EXISTS User;
CREATE TABLE User (
    uid                 VARCHAR(36)     NOT NULL                        COMMENT '사용자 UUID (PK)',
    email               VARCHAR(255)    NOT NULL                        COMMENT '학교 이메일 (암호화 저장)',
    password_hash       VARCHAR(255)    NOT NULL                        COMMENT 'Bcrypt 해시',
    nickname            VARCHAR(50)     NOT NULL                        COMMENT '닉네임',
    student_id          VARCHAR(20)     NOT NULL                        COMMENT '학번 (암호화 저장)',
    school_domain       VARCHAR(100)    NOT NULL                        COMMENT '학교 도메인 (예: snu.ac.kr)',
    profile_image_url   VARCHAR(512)    NULL        DEFAULT NULL        COMMENT 'S3 프로필 이미지 URL',
    bio                 TEXT            NULL        DEFAULT NULL        COMMENT '한 줄 소개',
    preferred_region_id INT             NULL        DEFAULT NULL        COMMENT 'FK → Region.region_id',
    joined_at           DATETIME        NOT NULL    DEFAULT CURRENT_TIMESTAMP   COMMENT '가입 승인일',
    manner_temperature  FLOAT           NOT NULL    DEFAULT 36.5        COMMENT '매너 온도 (0~100)',
    trade_count         INT             NOT NULL    DEFAULT 0           COMMENT '누적 거래 횟수',
    is_suspended        TINYINT(1)      NOT NULL    DEFAULT 0           COMMENT '이용 정지 여부 (0=정상, 1=정지)',
    warning_count       INT             NOT NULL    DEFAULT 0           COMMENT '누적 경고 횟수',
    deleted_at          DATETIME        NULL        DEFAULT NULL        COMMENT 'Soft Delete 시각 (NULL=활성)',

    PRIMARY KEY (uid),
    UNIQUE KEY  uq_user_email    (email),
    UNIQUE KEY  uq_user_nickname (nickname),

    CONSTRAINT chk_user_manner        CHECK (manner_temperature >= 0 AND manner_temperature <= 100),
    CONSTRAINT chk_user_trade_count   CHECK (trade_count >= 0),
    CONSTRAINT chk_user_warning_count CHECK (warning_count >= 0),

    CONSTRAINT fk_user_region
        FOREIGN KEY (preferred_region_id)
        REFERENCES  Region (region_id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='플랫폼 회원';

-- ============================================================
--  3. Category
--     역할: 상품 카테고리 마스터. parent_id 자기 참조로 계층 구조.
-- ============================================================
DROP TABLE IF EXISTS Category;
CREATE TABLE Category (
    category_id INT             NOT NULL AUTO_INCREMENT    COMMENT '카테고리 ID (PK)',
    parent_id   INT             NULL        DEFAULT NULL   COMMENT 'FK → Category.category_id (최상위면 NULL)',
    name        VARCHAR(100)    NOT NULL                   COMMENT '카테고리명',

    PRIMARY KEY (category_id),

    CONSTRAINT fk_category_parent
        FOREIGN KEY (parent_id)
        REFERENCES  Category (category_id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='상품 카테고리 (계층형)';

-- ============================================================
--  4. Product
--     역할: 판매 상품. Soft Delete(deleted_at) 적용.
--           updated_at 은 DB가 수정 시 자동 갱신.
-- ============================================================
DROP TABLE IF EXISTS Product;
CREATE TABLE Product (
    pid         VARCHAR(36)     NOT NULL                        COMMENT '상품 UUID (PK)',
    seller_uid  VARCHAR(36)     NOT NULL                        COMMENT 'FK → User.uid',
    category_id INT             NOT NULL                        COMMENT 'FK → Category.category_id',
    title       VARCHAR(200)    NOT NULL                        COMMENT '상품명',
    price       INT             NOT NULL                        COMMENT '게시 가격 (원, 0 이상)',
    `condition` ENUM(
        'new', 'like_new', 'good', 'fair', 'poor'
    )                           NOT NULL                        COMMENT '상품 상태',
    description TEXT            NULL        DEFAULT NULL        COMMENT '상품 본문',
    status      ENUM(
        'selling', 'reserved', 'sold'
    )                           NOT NULL    DEFAULT 'selling'   COMMENT '판매 상태',
    created_at  DATETIME        NOT NULL    DEFAULT CURRENT_TIMESTAMP              COMMENT '등록 시각',
    updated_at  DATETIME        NOT NULL    DEFAULT CURRENT_TIMESTAMP
                                            ON UPDATE CURRENT_TIMESTAMP            COMMENT '최종 수정 시각',
    deleted_at  DATETIME        NULL        DEFAULT NULL        COMMENT 'Soft Delete 시각 (NULL=공개)',

    PRIMARY KEY (pid),

    CONSTRAINT chk_product_price CHECK (price >= 0),

    CONSTRAINT fk_product_seller
        FOREIGN KEY (seller_uid)
        REFERENCES  User (uid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT fk_product_category
        FOREIGN KEY (category_id)
        REFERENCES  Category (category_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    INDEX idx_product_seller   (seller_uid),
    INDEX idx_product_status   (status),
    INDEX idx_product_category (category_id),
    INDEX idx_product_created  (created_at),
    INDEX idx_product_deleted  (deleted_at)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='판매 상품';

-- ============================================================
--  5. ProductImage
--     역할: 상품별 이미지 URL 목록 (1:N).
--           Product Soft Delete 후에도 이미지 URL 보존.
-- ============================================================
DROP TABLE IF EXISTS ProductImage;
CREATE TABLE ProductImage (
    image_id        BIGINT          NOT NULL AUTO_INCREMENT    COMMENT '이미지 ID (PK)',
    pid             VARCHAR(36)     NOT NULL                   COMMENT 'FK → Product.pid',
    image_url       VARCHAR(512)    NOT NULL                   COMMENT 'S3 이미지 URL',
    display_order   INT             NOT NULL    DEFAULT 0      COMMENT '표시 순서 (0부터)',

    PRIMARY KEY (image_id),

    CONSTRAINT chk_productimage_order CHECK (display_order >= 0),

    CONSTRAINT fk_productimage_product
        FOREIGN KEY (pid)
        REFERENCES  Product (pid)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,

    INDEX idx_productimage_pid (pid)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='상품 이미지';

-- ============================================================
--  6. Wishlist
--     역할: 찜 목록 (User ↔ Product M:N).
--           동일 사용자-상품 조합 중복 불가.
-- ============================================================
DROP TABLE IF EXISTS Wishlist;
CREATE TABLE Wishlist (
    wishlist_id BIGINT          NOT NULL AUTO_INCREMENT    COMMENT '찜 ID (PK)',
    uid         VARCHAR(36)     NOT NULL                   COMMENT 'FK → User.uid',
    pid         VARCHAR(36)     NOT NULL                   COMMENT 'FK → Product.pid',
    created_at  DATETIME        NOT NULL    DEFAULT CURRENT_TIMESTAMP   COMMENT '찜 등록 시각',

    PRIMARY KEY (wishlist_id),
    UNIQUE KEY  uq_wishlist_user_product (uid, pid),

    CONSTRAINT fk_wishlist_user
        FOREIGN KEY (uid)
        REFERENCES  User (uid)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,

    CONSTRAINT fk_wishlist_product
        FOREIGN KEY (pid)
        REFERENCES  Product (pid)
        ON DELETE CASCADE
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='찜 목록';

-- ============================================================
--  7. ChatRoom
--     역할: 상품 거래를 위한 채팅방.
--           하나의 상품에 구매 희망자별 채팅방 생성.
-- ============================================================
DROP TABLE IF EXISTS ChatRoom;
CREATE TABLE ChatRoom (
    room_id     BIGINT          NOT NULL AUTO_INCREMENT    COMMENT '채팅방 ID (PK)',
    product_id  VARCHAR(36)     NOT NULL                   COMMENT 'FK → Product.pid',
    created_at  DATETIME        NOT NULL    DEFAULT CURRENT_TIMESTAMP   COMMENT '채팅방 생성 시각',

    PRIMARY KEY (room_id),

    CONSTRAINT fk_chatroom_product
        FOREIGN KEY (product_id)
        REFERENCES  Product (pid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    INDEX idx_chatroom_product (product_id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='채팅방';

-- ============================================================
--  8. ChatParticipant
--     역할: 채팅방 참여자 + 읽음 확인.
--           last_read_at 으로 안읽은 메시지 수 산출.
-- ============================================================
DROP TABLE IF EXISTS ChatParticipant;
CREATE TABLE ChatParticipant (
    cp_id           BIGINT          NOT NULL AUTO_INCREMENT    COMMENT '참여자 ID (PK)',
    room_id         BIGINT          NOT NULL                   COMMENT 'FK → ChatRoom.room_id',
    uid             VARCHAR(36)     NOT NULL                   COMMENT 'FK → User.uid',
    last_read_at    DATETIME        NULL        DEFAULT NULL   COMMENT '마지막 읽음 시각 (NULL=미읽음)',

    PRIMARY KEY (cp_id),
    UNIQUE KEY  uq_chatparticipant (room_id, uid),

    CONSTRAINT fk_chatparticipant_room
        FOREIGN KEY (room_id)
        REFERENCES  ChatRoom (room_id)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,

    CONSTRAINT fk_chatparticipant_user
        FOREIGN KEY (uid)
        REFERENCES  User (uid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='채팅방 참여자';

-- ============================================================
--  9. Transaction
--     역할: 거래 완료 내역.
--           agreed_price : 거래 시점 가격 스냅샷 (Product.price 변경 무관).
--           buyer ≠ seller 강제.
-- ============================================================
DROP TABLE IF EXISTS `Transaction`;
CREATE TABLE `Transaction` (
    transaction_id  BIGINT          NOT NULL AUTO_INCREMENT    COMMENT '거래 ID (PK)',
    pid             VARCHAR(36)     NOT NULL                   COMMENT 'FK → Product.pid',
    buyer_uid       VARCHAR(36)     NOT NULL                   COMMENT 'FK → User.uid (구매자)',
    seller_uid      VARCHAR(36)     NOT NULL                   COMMENT 'FK → User.uid (판매자)',
    agreed_price    INT             NOT NULL                   COMMENT '거래 확정 가격 (0 이상)',
    status          ENUM(
        'pending', 'completed', 'cancelled'
    )                               NOT NULL    DEFAULT 'pending'   COMMENT '거래 상태',
    completed_at    DATETIME        NULL        DEFAULT NULL        COMMENT '거래 완료 시각',

    PRIMARY KEY (transaction_id),

    CONSTRAINT chk_transaction_price       CHECK (agreed_price >= 0),
    CONSTRAINT chk_transaction_buyer_seller CHECK (buyer_uid != seller_uid),

    CONSTRAINT fk_transaction_product
        FOREIGN KEY (pid)
        REFERENCES  Product (pid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT fk_transaction_buyer
        FOREIGN KEY (buyer_uid)
        REFERENCES  User (uid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT fk_transaction_seller
        FOREIGN KEY (seller_uid)
        REFERENCES  User (uid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    INDEX idx_transaction_buyer  (buyer_uid),
    INDEX idx_transaction_seller (seller_uid),
    INDEX idx_transaction_pid    (pid)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='거래 내역';

-- ============================================================
--  10. Review
--      역할: 거래 완료 후 작성하는 후기.
--            (transaction_id, reviewer_uid) 조합으로 중복 후기 방지.
--            reviewer ≠ reviewee 강제.
-- ============================================================
DROP TABLE IF EXISTS Review;
CREATE TABLE Review (
    review_id       BIGINT          NOT NULL AUTO_INCREMENT    COMMENT '후기 ID (PK)',
    transaction_id  BIGINT          NOT NULL                   COMMENT 'FK → Transaction.transaction_id',
    reviewer_uid    VARCHAR(36)     NOT NULL                   COMMENT 'FK → User.uid (작성자)',
    reviewee_uid    VARCHAR(36)     NOT NULL                   COMMENT 'FK → User.uid (피평가자)',
    rating          TINYINT         NOT NULL                   COMMENT '별점 (1~5)',
    content         TEXT            NULL        DEFAULT NULL   COMMENT '후기 내용',
    created_at      DATETIME        NOT NULL    DEFAULT CURRENT_TIMESTAMP   COMMENT '작성 시각',

    PRIMARY KEY (review_id),
    UNIQUE KEY  uq_review_per_transaction (transaction_id, reviewer_uid),

    CONSTRAINT chk_review_rating      CHECK (rating >= 1 AND rating <= 5),
    CONSTRAINT chk_review_self        CHECK (reviewer_uid != reviewee_uid),

    CONSTRAINT fk_review_transaction
        FOREIGN KEY (transaction_id)
        REFERENCES  `Transaction` (transaction_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT fk_review_reviewer
        FOREIGN KEY (reviewer_uid)
        REFERENCES  User (uid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT fk_review_reviewee
        FOREIGN KEY (reviewee_uid)
        REFERENCES  User (uid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    INDEX idx_review_reviewee (reviewee_uid)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='거래 후기';

-- ============================================================
--  11. MannerKeyword
--      역할: 매너 키워드 마스터 (관리자 사전 정의).
-- ============================================================
DROP TABLE IF EXISTS MannerKeyword;
CREATE TABLE MannerKeyword (
    keyword_id  INT             NOT NULL AUTO_INCREMENT    COMMENT '키워드 ID (PK)',
    label       VARCHAR(100)    NOT NULL                   COMMENT '키워드 텍스트',

    PRIMARY KEY (keyword_id),
    UNIQUE KEY  uq_mannerkeyword_label (label)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='매너 키워드 마스터';

-- ============================================================
--  12. ReviewKeyword
--      역할: Review ↔ MannerKeyword M:N 중간 테이블.
--            복합 PK 사용.
-- ============================================================
DROP TABLE IF EXISTS ReviewKeyword;
CREATE TABLE ReviewKeyword (
    review_id   BIGINT  NOT NULL   COMMENT 'FK → Review.review_id',
    keyword_id  INT     NOT NULL   COMMENT 'FK → MannerKeyword.keyword_id',

    PRIMARY KEY (review_id, keyword_id),

    CONSTRAINT fk_reviewkeyword_review
        FOREIGN KEY (review_id)
        REFERENCES  Review (review_id)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,

    CONSTRAINT fk_reviewkeyword_keyword
        FOREIGN KEY (keyword_id)
        REFERENCES  MannerKeyword (keyword_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='후기-매너키워드 연결';

-- ============================================================
--  13. Report
--      역할: 불량 사용자 신고.
--            reporter_uid DB 저장 (익명성은 앱 레이어 처리).
--            자기 신고 방지 CHECK 포함.
-- ============================================================
DROP TABLE IF EXISTS Report;
CREATE TABLE Report (
    report_id       BIGINT          NOT NULL AUTO_INCREMENT    COMMENT '신고 ID (PK)',
    reporter_uid    VARCHAR(36)     NOT NULL                   COMMENT 'FK → User.uid (신고자, 앱에서 익명 처리)',
    target_uid      VARCHAR(36)     NOT NULL                   COMMENT 'FK → User.uid (신고 대상)',
    reason          VARCHAR(255)    NOT NULL                   COMMENT '신고 사유',
    created_at      DATETIME        NOT NULL    DEFAULT CURRENT_TIMESTAMP   COMMENT '신고 접수 시각',

    PRIMARY KEY (report_id),

    CONSTRAINT chk_report_self CHECK (reporter_uid != target_uid),

    CONSTRAINT fk_report_reporter
        FOREIGN KEY (reporter_uid)
        REFERENCES  User (uid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT fk_report_target
        FOREIGN KEY (target_uid)
        REFERENCES  User (uid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    INDEX idx_report_target          (target_uid),
    INDEX idx_report_reporter_target (reporter_uid, target_uid)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='신고 내역';

-- ============================================================
--  14. ReportEvidence
--      역할: 신고 증거 이미지 URL. Report 삭제 시 CASCADE.
-- ============================================================
DROP TABLE IF EXISTS ReportEvidence;
CREATE TABLE ReportEvidence (
    evidence_id BIGINT          NOT NULL AUTO_INCREMENT    COMMENT '증거 ID (PK)',
    report_id   BIGINT          NOT NULL                   COMMENT 'FK → Report.report_id',
    image_url   VARCHAR(512)    NOT NULL                   COMMENT 'S3 증거 이미지 URL',

    PRIMARY KEY (evidence_id),

    CONSTRAINT fk_reportevidence_report
        FOREIGN KEY (report_id)
        REFERENCES  Report (report_id)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,

    INDEX idx_reportevidence_report (report_id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='신고 증거 이미지';

-- ============================================================
--  15. UserPenalty
--      역할: 사용자 제재 이력.
--            expires_at = NULL → 영구 제재(ban).
--            법적 증거 자료로서 물리 삭제 금지.
-- ============================================================
DROP TABLE IF EXISTS UserPenalty;
CREATE TABLE UserPenalty (
    penalty_id  BIGINT      NOT NULL AUTO_INCREMENT    COMMENT '제재 ID (PK)',
    uid         VARCHAR(36) NOT NULL                   COMMENT 'FK → User.uid',
    type        ENUM(
        'warning', 'suspend', 'ban'
    )                       NOT NULL                   COMMENT '제재 유형',
    issued_at   DATETIME    NOT NULL    DEFAULT CURRENT_TIMESTAMP   COMMENT '제재 발효 시각',
    expires_at  DATETIME    NULL        DEFAULT NULL                COMMENT '제재 만료 시각 (NULL=영구)',

    PRIMARY KEY (penalty_id),

    CONSTRAINT fk_userpenalty_user
        FOREIGN KEY (uid)
        REFERENCES  User (uid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    INDEX idx_userpenalty_uid (uid)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='사용자 제재 이력';

SET FOREIGN_KEY_CHECKS = 1;


-- ============================================================
--  SEED DATA
--  운영 전 반드시 삽입해야 하는 마스터 데이터
-- ============================================================

-- ── Seed: Region ─────────────────────────────────────────────
INSERT INTO Region (name) VALUES
    ('학교 근처'),
    ('기숙사'),
    ('캠퍼스 내'),
    ('시내'),
    ('온라인 택배');

-- ── Seed: Category (2단계 계층) ──────────────────────────────
INSERT INTO Category (parent_id, name) VALUES
    (NULL, '전자기기'),       -- 1
    (NULL, '도서/교재'),      -- 2
    (NULL, '의류/잡화'),      -- 3
    (NULL, '생활용품'),       -- 4
    (NULL, '식품/음료'),      -- 5
    (NULL, '기타');           -- 6

INSERT INTO Category (parent_id, name) VALUES
    (1, '스마트폰'),          -- 7
    (1, '노트북/태블릿'),     -- 8
    (1, '이어폰/헤드폰'),     -- 9
    (1, '카메라'),            -- 10
    (2, '전공 교재'),         -- 11
    (2, '일반 도서'),         -- 12
    (2, '문제집/참고서'),     -- 13
    (3, '상의'),              -- 14
    (3, '하의'),              -- 15
    (3, '가방/지갑'),         -- 16
    (4, '가구/인테리어'),     -- 17
    (4, '주방용품'),          -- 18
    (4, '청소/세탁');         -- 19

-- ── Seed: MannerKeyword ──────────────────────────────────────
INSERT INTO MannerKeyword (label) VALUES
    ('시간을 잘 지켜요'),
    ('친절하고 매너가 좋아요'),
    ('응답이 빨라요'),
    ('상품 설명이 정확해요'),
    ('상품 상태가 설명과 같아요'),
    ('제품을 깔끔하게 포장해줬어요'),
    ('거래 장소를 잘 지켜요'),
    ('흥정이 무리 없어요'),
    ('좋은 상품을 저렴하게 판매해요'),
    ('또 거래하고 싶어요');
