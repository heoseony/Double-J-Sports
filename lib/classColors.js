// 지역별 배경색 / 성별 프로그램 글씨색 공통 유틸

export function getRegionBg(region) {
  if (region === "dusseldorf") return "#FDECEC";
  return "#EAF4FC"; // 기본값: frankfurt (미지정 포함)
}

// 수업 이름까지 보고 카드 배경색 결정: 여성 취미반=연핑크, 남성 취미반=연주황, 그 외는 지역색
export function getClassBg(region, className) {
  const name = className || "";
  if (name.includes("여성 취미반") || name.includes("여성취미반")) return "#FCE8F1";
  if (name.includes("남성 취미반") || name.includes("남성취미반")) return "#FFEBD6";
  return getRegionBg(region);
}

// 카드 왼쪽 선 색: 뒤셀도르프=빨강, 여성 취미반=핑크, 남성 취미반=주황, 그 외는 프로그램 색
export function getClassBarColor(region, className, program) {
  const name = className || "";
  if (region === "dusseldorf") return "#c0392b";
  if (name.includes("여성 취미반") || name.includes("여성취미반")) return "#F06EA9";
  if (name.includes("남성 취미반") || name.includes("남성취미반")) return "#F28C28";
  return getProgramTextColor(program);
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
