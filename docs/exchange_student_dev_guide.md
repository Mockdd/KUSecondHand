# 교환학생 특화 기능 — 개발 가이드

> 작성일: 2026-05-05
> 담당: 교환학생 파트
> 참조: exchange_student_feature_spec.md / exchange_student_api_spec.md / schema.sql

---

## 목차

1. [핵심 원칙](#1-핵심-원칙)
2. [개발 프로세스](#2-개발-프로세스)
3. [Schema 변경 프로세스](#3-schema-변경-프로세스)
4. [Git 컨벤션](#4-git-컨벤션)
5. [폴더 구조](#5-폴더-구조)
6. [코드 컨벤션](#6-코드-컨벤션)
7. [Supabase 사용 가이드](#7-supabase-사용-가이드)
8. [테스트 데이터 세팅](#8-테스트-데이터-세팅)
9. [Phase 1 구현 현황](#9-phase-1-구현-현황-2026-05-07-기준)
10. [개발 체크리스트](#10-개발-체크리스트)

---

## 1. 핵심 원칙

### 🚨 절대 지켜야 할 것

```
1. 배포는 팀 전체 통합 전까지 절대 하지 않는다.
   → exchange-student 브랜치에서만 작업.
   → main 브랜치 직접 push 금지.

2. 개발 전 반드시 문서를 먼저 업데이트하고,
   팀원 승인 후 개발을 시작한다.

3. Schema 변경은 반드시 팀 카톡에 먼저 공유하고
   팀원 확인 후 반영한다.

4. 공용 Supabase DB는 하나다.
   테이블 구조 변경 시 전체에 영향 간다.
   신중하게.
```

### 개발 우선순위

```
문서 업데이트 → 팀 승인 → 개발 → 테스트 → 공유
```

---

## 2. 개발 프로세스

### 2.1 기능 개발 시작 전

```
Step 1. 구현할 기능 문서 확인
         → exchange_student_feature_spec.md
         → 해당 기능 상세 문서 (recommendation / matching / hygiene / supplement)

Step 2. API 명세 확인
         → exchange_student_api_spec.md
         → 필요한 API가 정의되어 있는지 확인

Step 3. 문서에 없거나 변경이 필요한 경우
         → 문서 먼저 업데이트
         → 카톡으로 팀 공유 ("이 부분 이렇게 바꾸려고 해요")
         → 팀원 확인 후 개발 시작

Step 4. 개발 시작
```

### 2.2 기능 개발 중

```
- 작은 단위로 커밋 (기능 하나 완성 시 바로 커밋)
- 막히면 혼자 2시간 이상 고민하지 말고 팀 카톡에 공유
- API 응답 구조 바꿔야 할 경우 → 문서 먼저 수정 후 공유
```

### 2.3 기능 개발 완료 후

```
Step 1. 본인 Supabase에서 동작 확인
Step 2. 관련 문서 업데이트 (변경사항 있으면)
Step 3. 커밋 & Push
Step 4. 팀 카톡에 완료 공유
         → "패키지 추천 기능 완료했어요. PR 확인 부탁드려요!"
```

### 2.4 다른 파트와 연동이 필요한 경우

```
연동 전 반드시 카톡으로 확인:
  - "이 API 응답 형식 맞나요?"
  - "이 테이블 컬럼 추가해도 되나요?"
  - "이 기능 언제 완성될 예정인가요?"

연동 후:
  - 양쪽 모두 테스트 확인
  - 문제 생기면 즉시 공유
```

---

## 3. Schema 변경 프로세스

### 🚨 Schema 변경은 가장 신중하게

공용 Supabase DB 하나를 팀 전체가 쓰기 때문에 **테이블 구조 변경은 전체에 영향**이 간다.

### 3.1 변경 가능한 것 (비교적 안전)

```
✅ 새 테이블 추가
✅ 기존 테이블에 NULL 허용 컬럼 추가 (ADD COLUMN ... NULL)
✅ 새 인덱스 추가
✅ seed 데이터 추가
```

### 3.2 변경 시 반드시 승인 필요한 것

```
⚠️ 기존 컬럼 타입 변경
⚠️ NOT NULL → NULL 허용 변경 (또는 반대)
⚠️ 기존 컬럼 삭제
⚠️ FK 제약 변경
⚠️ 기존 테이블 이름 변경
⚠️ ENUM 값 추가/변경
```

### 3.3 Schema 변경 프로세스

```
Step 1. 변경 내용 정리
         아래 형식으로 작성:

         [변경 테이블] chat_rooms
         [변경 내용] product_id NOT NULL → NULL 허용
         [변경 이유] 교환학생 채팅방은 product_id 없이 package_match_id로 연결
         [영향 범위] 팀원1 채팅 기능에 영향 있을 수 있음

Step 2. 카톡에 공유
         → 영향 받는 팀원에게 직접 확인 요청

Step 3. 팀원 확인 완료 후
         → 본인 Supabase에서 먼저 테스트
         → 문제 없으면 공용 Supabase에 반영

Step 4. schema.sql 마스터 파일 업데이트
         → exchange-student 브랜치에서 수정
         → 커밋 메시지: "db: chat_rooms product_id NULL 허용으로 변경"

Step 5. 카톡에 완료 공유
         → "schema.sql 업데이트했어요. 각자 Supabase에 반영해주세요!"
```

### 3.4 카톡 공유 템플릿

```
📌 Schema 변경 알림

[변경 테이블] 테이블명
[변경 내용] 구체적인 변경 사항
[변경 이유] 왜 바꿔야 하는지
[영향 범위] 어떤 파트에 영향이 있는지
[SQL]
ALTER TABLE 테이블명 ...;

확인 부탁드려요!
```

---

## 4. Git 컨벤션

### 4.1 브랜치 전략

```
main                    ← 팀 전체 통합본 (직접 push 금지)
└── exchange-student    ← 교환학생 파트 작업 브랜치 (여기서만 작업)
```

### 4.2 커밋 메시지 규칙

```
타입: 내용 (한국어 가능)

타입 종류:
  feat    새 기능 추가
  fix     버그 수정
  docs    문서 수정
  db      schema 변경
  style   코드 포맷 변경 (기능 변경 없음)
  refactor 리팩토링
  test    테스트 추가/수정
  chore   기타 (설정 파일 등)
```

**예시:**
```
feat: 패키지 추천 목록 조회 기능 추가
fix: 셀러 점수 계산 로직 보유율 0 나누기 오류 수정
docs: 자동 매칭 API 명세 업데이트
db: package_listings cert_id 컬럼 추가
refactor: 패키지 Fallback 로직 함수로 분리
```

### 4.3 커밋 단위

```
✅ 기능 하나 완성 시 커밋
✅ 파일 3개 이상 변경 시 커밋
✅ 퇴근/자리 비우기 전 커밋

❌ "일단 저장" 용도 커밋 지양
❌ 여러 기능을 한 번에 커밋 지양
```

### 4.4 PR 규칙

```
PR 제목: [교환학생] 기능명 구현 완료
예시: [교환학생] 패키지 추천 기능 구현 완료

PR 설명 템플릿:
  ## 변경 사항
  - 패키지 추천 목록 조회 구현
  - Fallback 로직 (3순위) 구현
  - 점수 계산 (보유율 70% + 세탁인증 30%) 구현

  ## 테스트 확인
  - [ ] 본인 Supabase에서 동작 확인
  - [ ] 에러 케이스 확인
  - [ ] 관련 문서 업데이트 완료

  ## 관련 문서
  - exchange_student_recommendation.md
  - exchange_student_api_spec.md
```

---

## 5. 폴더 구조

### 5.1 전체 구조

```
src/
├── app/                          ← Next.js App Router
│   ├── globals.css               ← Tailwind CSS 진입점 (@import "tailwindcss")
│   ├── (auth)/                   ← 인증 관련 (로그인 등)
│   │   └── login/
│   │       └── page.tsx
│   ├── (exchange)/               ← 교환학생 전용 기능
│   │   ├── packages/
│   │   │   ├── page.tsx          ← 패키지 추천 목록
│   │   │   └── [id]/
│   │   │       └── page.tsx      ← 패키지 상세
│   │   ├── sell/
│   │   │   ├── template/page.tsx ← 템플릿 선택
│   │   │   ├── register/page.tsx ← 보유 물품 체크
│   │   │   └── hygiene/page.tsx  ← 세탁 인증
│   │   ├── chat/
│   │   │   ├── page.tsx          ← 채팅 목록
│   │   │   └── [id]/page.tsx     ← 채팅방
│   │   ├── wishlist/
│   │   │   └── page.tsx          ← 알림 신청 목록
│   │   └── mypage/
│   │       └── page.tsx          ← 마이페이지
│   ├── api/                      ← Edge Function (API Routes)
│   │   ├── matches/
│   │   │   ├── complete/route.ts ← 거래 완료 ✅ 구현됨
│   │   │   └── auto/route.ts     ← 자동 매칭 (자산순환 파트 협의 필요 — 미구현)
│   │   └── chat/
│   │       └── send/route.ts     ← 번역 채팅
│   ├── layout.tsx
│   └── page.tsx                  ← 메인 대시보드
│
├── components/                   ← (Phase 1: 미사용 — 인라인 방식으로 대체)
│   │                               Phase 1은 페이지 파일 내부에 서브 컴포넌트 직접 정의
│   │                               (BuyerView, SellerView, SupplementSection 등)
│   │                               리팩토링 단계에서 분리 예정
│   ├── exchange/                 ← 미구현 (PackageCard, SellerCard 등)
│   └── chat/                     ← 미구현 (ChatBubble, ChatInput 등)
│
├── lib/                          ← 유틸리티 / 설정
│   ├── supabase/
│   │   ├── client.ts             ← Supabase 클라이언트 (브라우저)
│   │   ├── server.ts             ← Supabase 클라이언트 (서버)
│   │   └── middleware.ts         ← 인증 미들웨어
│   ├── deepl/
│   │   └── translate.ts          ← DeepL API 래퍼
│   └── utils/
│       ├── score.ts              ← 점수 계산 로직
│       ├── fallback.ts           ← Fallback 로직
│       └── format.ts             ← 날짜/가격 포맷
│
├── hooks/                        ← Custom Hooks
│   ├── useExchangeProfile.ts     ← 교환학생 프로필
│   ├── usePackages.ts            ← 패키지 관련
│   ├── useMatches.ts             ← 매칭 관련
│   └── useChat.ts                ← 채팅 관련
│
├── types/                        ← TypeScript 타입 정의
│   ├── exchange.ts               ← 교환학생 관련 타입
│   ├── package.ts                ← 패키지 관련 타입
│   ├── match.ts                  ← 매칭 관련 타입
│   └── supabase.ts               ← DB 타입 (자동 생성)
│
└── constants/                    ← 상수
    ├── regions.ts                ← 지역 그룹 상수
    └── packages.ts               ← 패키지 템플릿 상수
```

### 5.2 인라인 컴포넌트 방식 (Phase 1 결정)

> Phase 1은 기능 동작 확인이 목적이므로 `components/` 디렉토리를 사용하지 않는다.
> 대신 페이지 파일 내에 서브 컴포넌트를 직접 정의한다.

```typescript
// ✅ Phase 1 방식 — 페이지 파일 내 인라인 정의
// src/app/(exchange)/packages/[id]/page.tsx

function BuyerView({ ... }: BuyerViewProps) { ... }
function SellerView({ ... }: SellerViewProps) { ... }
function SupplementSection({ ... }: SupplementSectionProps) { ... }

export default function PackageDetailPage() {
  // BuyerView / SellerView 분기 호출
}
```

```typescript
// ❌ Phase 1에서 하지 않는 방식 — 별도 컴포넌트 파일 분리
// import { PackageCard } from '@/components/exchange/PackageCard'
```

### 5.3 파일 명명 규칙

```
컴포넌트: PascalCase       → PackageCard.tsx
페이지:   page.tsx          → app/packages/page.tsx
훅:       camelCase        → usePackages.ts
유틸:     camelCase        → score.ts
타입:     camelCase        → exchange.ts
상수:     camelCase        → regions.ts
```

---

## 6. 코드 컨벤션

### 6.1 TypeScript 타입 정의

```typescript
// types/exchange.ts

export type HousingType = 'dorm' | 'flat';
export type ExchangeRole = 'incoming' | 'outgoing';
export type MatchStatus = 'pending' | 'matched' | 'completed' | 'cancelled';
export type CertStatus = 'pending' | 'approved' | 'rejected';
export type LanguagePref = 'ko' | 'en';

export interface ExchangeStudent {
  uid: string;
  country_id: number | null;
  region_group: string | null;
  housing_type: HousingType | null;
  semester: string | null;
  language_pref: LanguagePref;
  role: ExchangeRole | null;
  onboarding_completed: boolean;
}

export interface PackageMatch {
  match_id: number;
  package_id: number;
  buyer_uid: string;
  seller_uid: string;
  status: MatchStatus;
  semester: string | null;
  created_at: string;
  updated_at: string;
}
```

### 6.2 Supabase 쿼리 패턴

```typescript
// ✅ 좋은 예 — 에러 처리 포함
const { data, error } = await supabase
  .from('exchange_students')
  .select('*')
  .eq('uid', user.id)
  .single();

if (error) {
  console.error('exchange_students 조회 실패:', error);
  return { error: { code: 'NOT_FOUND', message: '프로필을 찾을 수 없어요' } };
}

// ❌ 나쁜 예 — 에러 처리 없음
const { data } = await supabase
  .from('exchange_students')
  .select('*')
  .eq('uid', user.id)
  .single();
```

### 6.3 에러 처리 통일

```typescript
// lib/utils/error.ts

export const handleSupabaseError = (error: unknown, context: string) => {
  console.error(`[${context}] 오류:`, error);
  return {
    data: null,
    error: {
      code: 'INTERNAL_ERROR',
      message: '오류가 발생했어요. 다시 시도해주세요'
    }
  };
};
```

### 6.4 프로필 없음 처리 패턴

> ⚠️ 온보딩은 Phase 1 제외 확정. `onboarding_completed` 체크 및 `/onboarding` 리다이렉트 없음.
> 프로필 없는 경우(PGRST116) → `null` 반환 → 홈 페이지에서 DB 삽입 안내 표시.

```typescript
// hooks/useExchangeProfile.ts — 현재 구현
// 프로필 없음: null 반환 (에러 throw 안 함)
// 미로그인:    /login 리다이렉트
// 그 외 오류:  에러 메시지 표시
```

### 6.5 점수 계산 로직

```typescript
// lib/utils/score.ts

export const calculateSellerScore = (
  ownedCount: number,
  totalCount: number,
  certifiedCount: number,
  hygieneRequiredCount: number
): number => {
  const ownershipRate = totalCount > 0 ? ownedCount / totalCount : 0;
  const certRate = hygieneRequiredCount > 0
    ? certifiedCount / hygieneRequiredCount
    : 1.0;  // 세탁 인증 필요 물품 없으면 만점

  return ownershipRate * 0.7 + certRate * 0.3;
};
```

### 6.6 Fallback 로직

```typescript
// lib/utils/fallback.ts

export const getPackageWithFallback = async (
  supabase: SupabaseClient,
  countryCode: string,
  regionGroup: string,
  housingType: HousingType
) => {
  // 1순위
  let { data } = await supabase
    .from('essential_packages')
    .select('*')
    .eq('country_code', countryCode)
    .or(`housing_type.eq.${housingType},housing_type.is.null`)
    .limit(1)
    .single();

  if (data) return { data, tier: 1, label: null };

  // 2순위
  ({ data } = await supabase
    .from('essential_packages')
    .select('*')
    .eq('region_group', regionGroup)
    .or(`housing_type.eq.${housingType},housing_type.is.null`)
    .limit(1)
    .single());

  if (data) return { data, tier: 2, label: `${regionGroup} 지역 기준` };

  // 3순위
  ({ data } = await supabase
    .from('essential_packages')
    .select('*')
    .is('region_group', null)
    .is('housing_type', null)
    .limit(1)
    .single());

  if (data) return { data, tier: 3, label: '전체 범용 패키지' };

  return { data: null, tier: 0, label: null };
};
```

---

## 7. Supabase 사용 가이드

### 7.0 DB 타입 정의

> schema.sql 파일이 없으므로 `src/types/supabase.ts`에 수동으로 DB 타입을 정의.
> 향후 Supabase CLI(`supabase gen types typescript`)로 자동 생성 가능.

```typescript
// types/supabase.ts — Database 인터페이스에 모든 테이블 Row/Insert/Update 타입 정의
// 모든 Supabase 클라이언트는 이 타입을 제네릭으로 사용

createBrowserClient<Database>(url, key)
createServerClient<Database>(url, key, { cookies })
```

### 7.1 클라이언트 초기화

> ⚠️ **Next.js 15 주의**: `cookies()`가 async로 변경됨 → `await cookies()` 필수

```typescript
// lib/supabase/client.ts (브라우저용)
import { createBrowserClient } from '@supabase/ssr';
import { type Database } from '@/types/supabase';

export const createClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

// lib/supabase/server.ts (서버 컴포넌트용) — Next.js 15 async cookies()
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { type Database } from '@/types/supabase';

export const createServerSupabaseClient = async () => {
  const cookieStore = await cookies();  // ← await 필수 (Next.js 15)
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {} // Server Component에서 set 호출 시 무시
        },
      },
    }
  );
};
```

### 7.2 환경변수 설정

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
DEEPL_API_KEY=your-deepl-key
```

> ⚠️ `.env.local` 은 절대 Git에 올리지 않는다.
> `.gitignore` 에 포함되어 있는지 반드시 확인.

### 7.3 RLS 개발 시 주의사항

```
- 항상 RLS가 활성화된 상태로 개발한다
- service_role 키는 Edge Function에서만 사용
- anon_key로 접근 안 되면 RLS 정책 확인
- 데이터가 안 보이면 먼저 RLS 확인 후 코드 확인
```

### 7.4 Realtime 구독 패턴

```typescript
// 패키지 매칭 상태 실시간 구독
useEffect(() => {
  const channel = supabase
    .channel('package-matches')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'package_matches',
        filter: `buyer_uid=eq.${user.id}`
      },
      (payload) => {
        // 매칭 상태 변경 시 UI 업데이트
        console.log('매칭 상태 변경:', payload.new);
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [user.id]);
```

### 7.5 Storage 업로드 패턴

```typescript
// 세탁 인증 사진 업로드
const uploadHygieneCert = async (file: File, categoryId: number) => {
  // 파일 형식 체크
  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    return { error: { code: 'INVALID_FILE', message: 'JPG, PNG 파일만 업로드 가능해요' } };
  }

  // 파일 크기 체크 (10MB)
  if (file.size > 10 * 1024 * 1024) {
    return { error: { code: 'FILE_TOO_LARGE', message: '파일 크기가 너무 커요. 10MB 이하로 업로드해주세요' } };
  }

  const filePath = `${user.id}/${categoryId}/${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('hygiene-certs')
    .upload(filePath, file, { contentType: file.type });

  if (uploadError) {
    return { error: { code: 'UPLOAD_FAILED', message: '업로드에 실패했어요. 다시 시도해주세요' } };
  }

  const { data: { publicUrl } } = supabase.storage
    .from('hygiene-certs')
    .getPublicUrl(filePath);

  return { data: { publicUrl }, error: null };
};
```

### 7.6 거래 완료 API 패턴 (Edge Function)

> `POST /api/matches/complete` — 셀러만 호출 가능

```typescript
// chat/[id]/page.tsx — 거래 완료 버튼 클릭 시
const res = await fetch('/api/matches/complete', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ match_id: roomInfo.match_id }),
})
const result = await res.json()
// result.data.cancelled_count: 자동 취소된 다른 바이어 수
```

**처리 흐름:**
1. 인증 확인 (auth.getUser)
2. match 조회 → seller_uid = auth.uid() 검증
3. status = 'matched' 검증 (pending 상태에서는 완료 불가)
4. 해당 match → status = 'completed'
5. 같은 seller_uid + package_id의 나머지 pending/matched → status = 'cancelled'

**에러 케이스:**

| 상황 | 코드 | HTTP |
|------|------|------|
| 미로그인 | `NOT_AUTHENTICATED` | 401 |
| match 없음 | `NOT_FOUND` | 404 |
| 셀러 아님 | `FORBIDDEN` | 403 |
| matched 아닌 상태 | `INVALID_STATUS` | 400 |

---

## 8. 테스트 데이터 세팅

### 8.0 개발 중 인증 우회

> ⚠️ Phase 1은 인증 없이 모든 페이지에 자유 접근 가능하도록 미들웨어 비활성화 상태로 개발.
> 실제 인증 테스트가 필요할 때만 `src/middleware.ts`에서 주석 해제.

```typescript
// src/middleware.ts
export async function middleware(request: NextRequest) {
  // 개발 중: 아래 줄 주석 처리 → 인증 체크 없이 전체 접근 가능
  // return updateSession(request)
  return NextResponse.next()
}
```

### 8.1 개발 시작 전 필수 seed 데이터

> 온보딩 없음 — Supabase 대시보드에서 직접 삽입 (onboarding_completed = TRUE 필수)

```sql
-- 1. 테스트용 교환학생 프로필 생성 (Incoming — 바이어)
INSERT INTO exchange_students (
  uid, country_id, region_group, housing_type,
  semester, language_pref, role, onboarding_completed
) VALUES (
  '본인-auth-uid',  -- Supabase Auth에서 확인
  3,               -- countries에서 E3(독일어권) country_id 확인
  'E3',
  'dorm',
  '2026-1',
  'en',
  'incoming',
  TRUE
);

-- 2. 테스트용 교환학생 프로필 (Outgoing — 셀러)
INSERT INTO exchange_students (
  uid, country_id, region_group, housing_type,
  semester, language_pref, role, onboarding_completed
) VALUES (
  '다른-test-uid',
  3,
  'E3',
  'dorm',
  '2026-1',
  'ko',
  'outgoing',
  TRUE
);

-- 3. 테스트용 패키지 매칭 생성
INSERT INTO package_matches (
  package_id, buyer_uid, seller_uid, status, semester
) VALUES (
  1,                -- DORM_BASIC package_id
  '본인-auth-uid',
  '다른-test-uid',
  'pending',
  '2026-1'
);
```

### 8.2 세탁 인증 테스트

```sql
-- 승인 상태 직접 변경 (관리자 UI 없을 때)
UPDATE hygiene_certifications
SET status = 'approved', reviewed_at = NOW()
WHERE cert_id = 1;

-- 반려 상태 직접 변경
UPDATE hygiene_certifications
SET status = 'rejected', reviewed_at = NOW()
WHERE cert_id = 2;
```

### 8.4 점수 계산 테스트용 데이터

```sql
-- 셀러 A: 보유율 높음 + 세탁인증 완료 (점수 높아야 함)
INSERT INTO package_listings (match_id, seller_uid, category_id, status, semester)
VALUES
  (1, '다른-test-uid', 10, 'selling', '2026-1'),  -- 이불
  (1, '다른-test-uid', 11, 'selling', '2026-1'),  -- 베개
  (1, '다른-test-uid', 12, 'selling', '2026-1'),  -- 토퍼
  (1, '다른-test-uid', 15, 'selling', '2026-1');  -- 전기밥솥
```

---

## 9. Phase 1 + Phase 2 구현 현황 (2026-05-07 기준)

### 9.0 완료된 파일 목록

| 분류 | 파일 | 설명 |
|------|------|------|
| 환경 | `postcss.config.mjs` | Tailwind v4 PostCSS |
| 환경 | `src/middleware.ts` | 인증 미들웨어 (개발 중 비활성화) |
| Supabase | `src/lib/supabase/client.ts` | 브라우저 클라이언트 |
| Supabase | `src/lib/supabase/server.ts` | 서버 클라이언트 |
| Supabase | `src/lib/supabase/middleware.ts` | 세션 갱신 |
| 타입 | `src/types/supabase.ts` | DB 13개 테이블 타입 |
| 타입 | `src/types/exchange.ts` / `package.ts` / `match.ts` | 도메인 타입 |
| 유틸 | `src/lib/utils/score.ts` | 셀러 점수 계산 |
| 유틸 | `src/lib/utils/fallback.ts` | 3단계 Fallback |
| 유틸 | `src/lib/utils/format.ts` | 날짜/가격 포맷 |
| 라이브러리 | `src/lib/deepl/translate.ts` | DeepL API 래퍼 |
| 훅 | `src/hooks/useExchangeProfile.ts` | 프로필 조회 (리다이렉트 없음) |
| 페이지 | `src/app/page.tsx` | 홈 대시보드 (셀러 메뉴에 세탁 인증 관리 링크 포함) |
| 페이지 | `src/app/(auth)/login/page.tsx` | 로그인 |
| 페이지 | `src/app/(exchange)/packages/page.tsx` | 패키지 추천 목록 |
| 페이지 | `src/app/(exchange)/packages/[id]/page.tsx` | 패키지 상세 |
| 페이지 | `src/app/(exchange)/sell/template/page.tsx` | 템플릿 선택 + SellStepHeader(1/3) |
| 페이지 | `src/app/(exchange)/sell/register/page.tsx` | 보유 물품 체크 + SellStepHeader(2/3), packageId별 mock, 판매 학기 라벨 |
| 페이지 | `src/app/(exchange)/sell/hygiene/page.tsx` | 세탁 인증 + SellStepHeader(3/3), 완료 시 게시 CTA |
| 페이지 | `src/app/(exchange)/chat/page.tsx` | 채팅 목록 (mock: room1=바이어/Emma, room2=셀러/Lucas) |
| 페이지 | `src/app/(exchange)/chat/[id]/page.tsx` | 채팅방 (Realtime + 번역, 미로그인 mock 포함) |
| 페이지 | `src/app/(exchange)/wishlist/page.tsx` | 알림 신청 목록 |
| 페이지 | `src/app/(exchange)/mypage/page.tsx` | 마이페이지 (역할 전환 포함: incoming↔outgoing) |
| API | `src/app/api/chat/send/route.ts` | 번역 채팅 전송 |
| API | `src/app/api/matches/complete/route.ts` | 거래 완료 처리 |
| API | `src/app/api/matches/auto/route.ts` | **[Phase 2]** 자동 매칭 (운영 시 cron 연동 필요) |

### 9.1 개발 미리보기 mock 현황

미로그인(`!userId`) 시 전 페이지에서 mock 데이터 표시. `userId` 있으면 무조건 실데이터로 전환 — 합칠 때 충돌 없음.

### 9.1.1 셀 플로우 UX

세 페이지가 `SellStepHeader` 컴포넌트로 연결되어 하나의 등록 플로우로 표시됨.

```
홈 → 패키지 등록하기
  Step 1: /sell/template  — 템플릿 3종 선택
  Step 2: /sell/register  — 물품 체크 (세탁 인증 필요 시 Step 3으로 안내)
  Step 3: /sell/hygiene   — 세탁 인증 (완료 시 Step 2로 돌아가 게시)
```

| 페이지 | mock 내용 |
|--------|-----------|
| `/sell/template` | 3개 템플릿 (기숙사 기본 9개 / 자취 풀 15개 / 고려대 기숙사 12개) |
| `/sell/register` | packageId별 다른 물품: 1→9개, 2→15개, 3→12개 |
| `/sell/hygiene` | 이불(approved), 베개(pending), 토퍼(없음) |
| `/chat` | room1=바이어/Emma(pending), room2=셀러/Lucas(matched) |
| `/chat/1` | 바이어 뷰, 메시지 없음 |
| `/chat/2` | 셀러 뷰, 대화 3개, 번역 ON/OFF, 거래완료 버튼 |
| `/wishlist` | 청소기(대기중), 빨래건조대(알림발송됨) |
| `/mypage` | outgoing/독일어권/dorm/2026-1 |

### 9.1.2 패키지 목록 — 셀러 카드 기능

**저장(북마크):**
- 셀러 카드 우측 상단 ♡ 버튼으로 저장/해제 토글
- DB 테이블 없음 — `localStorage['saved-sellers']` (JSON 배열, match_id 기준)
- 저장한 카드는 목록 최상단에 표시

**채팅 진입 분기:**

- 미요청 셀러: "상세 보기" → `/packages/[id]` → "거래 요청하기" → 채팅방 생성
- 이미 요청한 셀러(`already_requested: true`): 목록에서 바로 "채팅 이어가기 →" → `/chat/[room_id]`
  → `SellerWithScore`에 `room_id: number | null` 필드 추가, 목록 조회 시 함께 조회

### 9.1.3 알림 신청(Wishlist) 흐름

패키지 상세(`/packages/[id]`) → 미보유 물품 → 일반 매물 없음 → "알림 신청하기" 버튼 → `exchange_wishlists` INSERT → `/wishlist` 에서 확인.

**INSERT 필수 필드:** `uid`, `category_id`, `region_group`, `semester` — 모두 NOT NULL
→ `region_group`, `semester`는 바이어 프로필(`exchange_students`)에서 가져와 `SupplementSection`에 props로 전달.

**알려진 수정 사항 (2026-05-07):**
- `wishlist_id` → `exchange_wishlist_id` (컬럼명 오타 수정)
- INSERT 시 `region_group`, `semester` 추가

### 9.1.3 자동 매칭 API (Phase 2)

`POST /api/matches/auto` — 운영 시 cron(자산순환 파트)이 호출, 테스트 시 직접 POST 가능.

**매칭 로직:**
```
1. package_listings(status=selling) 셀러 조회 (role=outgoing 필터)
2. exchange_wishlists(is_notified=false) 바이어 조회 (role=incoming 필터)
3. region_group + semester + category_id 3중 매칭
4. 이미 pending/matched인 조합 스킵
5. package_matches INSERT
6. 매칭된 바이어의 wishlist is_notified=true 업데이트
```

**Request Body:**
```json
{ "semester": "2026-1" }   // 생략 시 모든 학기 처리
```

**Response:**
```json
{ "data": { "matched": 3, "skipped": 1 }, "error": null }
```

### 9.2 미구현 항목

| 파일 | 이유 |
|------|------|
| `src/hooks/usePackages.ts` 등 훅 3개 | 인라인 방식으로 대체 — 불필요 |
| `src/constants/regions.ts` 등 상수 2개 | 미사용 |
| `src/components/` 12개 | 인라인 방식으로 대체 — 불필요 |

### 9.3 채팅 진입 경로 및 생성 흐름

채팅방은 DB 트리거가 아닌 **앱 레벨**(`packages/[id]/page.tsx` tradeMutation)에서 생성된다.

```
바이어: 패키지 상세 → "거래 요청하기" 클릭
  ① package_matches INSERT (status = 'pending', buyer_uid, seller_uid, package_id)
  ② chat_rooms INSERT (package_match_id)
  ③ chat_participants INSERT × 2 (바이어 + 셀러)
  → 채팅 목록(/chat)에 'pending' 상태로 표시

첫 메시지 전송 시 (/api/chat/send)
  ④ chat_messages INSERT (original_text + translated_text)
  ⑤ package_matches status: 'pending' → 'matched' 자동 전환

셀러 "거래 완료" (/api/matches/complete)
  ⑥ 해당 match: 'completed'
  ⑦ 같은 셀러+패키지의 다른 match: 'cancelled' 일괄 처리
```

### 9.4 역할 전환 설계

한 유저가 셀러(outgoing)와 바이어(incoming) 역할을 유동적으로 전환할 수 있어야 함.
→ `exchange_students.role` 필드를 mypage에서 직접 변경 가능하도록 편집 폼에 추가.
→ 홈 대시보드는 현재 role 값을 읽어 메뉴를 자동 분기하므로 별도 변경 불필요.

**테스트 계정 1개로 전체 플로우 확인 가능:**
```
1. role = 'outgoing' → 패키지 등록 → 게시
2. mypage에서 role = 'incoming'으로 전환
3. 패키지 추천에서 본인 패키지 확인 → 거래 요청
4. 채팅 진행 → 거래 완료
```

### 9.5 알려진 이슈

| 항목 | 내용 |
|------|------|
| `buyer_uid = seller_uid` | 셀러 초기 패키지 등록 시 임시 처리 — DB `chk_package_matches_no_self` 제약 실 테스트 필요 |
| `DEEPL_API_KEY` | `.env.local`에 미설정 시 번역 없이 원문만 저장 (정상 동작) |
| 미들웨어 | 실제 인증 테스트 시 `src/middleware.ts`에서 `updateSession(request)` 주석 해제 필요 |
| ~~`chat/[id]` 개발 미리보기 없음~~ | 해결 완료 (MOCK_ROOMS + MOCK_MESSAGES 추가, room_id=1→pending/Emma, room_id=2→matched/Lucas) |
| ~~`sell/hygiene` 진입점 누락~~ | 해결 완료 (홈 셀러 메뉴에 "세탁 인증 관리" 링크 추가) |
| ~~`sell/hygiene` 개발 미리보기 없음~~ | 해결 완료 (MOCK_HYGIENE_ITEMS + MOCK_CERTS 추가) |

---

## 10. 개발 체크리스트

### 10.1 기능 개발 시작 전 체크리스트

```
□ 관련 문서 읽었나요? (feature_spec, api_spec)
□ 구현할 API가 api_spec에 정의되어 있나요?
□ Schema 변경이 필요한가요?
  □ 필요하다면 팀 카톡에 공유했나요?
  □ 팀원 확인 받았나요?
□ 테스트 데이터가 Supabase에 있나요?
```

### 10.2 기능 개발 완료 후 체크리스트

```
□ 본인 Supabase에서 동작 확인했나요?
□ 에러 케이스 테스트했나요?
  □ 프로필 없는 상태 (DB 미삽입)
  □ 데이터 없는 상태 (빈 목록)
  □ 네트워크 오류 상태
□ RLS 정책이 제대로 동작하나요?
  □ 다른 사용자 데이터 접근 차단 확인
□ TypeScript 타입 에러 없나요?
□ 관련 문서 업데이트했나요?
□ 커밋 메시지 컨벤션 맞나요?
□ 팀 카톡에 완료 공유했나요?
```

### 10.3 Schema 변경 체크리스트

```
□ 변경 내용 카톡에 공유했나요?
□ 영향 받는 팀원 확인 받았나요?
□ 본인 Supabase에서 테스트했나요?
□ 공용 Supabase에 반영했나요?
□ schema.sql 마스터 파일 업데이트했나요?
□ 팀 카톡에 "schema.sql 업데이트했어요" 공유했나요?
```

### 10.4 PR 올리기 전 체크리스트

```
□ exchange-student 브랜치에서 작업했나요?
□ main 브랜치에 직접 push하지 않았나요?
□ 커밋 메시지 컨벤션 맞나요?
□ PR 설명 템플릿 채웠나요?
□ 관련 문서 링크 달았나요?
□ 배포는 절대 하지 않는다! (통합 전까지)
```
