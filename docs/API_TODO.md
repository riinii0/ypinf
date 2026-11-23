# 외부 공공데이터 API 승인 후 할 일

실제 API 연동을 위해 수정해야 할 파일은 **2개**뿐이다.
- `src/lib/sources/youthcenter.ts` (온통청년 청년정책 API)
- `src/lib/sources/localWelfare.ts` (공공데이터포털 지자체복지서비스 API)

## 진행 순서

| 순서 | 할 일 | 확인 항목 |
|---|---|---|
| 1 | 공식 API 명세 확보 | 엔드포인트 URL, HTTP 메서드, 요청 파라미터, 페이지네이션 방식, 응답 형식(JSON/XML), 에러 코드 |
| 2 | `.env`에 키 입력 | `YOUTHCENTER_API_KEY`, `LOCAL_WELFARE_API_KEY` |
| 3 | 공공데이터포털 키 형식 확인 | 인코딩 키(Encoding)와 디코딩 키(Decoding)가 따로 제공된다. `URLSearchParams` 사용 시 이중 인코딩을 피하려면 **디코딩 키**를 넣는 것이 일반적이나, 테스트 호출로 확인한다 |
| 4 | `fetchAll()` 구현 | `TODO(API_SPEC)` 주석 위치에 호출·페이지네이션·XML 파싱(필요 시) 구현 |
| 5 | `normalize()` 매핑 | 명세의 응답 필드명을 `NormalizedPolicy` 필드에 매핑, 범위 필터(중앙부처·서울시·동작구) 적용 |
| 6 | 동기화 테스트 | `.env`에서 `DATA_SOURCE_MODE="live"`로 변경 후 `npm run sync` 실행 → `SyncLog`에서 `SUCCESS` 및 건수 확인 |
| 7 | 목업 데이터 정리 | `Policy` 테이블에서 `[예시]`로 시작하는 목업 행 비활성화(`isActive=false`) 또는 삭제 |

## 주의 사항
- 외부 API는 사용자 요청마다 호출하지 않는다. 반드시 `npm run sync` 또는 `/api/admin/sync`로만 호출한다.
- `EligibilityRule`은 사람이 검수한 규칙이므로 동기화 시 절대 덮어쓰지 않는다.
