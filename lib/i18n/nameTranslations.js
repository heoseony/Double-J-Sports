"use client";

// 수업명(class_name) 한->영 매핑
// 여기에 등록되지 않은 수업명은 EN 상태에서도 원문(한국어) 그대로 표시됩니다.
const CLASS_NAME_EN = {
  "분데스리가 엘리트 클래스": "Bundesliga Elite Class",
};

export function translateClassName(name, lang) {
  if (lang !== "en" || !name) return name;
  return CLASS_NAME_EN[name] || name;
}

// 코치/감독 이름 한->영 매핑 (직함 포함하여 완성된 표기를 반환)
// 여기에 등록되지 않은 이름은 기본적으로 "Coach {이름}" 형태로 표시됩니다.
const COACH_NAME_EN = {
  "정연웅": "Coach JUNG",
  "정연황": "Coach HWANG",
  "정치현": "Coach Jung",
  "조훈": "Coach Cho",
  "Peter": "Coach Peter",
};

export function translateCoachName(name, lang) {
  if (lang !== "en" || !name) return name;
  return COACH_NAME_EN[name] || `Coach ${name}`;
}
