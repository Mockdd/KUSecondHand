# AI 명령지침 — 패키지 추천 & 재판매 가격 추천 기능

## 담당 범위

이 명세는 `ku-secondhand` 프로젝트에서 **아래 두 기능만** 다룬다.

1. **사용자 조건 기반 패키지 추천** (`/recommend/package`)
2. **재판매 가격 추천** (`/recommend/resale-price` 또는 상품 등록 흐름 내 삽입 UI)

## 핵심 행동 규칙

- 기존 `products`, `transactions`, `users`, `categories` 테이블은 **읽기 전용**으로만 사용한다. INSERT/UPDATE/DELETE 하지 않는다.
- `schema.sql`에 이미 존재하는 테이블 구조를 변경하지 않는다.
- 새 테이블이 필요하면 `proc/spec/`에 DDL 초안을 작성한 뒤 팀원과 합의 후 `schema.sql`에 반영한다.
- 상품 등록 플로우, 거래 완료 플로우, 인증 플로우는 건드리지 않는다.
- 파일 위치는 `app/(features)/recommend/` 하위에서만 작업한다.
- 공통 컴포넌트(`components/shared/`), Supabase 클라이언트(`lib/supabase/`)는 읽기만 하고 수정 전 팀원과 확인한다.
- TypeScript strict mode를 유지한다. `any` 타입 사용 금지.
- 서버 컴포넌트(RSC)와 클라이언트 컴포넌트('use client')를 명확히 분리한다.
- Supabase RLS가 이미 설정된 테이블은 별도 필터 없이 RLS를 신뢰한다.

## 배포/테스트 정책

- 실제 코드 수정 전 반드시 `proc/spec/`의 명세를 확인한다.
- `proc/plan/`의 작업 항목 체크리스트를 기준으로 진행 상황을 추적한다.
- 변경 파일은 담당 범위(`app/(features)/recommend/`) 내로 제한한다.
