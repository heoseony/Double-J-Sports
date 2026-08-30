// 지역별 배경색 / 성별 프로그램 글씨색 공통 유틸

export function getRegionBg(region) {
  if (region === "dusseldorf") return "#FDECEC";
  return "#EAF4FC"; // 기본값: frankfurt (미지정 포함)
}

export function getRegionTextColor(region) {
  if (region === "dusseldorf") return "#c0392b";
  return "#3B82C4"; // 기본값: frankfurt
}

export function getRegionLabel(region, lang = "ko") {
  if (lang === "en") {
    if (region === "dusseldorf") return "Düsseldorf";
    if (region === "frankfurt") return "Frankfurt";
    return "";
  }
  if (region === "dusseldorf") return "뒤셀도르프";
  if (region === "frankfurt") return "프랑크푸르트";
  return "";
}

export function getProgramTextColor(program) {
  if (program === "kids") return "#3B82C4"; // 파랑
  if (program === "pro") return "#d32f2f"; // 빨강
  if (program === "general") return "#8b5fd6"; // 보라
  return "#1b3a63"; // 기본값
}
