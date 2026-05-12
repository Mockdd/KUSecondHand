# Auth 통합 계획

작성일: 2026-05-12
작업 브랜치: `feat/product-chat-handover`
관련 파일: `src/proxy.ts` → `src/middleware.ts`

---

## 1. 현황 및 문제

### 1-1. proxy.ts가 dead code인 이유

`src/proxy.ts`에 미들웨어 로직이 완성되어 있지만, Next.js는 이 파일을 인식하지 못한다.

Next.js 미들웨어는 반드시 `src/middleware.ts` 파일에 `middleware`라는 이름의 함수 export가 있어야 실행된다.

```
현재 상태
src/proxy.ts    ← export async function proxy(...)  // Next.js가 인식 못함
middleware.ts   ← 존재하지 않음

결과
- 인증 가드 전혀 작동 안 함
- 로그인 없이 /products, /recommend/*, /chat 등 모든 페이지 접근 가능
- 각 page.tsx 안의 redirect('/login') 만 가드 역할을 하고 있음
  (서버 컴포넌트 도달 후 리다이렉트 → 느리고 불완전)
```

### 1-2. proxy.ts 내부 로직 (구현 완료 상태)

| 조건 | 동작 |
|---|---|
| 미인증 + 보호 경로 | `/login` redirect |
| 인증 + 탈퇴 계정 (`deleted_at`) | `/login?reason=withdrawn` redirect |
| 인증 + 휴면 계정 (`dormant_at`) | `/reactivate` redirect |
| 인증 + `/login` 또는 `/register` 접근 | `/products` redirect (중복 로그인 방지) |
| `/api/cron/*` | 인증 없이 통과 (배치 전용) |
| `/api/*`, `/_next/*`, 정적 파일 | matcher에서 제외 (미들웨어 미실행) |

### 1-3. 공개 경로 목록 (인증 불필요)

```
/
/login
/register
/verify
/auth/callback
/forgot-password
/reset-password
/find-id
/find-id/*
/reactivate
```

---

## 2. 수정 내용 (2개 파일)

### 2-1. `src/middleware.ts` 신규 생성

proxy.ts의 함수와 config를 그대로 re-export한다.
proxy.ts를 직접 rename하지 않는 이유: git 히스토리 보존 + 팀원 코드 원형 유지.

```ts
// src/middleware.ts
export { proxy as middleware, config } from './proxy'
```

이 한 줄로 Next.js가 proxy.ts의 로직을 미들웨어로 인식한다.

### 2-2. `src/proxy.ts` — `next` 파라미터 보완

**현재 문제**: 미인증 사용자를 `/login`으로 redirect할 때 원래 접근하려던 경로가 전달되지 않는다.

```ts
// 현재 코드 (proxy.ts 84~87줄)
if (!user && !isPublicPath(pathname)) {
  const url = request.nextUrl.clone()
  url.pathname = '/login'
  return NextResponse.redirect(url)   // next 파라미터 없음
}
```

**결과**: 로그인 후 `/products`로 이동 (LoginForm의 fallback). 사용자가 `/recommend/package`를 들어오려 했어도 `/products`로 보내짐.

**수정**:

```ts
if (!user && !isPublicPath(pathname)) {
  const url = request.nextUrl.clone()
  url.pathname = '/login'
  const nextParam = pathname + (request.nextUrl.search || '')
  url.searchParams.set('next', nextParam)   // 원래 경로 보존
  return NextResponse.redirect(url)
}
```

LoginForm은 이미 `?next=` 파라미터를 읽어서 로그인 후 해당 경로로 이동하는 로직이 구현되어 있다(`sanitizeNextPath` 함수).

---

## 3. DB 의존성 확인

proxy.ts는 `users` 테이블에서 `deleted_at`, `dormant_at` 두 컬럼을 조회한다.

| 컬럼 | 위치 | 마이그레이션 |
|---|---|---|
| `deleted_at` | `schema.sql` 기본 포함 | 불필요 |
| `dormant_at` | `db/migrations/002_account_activity_dormant.sql` | **필요** |
| `last_activity_at` | `db/migrations/002_account_activity_dormant.sql` | **필요** |

### 002 미적용 시 동작

```ts
const { data } = await supabase
  .from('users')
  .select('deleted_at, dormant_at')  // dormant_at 컬럼 없으면 PostgREST 오류
  .eq('uid', user.id)
  .maybeSingle()
accountRow = data ?? null   // 오류 시 data = null → accountRow = null
```

`accountRow`가 null이면:
- `accountRow?.deleted_at` → undefined → 탈퇴 redirect 없음 ✅ (안전)
- `accountRow?.dormant_at` → undefined → 휴면 redirect 없음 ✅ (안전)

즉 **002 미적용이어도 앱은 정상 동작**하지만, 서버 콘솔에 PostgREST 에러 로그가 찍힌다.
작업 대상 DB(kusecond-test)에 002가 적용되어 있으면 문제 없음.

> HANDOVER.md §3 기준: `kusecond-test`에는 003~009까지 적용 완료 → 002도 포함된 것으로 간주.

---

## 4. 기존 page.tsx auth 코드와의 관계

현재 각 page.tsx에 있는 서버 컴포넌트 레벨 인증 코드:

```ts
// 예: src/app/(main)/recommend/package/page.tsx
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/login?next=/recommend/package')
```

미들웨어 활성화 후 이 코드는 **실행되지 않는다**. 미들웨어가 먼저 `/login`으로 redirect하기 때문에 서버 컴포넌트까지 도달하지 못한다.

→ **남겨둬도 무해**하지만 dead code가 된다. 이번 PR 범위에서는 건드리지 않는다.

---

## 5. 작업 순서

```
1. feat/product-chat-handover 브랜치 기준 작업

2. src/proxy.ts 수정
   - 미인증 redirect 블록에 next 파라미터 추가 (§2-2)

3. src/middleware.ts 신규 생성
   - export { proxy as middleware, config } from './proxy'

4. 로컬 검증 (§6)

5. 커밋
   feat(auth): proxy.ts 활성화 — middleware.ts re-export + next 파라미터 보존
```

---

## 6. 검증 방법

| 시나리오 | 기대 결과 |
|---|---|
| 로그아웃 상태 → `/products` 접근 | `/login?next=/products` redirect |
| 로그아웃 상태 → `/recommend/package` 접근 | `/login?next=/recommend/package` redirect |
| 로그아웃 상태 → `/login` 접근 | 로그인 페이지 정상 렌더 |
| 로그인 후 (next 있음) | `next` 경로로 이동 |
| 로그인 후 (next 없음) | `/products`로 이동 |
| 로그인 상태 → `/login` 접근 | `/products` redirect (중복 로그인 방지) |
| `/api/recommend/category-avg-price` 호출 | 미들웨어 미적용, 정상 응답 |
| `/api/cron/*` 접근 | 인증 없이 통과 |

---

## 7. 범위 외 (이후 별도 작업)

| 항목 | 내용 |
|---|---|
| NavBar 추천 링크 | `/recommend/package`, `/recommend/resale-price` 항목 추가 |
| 온보딩 흐름 | 신규 가입 후 프로필 미등록 시 유도 화면 |
| 휴면 배치 | `/api/cron/dormant` 스케줄링 |
| ESLint 설정 | `eslint.config.mjs` 신규 작성 |
