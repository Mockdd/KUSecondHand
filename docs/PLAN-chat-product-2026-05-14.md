# 일반 상품 채팅 기능 구현 계획
> 작성: 2026-05-14
> 범위: 일반 상품 채팅만 (패키지 채팅 제외)
> 상태: 완료
> 최종 수정: 2026-05-14 (UI/UX 개선, 읽음 처리, 자동 전송 완료)

---

## 1. 현재 상태 진단

### 파일 구조
```
src/app/(main)/chat/
├── page.tsx          ← 채팅 목록 (실제 구현, 실시간 갱신 없음)
└── [id]/page.tsx     ← 채팅방 (실제 구현 + mock 데이터 혼재)

src/app/api/chat/
├── create/route.ts   ← 채팅방 생성 API (정상)
└── send/route.ts     ← 메시지 전송 + DeepL 번역 API (정상)

src/components/chat/
└── ChatButton.tsx    ← 상품 페이지 "채팅하기" 버튼 (정상)
```

### 채팅 흐름 (이론상)
1. 상품 상세 페이지 → "채팅하기" 버튼 클릭
2. `POST /api/chat/create` → `chat_rooms` + `chat_participants` 생성 (service role)
3. `/chat/{room_id}` 으로 이동
4. 메시지 입력 → `POST /api/chat/send` → `chat_messages` INSERT + DeepL 번역
5. Supabase Realtime 구독 → 상대방에게 실시간 수신

### DB 구조 (관련 테이블)
| 테이블 | 역할 |
|--------|------|
| `chat_rooms` | 채팅방 (product_id 또는 package_match_id) |
| `chat_participants` | 참여자 + `last_read_at` |
| `chat_messages` | 메시지 (original_text, translated_text, source_lang, target_lang) |

---

## 2. 문제점 목록

### [P1] 버그 — optimistic 메시지에 nickname 대신 uid 표시
- **위치**: `chat/[id]/page.tsx` L313
- **현재 코드**: `sender_name: profile?.uid ?? '나'`
- **문제**: 메시지를 보내면 본인 이름이 uuid 문자열로 나타남
- **수정**: `profile?.nickname ?? '나'`

### [P2] mock 데이터 제거
- **위치**: `chat/[id]/page.tsx` L619~L672
- **현재 코드**: `MOCK_ROOMS`, `MOCK_MESSAGES` 상수 + `isMock = !userId` 분기
- **문제**: 로그인 안 한 사용자에게 가짜 데이터 노출, 코드 복잡도 증가
- **수정**: mock 데이터 전부 제거. 비로그인 시 로그인 유도 화면으로 대체

### [P3] 상품 채팅방 — 상품 판매 완료/삭제 시에도 `status='active'` 하드코딩
- **위치**: `chat/page.tsx` L103
- **현재 코드**: `status: 'active'` 하드코딩
- **문제**: 상품이 판매 완료되거나 삭제되어도 "활성" 상태로 표시됨
- **수정**: `products` 테이블의 `status` 컬럼을 함께 조회해서 반영

### [P4] 채팅 목록 — KU 버건디 색상 불일치
- **위치**: `chat/page.tsx` L123
- **현재 코드**: `bg-indigo-600` (로그인 유도 버튼)
- **문제**: 전체 디자인 시스템이 버건디(`#8B0029`)인데 indigo 사용
- **수정**: `bg-[#8B0029]` 로 교체

### [P5] 채팅 목록 — 마지막 메시지 / 시간 없음
- **위치**: `chat/page.tsx`
- **문제**: 어떤 채팅방을 먼저 확인해야 할지 알 수 없음 (메신저 기본 UX)
- **수정**: 각 채팅방의 가장 최근 메시지 텍스트 + 시간 표시

### [P6] 채팅 목록 — 실시간 갱신 없음
- **위치**: `chat/page.tsx`
- **문제**: 새 메시지가 와도 채팅 목록이 자동 갱신되지 않음
- **수정**: Supabase Realtime 으로 `chat_messages` INSERT 구독 → 목록 refetch

### [P7] TypeScript 타입 불일치 — schema.sql 기준으로 수정 필요
`src/types/supabase.ts` 와 실제 `schema.sql` 간 3가지 불일치 발견:

