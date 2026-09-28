// 독일(Europe/Berlin) 시간 기준 유틸
// 이 앱의 "오늘", "이번주", "마감시간" 등 모든 날짜/시간 계산은 독일시간 기준으로 한다.
//
// 주의: 기존에는 독일 시간 문자열을 new Date(문자열)로 다시 파싱했는데, 이 경우
// "이 코드를 실행하는 기기(브라우저/서버)의 현지 시간대"로 잘못 해석되는 버그가 있었다.
// (예: 관리자가 한국(UTC+9)에서 접속하면 독일 시간 숫자를 한국 시간인 것처럼 읽어버려
// 실제 시간과 몇 시간씩 어긋남 -> "모두 지우기" 등 시간 비교 로직이 오작동)
// Intl.DateTimeFormat으로 독일 시간의 연/월/일/시/분/초를 직접 뽑아서,
// 그 숫자들을 "UTC 기준"으로 하는 Date를 만들면 실행 위치와 무관하게 항상 정확하다.
export function nowInGermany() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = {};
  for (const part of formatter.formatToParts(now)) {
    parts[part.type] = part.value;
  }
  return new Date(
    Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    )
  );
}
