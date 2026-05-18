// ─────────────────────────────────────────────────────
// 가독성 필터 — 특수문자/자음 도배글 감지
// 2단계에서 활성화 (1단계에선 로직만 준비)
// ─────────────────────────────────────────────────────

/**
 * 자음/특수문자 도배 여부 판정
 * 한글 자음(ㅋㅋㅋ, ㅇㅇ 등) 비율이 30% 넘으면 true
 */
export function isLowReadability(text: string): boolean {
  if (!text || text.length < 10) return false;

  const totalLen = text.length;

  // 한글 자음 단독 (ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ)
  const jamoMatch = text.match(/[ㄱ-ㅎ]/g) || [];
  const jamoRatio = jamoMatch.length / totalLen;

  // 특수문자/이모지 (한글·영문·숫자·공백 제외)
  const specialMatch = text.match(/[^\w\sㄱ-ㅎ가-힣.,!?()\-"'~]/g) || [];
  const specialRatio = specialMatch.length / totalLen;

  // 반복 문자 (같은 글자 5개 이상)
  const hasRepeat = /(.)\1{4,}/.test(text);

  return jamoRatio > 0.3 || specialRatio > 0.4 || hasRepeat;
}

/**
 * 모든 대문자 + 특수문자 어그로 제목 감지
 */
export function isAggressiveTitle(title: string): boolean {
  if (!title) return false;
  const exclamCount = (title.match(/[!?]/g) || []).length;
  return exclamCount >= 3;
}