| 항목 | 현재 타입 | 실제 schema |
|------|-----------|------------|
| `chat_participants.id` | `id: number` | **`cp_id: number`** (컬럼명 다름) |
| `chat_rooms.deleted_at` | `deleted_at: string \| null` | **컬럼 없음** |
| `chat_messages.original_text` | `string` (non-nullable) | `TEXT NULL` (nullable) |

- `chat_participants.id` 불일치: 현재 코드에서 이 필드를 직접 참조하는 쿼리가 있으면 런타임 오류
- `chat_rooms.deleted_at`: 실제 스키마에 없는 컬럼 → 현재 코드에서 사용 안 하므로 즉각 버그는 아니나 타입 오염
- `original_text` nullable: `send` API는 `null`을 넣을 수 없으므로 실질적 영향은 낮으나 타입은 정확히

---

## 3. 수정 범위 및 우선순위

| 우선순위 | 항목 | 이유 |
|---------|------|------|
| 🔴 필수 | P2 — mock 데이터 제거 | 이제 실제 계정으로 테스트 가능 |
| 🔴 필수 | P1 — sender_name 버그 | 메시지 보내면 이름이 uuid로 보임 |
| 🔴 필수 | P7 — 타입 불일치 수정 | 런타임 오류 예방, 타입 안정성 |
| 🟡 중요 | P5 — 마지막 메시지/시간 | 메신저 기본 UX |
| 🟡 중요 | P6 — 목록 실시간 갱신 | 새 메시지 왔을 때 목록 반영 |
| 🟢 보완 | P3 — 상품 상태 반영 | API에서 sold 처리, UI 배지 미표시 (sold 방은 목록에서 제외되므로 실질 문제 없음) |
| 🟢 보완 | P4 — 색상 통일 | 디자인 시스템 일관성 |

---

## 4. 수정 상세 계획

### Step 1 — mock 제거 + P1 버그 수정 (chat/[id]/page.tsx)

**제거할 것:**
- `MOCK_ROOMS`, `MOCK_MESSAGES` 상수 전체
- `isMock` 변수 및 관련 분기 로직
- "개발 미리보기" 배너
- mock 관련 disabled/placeholder 분기

**비로그인 처리:**
```tsx
if (!userId) {
  return (
    <div>로그인 후 채팅을 이용할 수 있어요 + 로그인 버튼</div>
  )
}
```

**P1 수정:**
```tsx
// 변경 전
sender_name: profile?.uid ?? '나'

// 변경 후
sender_name: profile?.nickname ?? '나'
```

**패키지 관련 코드 처리:**
- 패키지 채팅방 로직(`type: 'package'` 분기, 거래완료/취소 버튼 등)은 **그대로 유지**
- 이번 범위는 "일반 상품 채팅 동작 확인"이므로 패키지 코드를 건드리지 않음

---

### Step 2 — TypeScript 타입 수정 (src/types/supabase.ts)

**P7 수정 내용:**
```ts
// chat_participants: id → cp_id
cp_id: number   // (기존: id: number)

// chat_rooms: deleted_at 제거
// (schema.sql에 해당 컬럼 없음)

// chat_messages: original_text nullable 로 수정
original_text: string | null   // (기존: string)
```

---

### Step 3 — 채팅 목록 UX (chat/page.tsx)

**P5 — 마지막 메시지 조회:**

각 채팅방의 가장 최근 `chat_messages` 1건을 함께 조회:
```sql
chat_messages (original_text, created_at) ORDER BY created_at DESC LIMIT 1
```

**P6 — 목록 실시간 갱신:**
`chat_messages` 테이블의 INSERT 이벤트 구독:
```ts
supabase
  .channel('chat-list-realtime')
  .on('postgres_changes', { event: 'INSERT', table: 'chat_messages' }, () => {
    queryClient.invalidateQueries({ queryKey: ['chat-list', userId] })
  })
  .subscribe()
```
단, 내가 참여한 방의 메시지만 의미있으므로 RLS가 이를 자연스럽게 필터링함

**P3 — 상품 상태 반영:**
`products (title, status)` 로 변경해서 `status`가 `sold` 이면 "거래 완료" 뱃지 표시

**P4 — 색상 통일:**
`bg-indigo-600` → `bg-[#8B0029]`

