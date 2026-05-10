# 교환학생 특화 기능 — API 명세서

> 작성일: 2026-05-05
> 담당: 교환학생 파트
> 참조: exchange_student_feature_spec.md / schema.sql

---

## 공통 사항

### 호출 방식

| 구분 | 방식 | 대상 |
|------|------|------|
| 기본 | Supabase 클라이언트 직접 호출 | 대부분의 조회/등록 |
| Edge Function | `/api/...` 별도 엔드포인트 | 거래 완료, 번역 채팅 |

### 공통 응답 규격

**성공**
```json
{
  "data": [...],
  "error": null
}
```

**실패**
```json
{
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "에러 메시지"
  }
}
```

### 공통 에러 코드

| 코드 | 설명 |
|------|------|
| `NOT_AUTHENTICATED` | 로그인 필요 |
| `ONBOARDING_REQUIRED` | 온보딩 미완료 — 패키지 추천 등 교환학생 전용 기능 접근 시 |
| `NOT_FOUND` | 데이터 없음 |
| `CONFLICT` | 중복 요청 |
| `FORBIDDEN` | 권한 없음 |
| `INVALID_FILE` | 지원하지 않는 파일 형식 |
| `FILE_TOO_LARGE` | 파일 크기 초과 |
| `UPLOAD_FAILED` | 업로드 실패 |
| `TRANSLATION_FAILED` | 번역 실패 (원문만 저장) |
| `INTERNAL_ERROR` | 서버 오류 |

### 공통 인증 처리

모든 API는 Supabase Auth 세션 필요. 교환학생 전용 기능은 추가로 `onboarding_completed = TRUE` 확인.

```typescript
// 교환학생 전용 기능 접근 시 공통 체크
const { data: profile } = await supabase
  .from('exchange_students')
  .select('onboarding_completed')
  .eq('uid', user.id)
  .single();

if (!profile?.onboarding_completed) {
  return { error: { code: 'ONBOARDING_REQUIRED', message: '온보딩을 먼저 완료해주세요' } };
}
```

---

## 1. 온보딩

### 1.1 교환학생 프로필 생성

> 온보딩 완료 시 `exchange_students` 행 생성

**방식:** Supabase 클라이언트 직접 호출

```typescript
const { data, error } = await supabase
  .from('exchange_students')
  .insert({
    uid: user.id,
    country_id: countryId,
    region_group: regionGroup,
    housing_type: housingType,    // 'dorm' | 'flat'
    semester: semester,            // 예: '2026-1'
    language_pref: languagePref,  // 'ko' | 'en'
    role: role,                    // 'incoming' | 'outgoing'
    onboarding_completed: true
  });
```

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `country_id` | `integer` | ✅ | countries.country_id |
| `region_group` | `string` | ✅ | 예: 'E3' |
| `housing_type` | `string` | ✅ | 'dorm' \| 'flat' |
| `semester` | `string` | ✅ | 예: '2026-1' |
| `language_pref` | `string` | ✅ | 'ko' \| 'en' |
| `role` | `string` | ✅ | 'incoming' \| 'outgoing' |

**Response**
```json
{
  "data": {
    "uid": "uuid-...",
    "onboarding_completed": true
  },
  "error": null
}
```

---

### 1.2 국가 목록 조회

**방식:** Supabase 클라이언트 직접 호출

```typescript
const { data, error } = await supabase
  .from('countries')
  .select('country_id, country_code, name_ko, name_en, region_group')
  .order('name_ko', { ascending: true });
```

**Response**
```json
{
  "data": [
    {
      "country_id": 1,
      "country_code": "E1",
      "name_ko": "영어권 유럽",
      "name_en": "Anglophone Europe",
      "region_group": "E1"
    }
  ],
  "error": null
}
```

---

### 1.3 교환학생 프로필 조회 (본인)

**방식:** Supabase 클라이언트 직접 호출

```typescript
const { data, error } = await supabase
  .from('exchange_students')
  .select(`
    uid,
    country_id,
    region_group,
    housing_type,
    semester,
    language_pref,
    role,
    onboarding_completed,
    countries (country_code, name_ko, name_en)
  `)
  .eq('uid', user.id)
  .single();
```

