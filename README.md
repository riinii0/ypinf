# 청년 지원금 맞춤 찾기

나이·지역·본인 연소득·현재 상태 4개만 입력하면, 중앙부처·서울시·서울 동작구의 청년 지원 정책을 예상 수령액 합계·금액순·마감 D-day와 함께 보여 주는 웹 서비스다.

## 주요 기능
- **맞춤 찾기 (`/`, `/find`, `/result`, `/policy/[id]`)**: 회원가입 없이 4개 정보 입력 → 3단계 판정(해당됨·확인 필요·해당 없음) → 공식 신청 페이지 연결
- **정책 둘러보기 (`/browse`)**: 분야별(주거·일자리·교육·금융·복지)·지역별(중앙부처·서울시·동작구) 필터, 검색, 정렬
- **마감 일정 (`/calendar`)**: D-7 마감 임박, 월별 캘린더, 최근 14일 신규 정책, 상시 모집
- **내 지원금 (`/my`)**: 이메일 매직링크 로그인 후 프로필 저장, 관심 정책·마감 알림, 신청·수령 기록
- **관리자 지표 (`/admin/stats`)**: 진단 횟수, 입력 완료율, 입력 소요 시간, 신청 클릭률, 피드백 집계 및 CSV 내려받기

## 실행 방법

```bash
# 1. 패키지 설치
npm install

# 2. 환경변수 파일 생성 (.env.example 복사 후 Supabase 정보 입력)
copy .env.example .env

# 3. DB 마이그레이션 및 시드 정책(15건) 적재
npx prisma migrate dev
npm run db:seed

# 4. 목업 외부 API 동기화 테스트 (선택)
npm run sync

# 5. 개발 서버 실행
npm run dev
```

## 환경변수

| 변수명 | 용도 | 비고 |
|---|---|---|
| `DATABASE_URL` | Supabase PostgreSQL 연결 (Pooler) | 서버 전용 |
| `DIRECT_URL` | Supabase PostgreSQL 직접 연결 (마이그레이션용) | 서버 전용 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | 공개 가능 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon 키 | 공개 가능 |
| `DATA_SOURCE_MODE` | `mock` 또는 `live` | 기본 `mock` |
| `YOUTHCENTER_API_KEY` | 온통청년 청년정책 API 키 | 서버 전용, 승인 후 입력 |
| `LOCAL_WELFARE_API_KEY` | 공공데이터포털 지자체복지서비스 API 키 | 서버 전용, 승인 후 입력 |
| `SYNC_SECRET` | `/api/admin/sync`, `/api/admin/stats` 보호 키 | 서버 전용 |
| `CRON_SECRET` | Vercel Cron 자동 동기화 보호 키 | 서버 전용 |
| `ALLOW_DRAFT_RULES` | 개발 환경에서 DRAFT 규칙 판정 허용 여부 | 운영은 반드시 `false` |
| `DEMO_TODAY` | 시연용 기준 날짜 고정 (`YYYY-MM-DD`) | 비워 두면 오늘(KST) |

## 데이터 출처
1. 한국고용정보원 온통청년 청년정책 API (`src/lib/sources/youthcenter.ts` — 키 승인 후 `docs/API_TODO.md` 절차로 연결)
2. 한국사회보장정보원 지자체복지서비스 API (`src/lib/sources/localWelfare.ts` — 키 승인 후 연결)
3. 중앙부처·서울시·동작구 대표 정책 15건 수기 검수 시드 (`data/seed/policies.csv`)

## 면책 문구
공공데이터 기반 예상치이며, 최종 자격은 기관 공고에서 확인하세요.
