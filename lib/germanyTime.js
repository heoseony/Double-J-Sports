// 독일(Europe/Berlin) 시간 기준 유틸
// 이 앱의 "오늘", "이번주", "마감시간" 등 모든 날짜/시간 계산은 독일시간 기준으로 한다.

export function nowInGermany() {
  const now = new Date();
  const germanyStr = now.toLocaleString("en-US", { timeZone: "Europe/Berlin" });
  return new Date(germanyStr);
}