**Response**
```json
{
  "data": {
    "uid": "uuid-...",
    "country_id": 3,
    "region_group": "E3",
    "housing_type": "dorm",
    "semester": "2026-1",
    "language_pref": "en",
    "role": "incoming",
    "onboarding_completed": true,
    "country": {
      "country_code": "E3",
      "name_ko": "독일어권",
      "name_en": "German-speaking"
    }
  },
  "error": null
}
```

**에러 케이스**

| 상황 | 에러 코드 | 메시지 |
|------|---------|--------|
| 교환학생 프로필 없음 | `NOT_FOUND` | "교환학생 프로필이 없어요. 온보딩을 완료해주세요" |

---

### 1.4 교환학생 프로필 수정

> 온보딩 완료 후 학기/거주형태 등 변경 시

**방식:** Supabase 클라이언트 직접 호출

```typescript
const { data, error } = await supabase
  .from('exchange_students')
  .update({
    housing_type: housingType,
    semester: semester,
    language_pref: languagePref
  })
  .eq('uid', user.id)
  .select()
  .single();
```

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `housing_type` | `string` | ⬜ | 'dorm' \| 'flat' |
| `semester` | `string` | ⬜ | 예: '2026-1' |
| `language_pref` | `string` | ⬜ | 'ko' \| 'en' |

**Response**
```json
{
  "data": {
    "uid": "uuid-...",
    "housing_type": "flat",
    "semester": "2026-2",
    "language_pref": "ko"
  },
  "error": null
}
```

### 2.1 패키지 템플릿 목록 조회

**방식:** Supabase 클라이언트 직접 호출

```typescript
const { data, error } = await supabase
  .from('essential_packages')
  .select(`
    package_id,
    template_type,
    name,
    housing_type,
    package_items (
      package_item_id,
      category_id,
      is_required,
      priority_order,
      requires_hygiene_cert,
      categories (name)
    )
  `)
  .order('package_id', { ascending: true });
```

**Response**
```json
{
  "data": [
    {
      "package_id": 1,
      "template_type": "DORM_BASIC",
      "name": { "ko": "기숙사 기본 패키지", "en": "Dorm Basic Package" },
      "housing_type": "dorm",
      "items": [
        {
          "package_item_id": 1,
          "category_id": 10,
          "category_name": "이불",
          "is_required": true,
          "priority_order": 1,
          "requires_hygiene_cert": true
        }
      ]
    }
  ],
  "error": null
}
```

---

### 2.2 게시 가능 여부 확인

> 세탁 인증 필요 물품 중 미인증 항목 확인 — 게시 버튼 활성/비활성 판단용

**방식:** Supabase 클라이언트 직접 호출

```typescript
// 세탁 인증 필요 물품 조회
const { data: requiredItems } = await supabase
  .from('package_items')
  .select('category_id')
  .eq('package_id', packageId)
  .eq('requires_hygiene_cert', true);

// 인증 완료 물품 조회
const { data: approvedCerts } = await supabase
  .from('hygiene_certifications')
  .select('category_id')
  .eq('seller_uid', user.id)
  .eq('status', 'approved')
  .in('category_id', requiredItems.map(i => i.category_id));

const isPostable = requiredItems.length === approvedCerts.length;
```

**Response**
```json
{
  "data": {
    "is_postable": false,
    "required_count": 3,
    "approved_count": 2,
    "missing_certs": [
      { "category_id": 12, "category_name": "토퍼" }
    ]
  },
  "error": null
}
```

---

### 2.3 패키지 매물 등록 (게시하기)

**방식:** Supabase 클라이언트 직접 호출

```typescript
// 체크한 물품 수만큼 package_listings INSERT
const listings = checkedCategoryIds.map(categoryId => ({
  match_id: matchId,
  seller_uid: user.id,
  category_id: categoryId,
  status: 'selling',
  semester: profile.semester,
  cert_id: certMap[categoryId] ?? null   // 세탁 인증 연결
}));

const { data, error } = await supabase
  .from('package_listings')
  .insert(listings)
  .select();
```

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `package_id` | `integer` | ✅ | 패키지 템플릿 ID |
| `checked_category_ids` | `integer[]` | ✅ | 보유 물품 카테고리 ID 목록 |
| `semester` | `string` | ✅ | 거래 학기 (예: '2026-1') |

