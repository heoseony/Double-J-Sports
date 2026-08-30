// 지역별 배경색 / 성별 프로그램 글씨색 공통 유틸

export function getRegionBg(region) {
  if (region === "dusseldorf") return "#F2EEFC";
  return "#EAF4FC"; // 기본값: frankfurt (미지정 포함)
}

export function getRegionLabel(region) {
  if (region === "dusseldorf") return "뒤셀도르프";
  if (region === "frankfurt") return "프랑크푸르트";
  return "";
}

export function getProgramTextColor(program) {
  if (program === "pro") return "#d6336c"; // 핑크
  if (program === "general") return "#3B82C4"; // 파랑
  return "#1b3a63"; // kids 등 기본값
}
