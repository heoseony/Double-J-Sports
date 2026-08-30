"use client";

// 수업명(class_name) 기본 이름의 한->영 매핑
// "(N분)" 형식의 소요시간은 자동으로 "(N min)"으로 변환되므로,
// 여기에는 시간 표기를 뺀 순수 수업명만 등록하면 됩니다.
const CLASS_NAME_EN = {
  "분데스리가 엘리트 클래스": "Bundesliga Elite Class",
  "분데스리가 키즈 클래스": "Bundesliga Kids Class",
};

export function translateClassName(name, lang) {
  if (lang !== "en" || !name) return name;

  // "이름 (N분)" 형식이면 이름과 시간을 분리해서 각각 변환
  const match = name.match(/^(.*?)\s*\((\d+)\s*분\)\s*$/);
  if (match) {
    const base = match[1].trim();
    const minutes = match[2];
    const baseEn = CLASS_NAME_EN[base] || base;
    return `${baseEn} (${minutes} min)`;
  }

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