**Response**
```json
{
  "data": {
    "match_id": 201,
    "listed_count": 8,
    "listings": [
      { "listing_id": 1, "category_id": 10, "status": "selling" }
    ]
  },
  "error": null
}
```

**에러 케이스**

| 상황 | 에러 코드 | 메시지 |
|------|---------|--------|
| 세탁 인증 미완료 항목 있음 | `CERT_REQUIRED` | "세탁 인증이 완료되지 않은 항목이 있어요" |
| 체크한 물품 없음 | `INVALID_REQUEST` | "최소 1개 이상의 물품을 선택해주세요" |

---

### 2.4 내 패키지 현황 조회 (셀러)

**방식:** Supabase 클라이언트 직접 호출

```typescript
const { data, error } = await supabase
  .from('package_matches')
  .select(`
    match_id,
    status,
    semester,
    essential_packages (name, template_type),
    package_listings (
      listing_id,
      category_id,
      status,
      categories (name)
    ),
    buyer:users!buyer_uid (nickname, manner_temperature)
  `)
  .eq('seller_uid', user.id)
  .in('status', ['pending', 'matched'])
  .order('created_at', { ascending: false });
```

**Response**
```json
{
  "data": [
    {
      "match_id": 201,
      "status": "pending",
      "semester": "2026-1",
      "package_name": "기숙사 기본 패키지",
      "buyer_name": "Emma",
      "buyer_manner_temperature": 36.5,
      "listings": [
        { "listing_id": 1, "category_name": "이불", "status": "selling" }
      ]
    }
  ],
  "error": null
}
```

---

## 3. 패키지 추천

### 2.1 패키지 목록 조회 (Fallback 포함)

**방식:** Supabase 클라이언트 직접 호출

```typescript
// Step 1: 사용자 정보 조회
const { data: profile } = await supabase
  .from('exchange_students')
  .select('region_group, housing_type, semester')
  .eq('uid', user.id)
  .single();

// Step 2: 패키지 템플릿 조회 (1순위)
let { data: packages } = await supabase
  .from('essential_packages')
  .select('*')
  .eq('country_code', profile.country_code)
  .or(`housing_type.eq.${profile.housing_type},housing_type.is.null`);

// 2순위 Fallback
if (!packages?.length) {
  ({ data: packages } = await supabase
    .from('essential_packages')
    .select('*')
    .eq('region_group', profile.region_group)
    .or(`housing_type.eq.${profile.housing_type},housing_type.is.null`));
}

// 3순위 Fallback
if (!packages?.length) {
  ({ data: packages } = await supabase
    .from('essential_packages')
    .select('*')
    .is('region_group', null)
    .is('housing_type', null));
}
```

**Response**
```json
{
  "data": {
    "applied_tier": 2,
    "applied_label": "독일 지역 기준",
    "packages": [
      {
        "package_id": 1,
        "template_type": "DORM_BASIC",
        "name": { "ko": "기숙사 기본 패키지", "en": "Dorm Basic Package" }
      }
    ]
  },
  "error": null
}
```

---

### 2.2 셀러 목록 조회 (점수 기반 정렬)

**방식:** Supabase 클라이언트 직접 호출

```typescript
const { data, error } = await supabase
  .from('package_matches')
  .select(`
    match_id,
    seller_uid,
    semester,
    status,
    users!seller_uid (nickname, manner_temperature),
    package_listings (
      listing_id,
      category_id,
      status,
      hygiene_certifications (status)
    )
  `)
  .eq('package_id', packageId)
  .in('status', ['pending', 'matched'])
  .eq('semester', profile.semester)
  .limit(5);
```

