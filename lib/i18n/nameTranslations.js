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

// 갤러리 카테고리명 한->영 매핑
// 여기에 등록되지 않은 카테고리(관리자가 새로 추가한 경우)는 원문 그대로 표시됩니다.
const CATEGORY_NAME_EN = {
  "맨즈": "Men's",
  "엘리트": "Elite",
  "우먼즈": "Women's",
  "키즈": "Kids",
  "행사": "Events",
};

export function translateCategoryName(name, lang) {
  if (lang !== "en" || !name) return name;
  return CATEGORY_NAME_EN[name] || name;
}

// 회원권 상품명(membership_plans.name) 한->영 변환
// "이름 (N분) 월 N회" 형식을 자동으로 "이름 (N min) - Nx/month" 형식으로 변환합니다.
// 이 패턴에 안 맞는 이름(예: 테스트용 상품)은 원문 그대로 표시됩니다.
export function translatePlanName(name, lang) {
  if (lang !== "en" || !name) return name;

  const fullMatch = name.match(/^(.*?)\s*\((\d+)\s*분\)\s*월\s*(\d+)\s*회\s*$/);
  if (fullMatch) {
    const base = fullMatch[1].trim();
    const minutes = fullMatch[2];
    const count = fullMatch[3];
    const baseEn = CLASS_NAME_EN[base] || base;
    return `${baseEn} (${minutes} min) - ${count}x/month`;
  }

  return translateClassName(name, lang);
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