---

## 5. 변경 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `src/types/supabase.ts` | P7 — 타입 불일치 3건 수정 |
| `src/app/(main)/chat/[id]/page.tsx` | P1 — sender_name 버그, P2 — mock 제거, 비로그인 처리 |
| `src/app/(main)/chat/page.tsx` | P3 — 상품 상태, P4 — 색상, P5 — 마지막 메시지, P6 — 실시간 갱신 |

API / DB 변경 없음.

---

## 6. 수정 후 예상 동작

1. 상품 상세에서 "채팅하기" → 채팅방 생성 → 이동
2. 메시지 전송 시 내 이름(nickname)으로 즉시 표시
3. 상대방 화면에 Realtime으로 실시간 수신
4. 채팅 목록에서 마지막 메시지 텍스트 + 시간 확인 가능
5. 새 메시지 수신 시 채팅 목록 자동 갱신

---

## 7. 미포함 (이번 범위 외)

- 안읽은 메시지 수 (unread count)
- 타이핑 인디케이터
- 이미지 전송
- 메시지 삭제
- 패키지 채팅 수정

---

## 8. 추가 작업 — RLS 우회 수정 (완료)

`chat_participants` SELECT 정책이 자기참조(self-referential)라 재귀 문제 발생.
클라이언트/서버에서 직접 쿼리 시 참여자 확인이 항상 빈 결과 반환.

**수정 파일:**
| 파일 | 수정 내용 |
|------|-----------|
| `api/chat/create/route.ts` | 기존 채팅방 조회를 admin 클라이언트로 변경 |
| `api/chat/room/[id]/route.ts` | 모든 DB 쿼리를 admin 클라이언트로 변경 |
| `api/chat/send/route.ts` | 참여자 확인 + 메시지 INSERT를 admin 클라이언트로 변경 |
| `api/chat/messages/[id]/route.ts` | 신규 — admin 클라이언트로 메시지 조회 API |
| `api/chat/list/route.ts` | 신규 — admin 클라이언트로 채팅 목록 API |
| `chat/page.tsx` | `/api/chat/list` API 경유로 변경 |
| `chat/[id]/page.tsx` | `/api/chat/messages/[id]` API 경유로 변경, Realtime도 API 재조회로 변경 |

---

## 9. 추가 기능 — 채팅 시작 시 자동 전송 (완료)

새 채팅방 생성 시 "안녕하세요, 구매 희망합니다!" 메시지를 시스템이 자동 전송.

**구현 방식:** 서버사이드 자동 전송 — `/api/chat/create` 에서 방 신규 생성 시 `chat_messages` INSERT 추가

**변경 파일:**
- `api/chat/create/route.ts` — 신규 방 생성 후 admin으로 메시지 1건 INSERT
  - `sender_uid`: 구매자 uid (buyer)
  - `original_text`: `"안녕하세요, 구매 희망합니다!"`
  - 기존 방 반환 시에는 전송 안 함 (재입장 시 중복 방지)

---

## 10. UI/UX 개선 (완료)

### 채팅 목록
- 아바타 이니셜 (크림슨 tint 배경)
- 상품명 크림슨 컬러 강조
- 안읽은 메시지 숫자 뱃지 (크림슨) + 닉네임/메시지 볼드 처리
- 종료된 방 목록에서 제거
- `staleTime: 0` — 목록 진입 시마다 재조회 (읽음 처리 즉시 반영)
- 중복 방 dedup (같은 상품 최신 방 1개만 표시)
- 헤더 채팅 수 뱃지 제거 (불필요)

### 채팅방
- 레이아웃 padding 탈출 (`-mx-4 -my-6`) + `calc(100dvh - 56px)` — 웹/모바일 대응
- 내 메시지 버블 크림슨, 상대 메시지 흰 카드
- 시간 버블 옆 나란히 표시
- 전송 버튼 크림슨 원형 ↑
- 헤더 닉네임 bold, 상품명 링크
- 3초 폴링으로 실시간 메시지 수신 (Realtime RLS 이슈 우회)

### 읽음 처리
- `/api/chat/messages/[id]` 조회 시마다 서버에서 `last_read_at` 자동 갱신 (admin client)
- 클라이언트 측 중복 useEffect 제거