**Response**
```json
{
  "data": {
    "sellers": [
      {
        "match_id": 101,
        "seller_uid": "uuid-...",
        "seller_name": "김민준",
        "semester": "2026-1",
        "is_different_semester": false,
        "owned_count": 8,
        "total_count": 10,
        "ownership_rate": 0.80,
        "hygiene_cert_rate": 1.00,
        "score": 0.86,
        "already_requested": false
      }
    ]
  },
  "error": null
}
```

---

### 2.3 패키지 상세 조회

> 바이어/셀러 입장에 따라 응답 구성이 달라요.

**방식:** Supabase 클라이언트 직접 호출

```typescript
const { data, error } = await supabase
  .from('package_items')
  .select(`
    package_item_id,
    category_id,
    is_required,
    priority_order,
    requires_hygiene_cert,
    categories (name),
    package_listings!inner (
      listing_id,
      status,
      image_url,
      hygiene_certifications (status)
    )
  `)
  .eq('package_id', packageId)
  .eq('package_listings.match_id', matchId)
  .order('is_required', { ascending: false })
  .order('priority_order', { ascending: true });

// 현재 사용자가 셀러인지 바이어인지 확인
const isSeller = match.seller_uid === user.id;
```

**Response — 바이어 입장**
```json
{
  "data": {
    "view_type": "buyer",
    "package_id": 1,
    "template_type": "DORM_BASIC",
    "seller": {
      "uid": "uuid-...",
      "nickname": "김민준",
      "manner_temperature": 38.5
    },
    "owned_count": 8,
    "total_count": 10,
    "match_status": "pending",
    "already_requested": true,
    "room_id": 301,
    "items": [
      {
        "category_id": 10,
        "category_name": "이불",
        "is_required": true,
        "requires_hygiene_cert": true,
        "is_owned": true,
        "hygiene_cert_status": "approved"
      },
      {
        "category_id": 20,
        "category_name": "청소기",
        "is_required": false,
        "requires_hygiene_cert": false,
        "is_owned": false,
        "hygiene_cert_status": null,
        "supplement_products": [
          {
            "pid": "uuid-...",
            "title": "다이슨 청소기 V8",
            "price": 35000
          }
        ]
      }
    ]
  },
  "error": null
}
```

**Response — 셀러 입장**
```json
{
  "data": {
    "view_type": "seller",
    "package_id": 1,
    "template_type": "DORM_BASIC",
    "buyers": [
      {
        "match_id": 201,
        "buyer_uid": "uuid-...",
        "buyer_name": "Emma",
        "match_status": "pending",
        "room_id": 301,
        "overlap_count": 3
      }
    ],
    "owned_count": 8,
    "total_count": 10,
    "is_postable": true,
    "items": [
      {
        "category_id": 10,
        "category_name": "이불",
        "is_required": true,
        "requires_hygiene_cert": true,
        "is_owned": true,
        "hygiene_cert_status": "approved"
      }
    ]
  },
  "error": null
}
```

---

## 3. 패키지 매칭

### 3.1 거래 요청 (직접 요청)

**방식:** Supabase 클라이언트 직접 호출

```typescript
// 매칭 생성
const { data: match, error: matchError } = await supabase
  .from('package_matches')
  .insert({
    package_id: packageId,
    buyer_uid: user.id,
    seller_uid: sellerUid,
    status: 'pending',
    semester: profile.semester
  })
  .select()
  .single();

// 채팅방 생성
const { data: room, error: roomError } = await supabase
  .from('chat_rooms')
  .insert({ package_match_id: match.match_id })
  .select()
  .single();

// 참여자 등록
await supabase
  .from('chat_participants')
  .insert([
    { room_id: room.room_id, uid: user.id },
    { room_id: room.room_id, uid: sellerUid }
  ]);
```

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `package_id` | `integer` | ✅ | 패키지 ID |
| `seller_uid` | `string` | ✅ | 셀러 UUID |

**Response**
```json
{
  "data": {
    "match_id": 201,
    "room_id": 301,
    "status": "pending"
  },
  "error": null
}
```

**에러 케이스**

