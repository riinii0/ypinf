/**
 * 한국고용정보원 온통청년 청년정책 API 소스
 *
 * [승인 후 채워야 할 항목 체크리스트]
 * 1. 공식 명세에서 요청 URL(엔드포인트), HTTP 메서드, 필수 파라미터(인증키 파라미터명 포함) 확인
 * 2. 페이지네이션 파라미터(페이지 번호, 페이지당 건수, 전체 건수 필드명) 확인
 * 3. 응답 형식(JSON / XML) 확인 및 필요 시 XML 파서 적용
 * 4. 범위 필터(중앙부처·서울시·서울 동작구)를 요청 파라미터로 걸지, normalize 단계에서 걸지 결정
 * 5. 아래 normalize() 매핑 표의 "TODO 명세 필드명"을 실제 응답 필드명으로 교체
 * 6. .env에 YOUTHCENTER_API_KEY 입력 후 DATA_SOURCE_MODE=live에서 npm run sync 테스트
 */

import { Source } from "@prisma/client";
import {
  NotImplementedError,
  type NormalizedPolicy,
  type PolicySource,
} from "./types";

export class YouthCenterSource implements PolicySource {
  readonly name = Source.YOUTHCENTER;

  private getApiKey(): string {
    return (process.env.YOUTHCENTER_API_KEY ?? "").trim();
  }

  isConfigured(): boolean {
    return this.getApiKey().length > 0;
  }

  async fetchAll(): Promise<unknown[]> {
    if (!this.isConfigured()) {
      throw new Error("YOUTHCENTER_API_KEY가 설정되지 않았습니다.");
    }

    // TODO(API_SPEC): 공식 명세 확인 후 작성
    // - 요청 URL
    // - 쿼리 파라미터 (API 키, 페이지 번호, 페이지 크기, 지역/분야 필터 등)
    // - 페이지네이션 반복 조회
    // - 응답 형식(JSON/XML) 파싱 및 항목 배열 반환
    throw new NotImplementedError(
      "온통청년 API fetchAll()은 공식 명세 확인 후 구현해야 합니다. (docs/API_TODO.md 참고)"
    );
  }

  normalize(raw: unknown): NormalizedPolicy | null {
    if (!raw || typeof raw !== "object") {
      console.warn("[YOUTHCENTER] 잘못된 원본 항목을 건너뜁니다.");
      return null;
    }

    // TODO(API_SPEC): 공식 명세 확인 후 아래 매핑 표를 실제 필드명으로 채운다.
    // -------------------------------------------------------------
    // 우리 필드        | TODO 명세 필드명
    // -------------------------------------------------------------
    // externalId      | TODO 명세 필드명 (정책 고유 ID)
    // title           | TODO 명세 필드명 (정책명)
    // agency          | TODO 명세 필드명 (주관 기관명)
    // regionLevel     | TODO 명세 필드명 -> CENTRAL / SEOUL / DONGJAK 변환
    // category        | TODO 명세 필드명 -> HOUSING / JOB / EDUCATION / FINANCE / WELFARE 변환
    // summary         | TODO 명세 필드명 (정책 소개/지원 내용 요약)
    // applyUrl        | TODO 명세 필드명 (신청 사이트 URL)
    // detailUrl       | TODO 명세 필드명 (공고 원문 URL)
    // applyStart      | TODO 명세 필드명 (신청 시작일)
    // applyEnd        | TODO 명세 필드명 (신청 마감일)
    // isAlwaysOpen    | TODO 명세 필드명 (상시 모집 여부 판단 기준)
    // -------------------------------------------------------------
    // TODO(API_SPEC): 범위 필터(중앙부처·서울시·서울 동작구 외 제외 시 null 반환)

    console.warn("[YOUTHCENTER] normalize()가 아직 명세와 연결되지 않았습니다.");
    return null;
  }
}
