# 2026-06-07 수정 계획 및 업데이트

## 개요
오늘 수정 대상 이슈 2건을 정리하고 원인 및 해결 방향을 기록한다.

## 완료 현황

| 이슈 | 상태 | 완료일 |
|------|------|--------|
| 패키지/시세 추천탭 제거 | ✅ 완료 | 2026-06-07 |
| 이미지 업로드 버킷 생성 | ✅ 완료 | 2026-06-07 |

### 추가 수정 사항 (2026-06-07)
- `next.config.ts` — `placehold.co` 이미지 호스트 허용 추가 (시드 데이터 테스트 이미지)
- `next.config.ts` — `dangerouslyAllowSVG: true` 추가 (placehold.co SVG 응답 허용)
- `avatars` 버킷 — 나중에 생성 예정 (프로필 사진 기능 사용 시)

---

## 이슈 1 — 패키지 추천탭 / 시세 추천탭 제거

### 현상
- 메인 화면 및 상단 네비게이션 바에서 **패키지 추천**(`/recommend/package`), **시세 추천**(`/recommend/resale-price`) 탭이 여전히 접속 가능함.

### 원인 (관련 파일)

| 파일 | 위치 | 내용 |
|------|------|------|
| `src/components/layout/NavBar.tsx` | L10–11 | NAV_ITEMS 배열에 `'패키지 추천'` → `/recommend/package`, `'시세 추천'` → `/recommend/resale-price` 항목 존재 |
| `src/components/home/QuickActionGrid.tsx` | L48–62 | 메인 홈 퀵액션 버튼에 두 탭 링크 존재 |
| `src/components/home/RecommendBanner.tsx` | L28–63 | 메인 홈 배너 섹션에 두 탭 링크 존재 |
| `src/app/(main)/recommend/package/page.tsx` | — | 패키지 추천 페이지 자체 존재 |
| `src/app/(main)/recommend/resale-price/page.tsx` | — | 시세 추천 페이지 자체 존재 |

### 해결 방향
1. **NavBar.tsx** — NAV_ITEMS에서 `패키지 추천`, `시세 추천` 항목 제거
2. **QuickActionGrid.tsx** — 해당 버튼 항목 제거
3. **RecommendBanner.tsx** — 해당 배너 항목 제거 (또는 컴포넌트 전체 제거)
4. **페이지 파일** — `/recommend/package`, `/recommend/resale-price` 라우트 폴더 삭제 또는 리다이렉트 처리 (직접 URL 접근 차단)

> 페이지 파일을 남기고 싶다면 `not-found` 리다이렉트로 처리 가능.

### ✅ 완료 내용
- `NavBar.tsx` L10–11 — 두 항목 제거
- `QuickActionGrid.tsx` — 두 버튼 항목 및 미사용 아이콘 함수(`GiftIcon`, `TrendingUpIcon`) 제거
- `RecommendBanner.tsx` — 두 배너 카드 제거

---

## 이슈 2 — 상품 이미지 업로드 실패 (Bucket not found)

### 현상
- 판매 탭에서 상품 등록 시 이미지 업로드 시 `Bucket not found` 오류 발생.

### 원인 (관련 파일)

| 파일 | 위치 | 내용 |
|------|------|------|
| `src/app/(main)/products/new/page.tsx` | L94–96 | `supabase.storage.from('products').upload(...)` 호출 |
| `src/components/profile/ProfileForm.tsx` | L161 | `supabase.storage.from('avatars').upload(...)` 호출 |

- 코드에서 사용하는 스토리지 버킷: **`products`**, **`avatars`**
- **Supabase 프로젝트 대시보드에 해당 버킷이 생성되어 있지 않아서** 발생하는 오류.
- 코드 자체 문제는 아니고 **인프라(Supabase Storage) 설정 누락** 문제.

### 해결 방향
Supabase 대시보드 > Storage에서 아래 버킷을 직접 생성해야 한다.

| 버킷 이름 | 공개 여부 | 용도 |
|-----------|-----------|------|
| `products` | Public | 상품 이미지 |
| `avatars` | Public | 프로필 아바타 |

**생성 절차:**
1. Supabase 대시보드 → Storage → New Bucket
2. 버킷 이름 입력 (`products` / `avatars`)
3. Public bucket 체크 (이미지 공개 URL 사용 중이므로 필수)
4. Save

> 버킷 생성 후 RLS 정책도 확인 필요 (업로드는 인증된 사용자만, 조회는 공개 등).
> `schema.sql` 또는 마이그레이션 파일에 스토리지 정책이 정의되어 있는지 확인 권장.

### ✅ 완료 내용
- `products` 버킷 생성 완료 (Public, MIME types 제한: `image/jpeg, image/png, image/webp, image/gif`)
- `avatars` 버킷 — 나중에 생성 예정 (프로필 사진 기능 사용 시)
- 파일 크기 제한은 코드 레벨에서 10MB로 이미 처리됨 (`products/new/page.tsx`)

---

## 작업 우선순위

| 순위 | 이슈 | 작업 유형 |
|------|------|-----------|
| 1 | 패키지/시세 추천탭 제거 | 코드 수정 (NavBar, QuickActionGrid, RecommendBanner, 라우트 삭제) |
| 2 | 이미지 업로드 버킷 생성 | Supabase 대시보드 설정 |

---

## 기타 메모
- 로컬 개발 서버: `npm run dev` (포트 3000)
- `.env` 파일 설정 필요 (`.env.example` 참고)
- 이미지 버킷 이슈는 로컬에서도 동일하게 재현됨 (Supabase 프로젝트 공유)