| 상황 | 에러 코드 | 메시지 |
|------|---------|--------|
| 이미 요청한 매칭 | `CONFLICT` | "이미 요청한 패키지예요" |
| 자기 자신과 매칭 | `FORBIDDEN` | "본인 패키지에는 요청할 수 없어요" |

---

### 3.2 거래 완료 처리

**방식:** Edge Function

```
POST /api/matches/complete
```

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `match_id` | `number` | ✅ | 완료할 매칭 ID |

**처리 로직 (Edge Function 내부)**
```typescript
// 1. 거래 완료
await supabase
  .from('package_matches')
  .update({ status: 'completed' })
  .eq('match_id', matchId);

// 2. 나머지 바이어 매칭 cancelled
await supabase
  .from('package_matches')
  .update({ status: 'cancelled' })
  .eq('seller_uid', sellerUid)
  .eq('package_id', packageId)
  .neq('match_id', matchId)
  .in('status', ['pending', 'matched']);
```

**Response**
```json
{
  "data": {
    "match_id": 201,
    "status": "completed",
    "cancelled_count": 2
  },
  "error": null
}
```

---

### 3.3 매칭 취소

**방식:** Supabase 클라이언트 직접 호출

```typescript
const { data, error } = await supabase
  .from('package_matches')
  .update({ status: 'cancelled' })
  .eq('match_id', matchId)
  .in('status', ['pending', 'matched'])
  .or(`buyer_uid.eq.${user.id},seller_uid.eq.${user.id}`);
```

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `match_id` | `number` | ✅ | 취소할 매칭 ID |

**Response**
```json
{
  "data": { "match_id": 201, "status": "cancelled" },
  "error": null
}
```

---

### 3.4 매칭 목록 조회 (내 매칭)

**방식:** Supabase 클라이언트 직접 호출

```typescript
const { data, error } = await supabase
  .from('package_matches')
  .select(`
    match_id,
    status,
    semester,
    essential_packages (name),
    users!buyer_uid (nickname),
    users!seller_uid (nickname),
    chat_rooms (room_id)
  `)
  .or(`buyer_uid.eq.${user.id},seller_uid.eq.${user.id}`)
  .in('status', ['pending', 'matched'])
  .order('created_at', { ascending: false });
```

**Response**
```json
{
  "data": [
    {
      "match_id": 201,
      "status": "pending",
      "package_name": "기숙사 기본 패키지",
      "counterpart_name": "김민준",
      "room_id": 301,
      "semester": "2026-1"
    }
  ],
  "error": null
}
```

---

### 3.5 패키지 매물 상태 변경

**방식:** Supabase 클라이언트 직접 호출

```typescript
const { data, error } = await supabase
  .from('package_listings')
  .update({ status: newStatus })
  .eq('listing_id', listingId)
  .eq('seller_uid', user.id)   // RLS 보완 — 본인 매물만 수정 가능
  .select()
  .single();
```

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `listing_id` | `number` | ✅ | 매물 ID |
| `status` | `string` | ✅ | 'selling' \| 'reserved' \| 'sold' |

**Response**
```json
{
  "data": {
    "listing_id": 1,
    "status": "reserved"
  },
  "error": null
}
```

**에러 케이스**

| 상황 | 에러 코드 | 메시지 |
|------|---------|--------|
| 본인 매물 아님 | `FORBIDDEN` | "수정 권한이 없어요" |
| 이미 sold 상태 | `CONFLICT` | "이미 거래 완료된 매물이에요" |

---

### 3.6 매칭 상태 변경 (pending → matched)

> 채팅방에서 첫 메시지 전송 시 호출. 번역 채팅 API와 별도로 분리.

**방식:** Supabase 클라이언트 직접 호출

```typescript
const { data, error } = await supabase
  .from('package_matches')
  .update({ status: 'matched' })
  .eq('match_id', matchId)
  .eq('status', 'pending')
  .or(`buyer_uid.eq.${user.id},seller_uid.eq.${user.id}`)
  .select()
  .single();
```

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `match_id` | `number` | ✅ | 매칭 ID |

**Response**
```json
{
  "data": {
    "match_id": 201,
    "status": "matched"
  },
  "error": null
}
```

---

### 3.7 자동 매칭 실행 (스케줄러용)

> ⚠️ 자산 순환 파트와 협의 필요 — 스케줄러가 호출하는 인터페이스 정의

**방식:** Edge Function

```
POST /api/matches/auto
```

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `semester` | `string` | ✅ | 대상 학기 (예: '2026-1') |

**처리 로직 (Edge Function 내부)**
```typescript
// 1. 매칭 대상 셀러 조회
// 2. 셀러별 바이어 조회 (region_group 기준)
// 3. 겹치는 물품 확인
// 4. package_matches INSERT
// 5. chat_rooms INSERT
// 6. 알림 발송
// → 상세 로직: exchange_student_matching.md 참조
```

**Response**
```json
{
  "data": {
    "matched_count": 5,
    "skipped_count": 3,
    "semester": "2026-1"
  },
  "error": null
}
```

### 4.1 세탁 인증 사진 업로드

**방식:** Supabase 클라이언트 직접 호출 (Storage + DB)

```typescript
// Step 1: Storage 업로드
const filePath = `${user.id}/${categoryId}/${Date.now()}.jpg`;
const { data: storageData, error: storageError } = await supabase.storage
  .from('hygiene-certs')
  .upload(filePath, file, { contentType: 'image/jpeg' });

// Step 2: 공개 URL 생성
const { data: { publicUrl } } = supabase.storage
  .from('hygiene-certs')
  .getPublicUrl(filePath);

// Step 3: DB INSERT
const { data, error } = await supabase
  .from('hygiene_certifications')
  .upsert({
    seller_uid: user.id,
    category_id: categoryId,
    image_url: publicUrl,
    status: 'pending'
  }, { onConflict: 'seller_uid, category_id' });
```

**Request (FormData)**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `file` | `File` | ✅ | JPG 또는 PNG (최대 10MB) |
| `category_id` | `integer` | ✅ | 인증 대상 물품 카테고리 ID |

**Response**
```json
{
  "data": {
    "cert_id": 1,
    "status": "pending",
    "image_url": "https://storage.supabase.co/..."
  },
  "error": null
}
```

**에러 케이스**

| 상황 | 에러 코드 | 메시지 |
|------|---------|--------|
| 지원하지 않는 파일 형식 | `INVALID_FILE` | "JPG, PNG 파일만 업로드 가능해요" |
| 파일 크기 초과 | `FILE_TOO_LARGE` | "파일 크기가 너무 커요. 10MB 이하로 업로드해주세요" |
| 업로드 실패 | `UPLOAD_FAILED` | "업로드에 실패했어요. 다시 시도해주세요" |

---

### 4.2 세탁 인증 목록 조회

**방식:** Supabase 클라이언트 직접 호출

```typescript
const { data, error } = await supabase
  .from('hygiene_certifications')
  .select(`
    cert_id,
    category_id,
    image_url,
    status,
    reviewed_at,
    categories (name)
  `)
  .eq('seller_uid', user.id)
  .order('created_at', { ascending: false });
```

**Response**
```json
{
  "data": [
    {
      "cert_id": 1,
      "category_id": 10,
      "category_name": "이불",
      "image_url": "https://storage.supabase.co/...",
      "status": "approved",
      "reviewed_at": "2026-05-04T10:00:00Z"
    },
    {
      "cert_id": 2,
      "category_id": 11,
      "category_name": "베개",
      "image_url": "https://storage.supabase.co/...",
      "status": "pending",
      "reviewed_at": null
    }
  ],
  "error": null
}
```

---

## 5. 보완 시스템

### 5.1 미보유 물품 일반 매물 조회

**방식:** Supabase 클라이언트 직접 호출

```typescript
const { data, error } = await supabase
  .from('products')
  .select(`
    pid,
    title,
    price,
    condition,
    status,
    created_at,
    users (nickname),
    product_images (image_url, display_order)
  `)
  .eq('category_id', missingCategoryId)
  .eq('status', 'selling')
  .is('deleted_at', null)
  .order('created_at', { ascending: false })
  .limit(3);
```

**Query Parameters**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `category_id` | `integer` | ✅ | 미보유 물품 카테고리 ID |

**Response**
```json
{
  "data": {
    "category_id": 20,
    "category_name": "청소기",
    "products": [
      {
        "pid": "uuid-...",
        "title": "다이슨 청소기 V8",
        "price": 35000,
        "condition": "good",
        "seller_name": "이민준",
        "thumbnail": "https://storage.supabase.co/..."
      }
    ],
    "has_more": true
  },
  "error": null
}
```

---

## 6. 알림 신청 (exchange_wishlists)

### 6.1 알림 신청 등록

**방식:** Supabase 클라이언트 직접 호출

```typescript
const { data, error } = await supabase
  .from('exchange_wishlists')
  .insert({
    uid: user.id,
    category_id: categoryId,
    region_group: profile.region_group,
    semester: profile.semester
  });
```

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `category_id` | `integer` | ✅ | 알림 신청 물품 카테고리 ID |

**Response**
```json
{
  "data": {
    "exchange_wishlist_id": 50,
    "category_id": 21,
    "is_notified": false
  },
  "error": null
}
```

**에러 케이스**

| 상황 | 에러 코드 | 메시지 |
|------|---------|--------|
| 이미 신청한 물품 | `CONFLICT` | "이미 알림 신청한 물품이에요" |

---

### 6.2 알림 신청 취소 (Soft Delete)

**방식:** Supabase 클라이언트 직접 호출

```typescript
const { data, error } = await supabase
  .from('exchange_wishlists')
  .update({ deleted_at: new Date().toISOString() })
  .eq('exchange_wishlist_id', wishlistId)
  .eq('uid', user.id);
```

**Response**
```json
{
  "data": { "exchange_wishlist_id": 50, "deleted_at": "2026-05-05T14:00:00Z" },
  "error": null
}
```

---

### 6.3 알림 신청 목록 조회

**방식:** Supabase 클라이언트 직접 호출

```typescript
const { data, error } = await supabase
  .from('exchange_wishlists')
  .select(`
    exchange_wishlist_id,
    category_id,
    region_group,
    semester,
    is_notified,
    notified_at,
    created_at,
    categories (name)
  `)
  .eq('uid', user.id)
  .is('deleted_at', null)
  .order('created_at', { ascending: false });
```

**Response**
```json
{
  "data": [
    {
      "exchange_wishlist_id": 50,
      "category_id": 21,
      "category_name": "빨래 건조대",
      "region_group": "E3",
      "semester": "2026-1",
      "is_notified": false,
      "notified_at": null,
      "created_at": "2026-05-05T14:00:00Z"
    }
  ],
  "error": null
}
```

---

## 7. 번역 채팅

### 7.1 채팅 메시지 목록 조회

**방식:** Supabase 클라이언트 직접 호출

```typescript
const { data, error } = await supabase
  .from('chat_messages')
  .select(`
    id,
    sender_uid,
    data,
    original_text,
    translated_text,
    source_lang,
    target_lang,
    created_at,
    users!sender_uid (nickname)
  `)
  .eq('room_id', roomId)
  .order('created_at', { ascending: true });
```

**Query Parameters**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `room_id` | `number` | ✅ | 채팅방 ID |

**Response**
```json
{
  "data": [
    {
      "id": 1001,
      "sender_uid": "uuid-...",
      "sender_name": "김민준",
      "original_text": "이불은 세탁 완료했어요!",
      "translated_text": "The duvet has been washed!",
      "source_lang": "ko",
      "target_lang": "en",
      "created_at": "2026-05-05T14:00:00Z",
      "is_mine": true
    }
  ],
  "error": null
}
```

**에러 케이스**

| 상황 | 에러 코드 | 메시지 |
|------|---------|--------|
| 채팅방 참여자 아님 | `FORBIDDEN` | "접근 권한이 없어요" |

---

### 7.2 채팅방 읽음 처리

> 채팅방 진입 시 호출 — 미읽음 뱃지 초기화용

**방식:** Supabase 클라이언트 직접 호출

```typescript
const { data, error } = await supabase
  .from('chat_participants')
  .update({ last_read_at: new Date().toISOString() })
  .eq('room_id', roomId)
  .eq('uid', user.id);
```

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `room_id` | `number` | ✅ | 채팅방 ID |

**Response**
```json
{
  "data": {
    "room_id": 301,
    "last_read_at": "2026-05-05T14:00:00Z"
  },
  "error": null
}
```

---

### 7.3 메시지 전송 (번역 포함)

**방식:** Edge Function

```
POST /api/chat/send
```

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `room_id` | `number` | ✅ | 채팅방 ID |
| `match_id` | `number` | ✅ | 매칭 ID (pending → matched 처리용) |
| `content` | `string` | ✅ | 전송할 메시지 원문 |
| `source_lang` | `string` | ✅ | 원문 언어 ('ko' \| 'en') |
| `target_lang` | `string` | ✅ | 번역 대상 언어 ('ko' \| 'en') |

**처리 로직 (Edge Function 내부)**
```typescript
// 1. DeepL API 번역
const translated = await deepl.translate(content, targetLang);

// 2. DB 저장
await supabase.from('chat_messages').insert({
  room_id: roomId,
  sender_uid: user.id,
  data: { type: 'text', content },
  original_text: content,
  translated_text: translated ?? null,
  source_lang: sourceLang,
  target_lang: targetLang
});

// 3. pending → matched 상태 업데이트
await supabase
  .from('package_matches')
  .update({ status: 'matched' })
  .eq('match_id', matchId)
  .eq('status', 'pending');
```

**Response**
```json
{
  "data": {
    "message_id": 1001,
    "original_text": "이불은 세탁 완료했어요!",
    "translated_text": "The duvet has been washed!",
    "source_lang": "ko",
    "target_lang": "en"
  },
  "error": null
}
```

**에러 케이스**

| 상황 | 에러 코드 | 메시지 |
|------|---------|--------|
| DeepL 번역 실패 | `TRANSLATION_FAILED` | 원문만 저장, 번역 없이 전송 |
| 채팅방 접근 권한 없음 | `FORBIDDEN` | "접근 권한이 없어요" |
| 완료된 채팅방 | `FORBIDDEN` | "거래가 완료된 채팅방이에요" |

---

## 8. RLS 보호 현황

> Supabase RLS가 자동으로 보호하는 범위와 앱 레이어에서 추가 체크가 필요한 범위를 구분.

| API | RLS 자동 보호 | 앱 레이어 추가 체크 |
|-----|-------------|-----------------|
| 교환학생 프로필 조회/수정 | ✅ 본인만 접근 | 온보딩 완료 여부 |
| 패키지 템플릿 조회 | ✅ 전체 공개 읽기 | — |
| 셀러 목록 조회 | ✅ 인증 사용자만 | 온보딩 완료 여부 |
| 패키지 상세 조회 | ✅ 인증 사용자만 | 온보딩 완료 여부 |
| 패키지 매물 등록 | ✅ 셀러 본인만 INSERT | 세탁 인증 완료 여부 |
| 패키지 매물 상태 변경 | ✅ 셀러 본인만 UPDATE | 이미 sold 여부 |
| 거래 요청 | ✅ buyer_uid = auth.uid() | 자기 자신 매칭 방지 |
| 거래 완료 | ⚠️ Edge Function (RLS 우회) | 셀러 본인 확인 필요 |
| 매칭 취소 | ✅ 당사자만 UPDATE | — |
| 세탁 인증 업로드 | ✅ 셀러 본인만 | 파일 형식/크기 |
| 보완 시스템 매물 조회 | ✅ 전체 공개 읽기 | — |
| 알림 신청 등록/취소 | ✅ 본인만 | 중복 신청 |
| 채팅 메시지 조회 | ✅ 채팅방 참여자만 | — |
| 채팅 읽음 처리 | ✅ 본인만 UPDATE | — |
| 메시지 전송 | ⚠️ Edge Function (RLS 우회) | 채팅방 참여자 확인 필요 |
| 자동 매칭 실행 | ⚠️ Edge Function (service_role) | 스케줄러 인증 필요 |
