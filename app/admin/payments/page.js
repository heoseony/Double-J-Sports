"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { nowInGermany } from "../../../lib/germanyTime";
import { supabase } from "../../../lib/supabaseClient";
import { getRegionLabel } from "../../../lib/classColors";
import LoadingScreen from "../../components/LoadingScreen";

const BLUE = "#3B82C4";

function todayStr() {
  const d = nowInGermany();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// 결제 승인 시점 기준으로 이 회원권이 적용될 "대상 월"을 계산한다.
// 매월 25일부터는 다음 달 결제로 간주 (아카데미가 25일부터 다음달 결제 안내를 시작하기 때문).
function getTargetMonthStr() {
  const d = nowInGermany();
  let year = d.getUTCFullYear();
  let month = d.getUTCMonth(); // 0-indexed
  if (d.getUTCDate() >= 25) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  const mm = String(month + 1).padStart(2, "0");
  return `${year}-${mm}-01`;
}

function defaultDescription() {
  const monthLabel = nowInGermany().toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `Double J GmbH --\nAkademie-Training (${monthLabel})`;
}

// 개인레슨(guest) 인보이스 전용 기본 문구. 아카데미 문구 대신
// "{횟수} Personal Training" / "Session(s) {월}" 두 줄로 표시한다.
function defaultPersonalDescription(sessions) {
  const monthLabel = nowInGermany().toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const sessionWord = Number(sessions) === 1 ? "Session" : "Sessions";
  const firstLine = sessions ? `${sessions} Personal Training` : "Personal Training";
  return `${firstLine}\n${sessionWord} ${monthLabel}`;
}

const COUPON_AMOUNT = 20;

// 아카데미 수업 인보이스 기본 문구 미리보기 (실제 발급 시 /api/generate-invoice의
// autoDescription과 동일한 형식 — 수정 가능하도록 폼에 미리 채워 보여준다).
function defaultAcademyDescription() {
  const monthLabel = nowInGermany().toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `Double J GmbH --
Akademie-Training (${monthLabel})`;
}

function monthKey(dateStr) {
  return dateStr.slice(0, 7); // YYYY-MM
}

function monthLabelKr(key) {
  const [y, m] = key.split("-");
  return `${y}년 ${Number(m)}월`;
}

const TABS = [
  { key: "pending", label: "입금확인" },
  { key: "personal", label: "수동 결제 등록" },
  { key: "invoices", label: "인보이스" },
  { key: "settings", label: "계좌설정" },
  { key: "revenue", label: "매출현황" },
];

export default function AdminPaymentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUserId, setAdminUserId] = useState(null);
  const [activeTab, setActiveTab] = useState("pending");

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // ===== 입금확인 탭 상태 =====
  const [pendingPayments, setPendingPayments] = useState([]);
  const [confirmedPayments, setConfirmedPayments] = useState([]);
  const [clearedBefore, setClearedBefore] = useState(null);
  const [personalClearedBefore, setPersonalClearedBefore] = useState(null);
  const [showAllPersonal, setShowAllPersonal] = useState(false);
  const [confirmingId, setConfirmingId] = useState(null);
  const [modalPayment, setModalPayment] = useState(null);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [invoiceNumberDraft, setInvoiceNumberDraft] = useState("");

  // ===== 인보이스 탭 상태 =====
  const [invoices, setInvoices] = useState([]);
  const [invoicesLoaded, setInvoicesLoaded] = useState(false);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState("");
  const [openingPdfPath, setOpeningPdfPath] = useState(null);
  const [invoiceMonthOffset, setInvoiceMonthOffset] = useState(0); // 0=이번달, -1=지난달, +1=다음달
  const [downloadingZip, setDownloadingZip] = useState(false);

  // ===== 계좌설정 탭 상태 =====
  const [settingsId, setSettingsId] = useState(null);
  const [settingsForm, setSettingsForm] = useState({
    bank_name: "",
    account_holder: "",
    iban: "",
    bic: "",
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // ===== 매출현황 탭 상태 =====
  const [allConfirmedPayments, setAllConfirmedPayments] = useState([]);
  const [revenueLoaded, setRevenueLoaded] = useState(false);
  const [manualInvoicingId, setManualInvoicingId] = useState(null);
  const [manuallyInvoiced, setManuallyInvoiced] = useState({});
  const [resendingId, setResendingId] = useState(null);
  const [resendNote, setResendNote] = useState({});

  const [personalPlans, setPersonalPlans] = useState([]);
  const [personalPlansLoaded, setPersonalPlansLoaded] = useState(false);
  const [personalPayments, setPersonalPayments] = useState([]);
  const [personalPaymentsLoaded, setPersonalPaymentsLoaded] = useState(false);

  const [guestName, setGuestName] = useState("");
  const [guestNameEn, setGuestNameEn] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestAddressStreet, setGuestAddressStreet] = useState("");
  const [guestAddressZip, setGuestAddressZip] = useState("");
  const [guestAddressCity, setGuestAddressCity] = useState("");
  const [guestUnitPrice, setGuestUnitPrice] = useState("");
  const [guestSessionCount, setGuestSessionCount] = useState(1);
  const [onsiteMode, setOnsiteMode] = useState("personal"); // "personal" | "academy"
  const [registeredMembers, setRegisteredMembers] = useState([]);
  const [registeredMembersLoaded, setRegisteredMembersLoaded] = useState(false);
  const [personalExistingSearch, setPersonalExistingSearch] = useState("");
  const [personalExistingMemberId, setPersonalExistingMemberId] = useState("");
  const [academySearch, setAcademySearch] = useState("");
  const [academyMemberId, setAcademyMemberId] = useState("");
  const [academyPlans, setAcademyPlans] = useState([]);
  const [academyPlanId, setAcademyPlanId] = useState("");
  const [academyUnitPrice, setAcademyUnitPrice] = useState("");
  const [academyCoupon, setAcademyCoupon] = useState(null);
  const [academyMemberEmail, setAcademyMemberEmail] = useState("");
  const [academyUseCoupon, setAcademyUseCoupon] = useState(false);
  const [academyDepositorName, setAcademyDepositorName] = useState("");
  const [academyInvoiceNumber, setAcademyInvoiceNumber] = useState("");
  const [academyDescription, setAcademyDescription] = useState("");
  const [creatingAcademyPayment, setCreatingAcademyPayment] = useState(false);
  const [academyFormError, setAcademyFormError] = useState("");
  const [academyFormNote, setAcademyFormNote] = useState("");
  const [creatingGuestPayment, setCreatingGuestPayment] = useState(false);
  const [guestFormError, setGuestFormError] = useState("");
  const [guestFormNote, setGuestFormNote] = useState("");
  const [guestInvoiceNumber, setGuestInvoiceNumber] = useState("");
  const [guestDescription, setGuestDescription] = useState(defaultPersonalDescription());
  const [nextInvoiceNumberPreview, setNextInvoiceNumberPreview] = useState("");
  const [nextInvoiceNumberPreviewLoaded, setNextInvoiceNumberPreviewLoaded] = useState(false);

  // ===== 개인레슨 "인보이스 발행" 확인/수정 모달 상태 =====
  const [pimPayment, setPimPayment] = useState(null); // 발행 대상 payment row
  const [pimName, setPimName] = useState("");
  const [pimNameEn, setPimNameEn] = useState("");
  const [pimEmail, setPimEmail] = useState("");
  const [pimAddressStreet, setPimAddressStreet] = useState("");
  const [pimAddressZip, setPimAddressZip] = useState("");
  const [pimAddressCity, setPimAddressCity] = useState("");
  const [pimDescription, setPimDescription] = useState("");
  const [pimInvoiceNumber, setPimInvoiceNumber] = useState("");
  const [pimSaving, setPimSaving] = useState(false);
  const [pimError, setPimError] = useState("");
  const [hiddenPersonalIds, setHiddenPersonalIds] = useState([]);
  const [showConfirmedRecent, setShowConfirmedRecent] = useState(true);
  const [showPersonalRecent, setShowPersonalRecent] = useState(true);

  async function handleReject(payment) {
    if (
      !confirm(
        `${payment.members?.name || "이 회원"}님의 입금신청을 목록에서 제외하시겠습니까? (10월 이전 실수로 신청된 건 등 정리용)`
      )
    ) {
      return;
    }

    setConfirmingId(payment.id);

    const { error } = await supabase
      .from("payments")
      .update({ status: "rejected" })
      .eq("id", payment.id);

    setConfirmingId(null);

    if (error) {
      alert("처리 실패: " + error.message);
      return;
    }

    await loadPayments();
  }

  // 실제 발급될 인보이스 번호를 미리 보여주기 위한 조회 (RPC를 호출하면 번호가 실제로
  // 소모되므로, invoices 테이블에서 올해 최신 번호를 읽어 +1한 값을 미리보기로만 사용한다.
  async function loadNextInvoiceNumberPreview() {
    const year = nowInGermany().getUTCFullYear();
    // invoice_number가 text 컬럼이라 문자열 정렬로는 크기순이 보장되지 않으므로
    // (예: "9"가 "074"보다 사전순으로 더 큼), 전부 가져와서 숫자로 직접 비교한다.
    const { data } = await supabase
      .from("invoices")
      .select("invoice_number")
      .eq("invoice_year", year)
      .limit(1000);

    let maxNum = 0;
    (data || []).forEach((row) => {
      const parts = String(row.invoice_number || "").split("-");
      const n = Number(parts[1]);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    });

    const preview = `${year}-${String(maxNum + 1).padStart(3, "0")}`;
    setNextInvoiceNumberPreview(preview);
    setNextInvoiceNumberPreviewLoaded(true);
  }

  async function loadPersonalPlans() {
    const { data } = await supabase
      .from("membership_plans")
      .select("id, name, sessions_per_month, program, price")
      .eq("active", true)
      .or("is_hidden.is.null,is_hidden.eq.false")
      .order("name");
    setPersonalPlans(data || []);
    setPersonalPlansLoaded(true);

    // 개인레슨 1회 단가를 기본값으로 미리 채워준다 (수정은 자유롭게 가능).
    const basePlan = (data || []).find(
      (p) => p.program === "pro" && Number(p.sessions_per_month) === 1
    );
    if (basePlan && basePlan.price != null) {
      setGuestUnitPrice((prev) => (prev ? prev : String(basePlan.price)));
    }
  }

  // 게스트가 아닌 정식 등록 회원 목록 (현장결제를 기존 회원 앞으로 발행할 때 검색용).
  async function loadRegisteredMembers() {
    const { data } = await supabase
      .from("members")
      .select("id, name, name_en, program, guardian_id, address_street, address_zip, address_city, is_test, region")
      .is("guest_email", null)
      .or("is_test.is.null,is_test.eq.false")
      .order("name");
    setRegisteredMembers(data || []);
    setRegisteredMembersLoaded(true);
  }

  // 아카데미 회원 선택 시 해당 회원의 프로그램 플랜 + 사용 가능한 쿠폰을 불러온다.
  async function handleSelectAcademyMember(memberId) {
    setAcademyMemberId(memberId);
    setAcademyPlanId("");
    setAcademyUnitPrice("");
    setAcademyUseCoupon(false);
    setAcademyCoupon(null);
    setAcademyPlans([]);
    setAcademyMemberEmail("");
    if (!memberId) return;

    const member = registeredMembers.find((m) => m.id === memberId);
    if (!member) return;

    setAcademyDescription(defaultAcademyDescription());

    const { data: planData } = await supabase
      .from("membership_plans")
      .select("id, name, program, sessions_per_month, price, currency")
      .eq("active", true)
      .eq("program", member.program)
      .order("price", { ascending: true });
    setAcademyPlans(planData || []);

    const { data: couponData } = await supabase
      .from("coupons")
      .select("id, amount")
      .eq("member_id", memberId)
      .eq("used", false)
      .order("issued_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    setAcademyCoupon(couponData || null);

    // 영문 이름/이메일 표기용 — 보호자 로그인 이메일을 조회한다 (수정 불가, 참고용).
    if (member.guardian_id) {
      const { data: guardian } = await supabase
        .from("guardians")
        .select("user_id")
        .eq("id", member.guardian_id)
        .single();
      if (guardian?.user_id) {
        const { data: guardianUser } = await supabase
          .from("users")
          .select("email")
          .eq("id", guardian.user_id)
          .single();
        setAcademyMemberEmail(guardianUser?.email || "");
      }
    }
  }

  // 개인레슨 폼에서 "기존 회원" 선택 시 입력칸을 그 회원 정보로 채운다.
  async function handleSelectExistingPersonalMember(memberId) {
    setPersonalExistingMemberId(memberId);
    if (!memberId) return;
    const m = registeredMembers.find((rm) => rm.id === memberId);
    if (!m) return;
    setGuestName(m.name || "");
    setGuestNameEn(m.name_en || "");
    setGuestEmail("");
    setGuestAddressStreet(m.address_street || "");
    setGuestAddressZip(m.address_zip || "");
    setGuestAddressCity(m.address_city || "");

    // 등록된 보호자 로그인 이메일(인보이스 발송용)을 불러와 채운다.
    if (m.guardian_id) {
      const { data: guardian } = await supabase
        .from("guardians")
        .select("user_id")
        .eq("id", m.guardian_id)
        .single();
      if (guardian?.user_id) {
        const { data: guardianUser } = await supabase
          .from("users")
          .select("email")
          .eq("id", guardian.user_id)
          .single();
        setGuestEmail(guardianUser?.email || "");
      }
    }
  }

  async function loadPersonalPayments() {
    const { data } = await supabase
      .from("payments")
      .select(
        "id, total_amount, depositor_name, confirmed_at, member_id, plan_id, members(id, name, name_en, guest_email, address_street, address_zip, address_city), membership_plans(name, sessions_per_month)"
      )
      .eq("depositor_name", "개인레슨(현장)")
      .order("confirmed_at", { ascending: false })
      .limit(1000);
    setPersonalPayments(data || []);
    setPersonalPaymentsLoaded(true);
  }

  // 게스트(회원가입 없는) 회원 등록 + 결제 생성 + 인보이스 발행을 한 번에 처리한다.
  async function handleCreateGuestPayment() {
    setGuestFormError("");
    setGuestFormNote("");

    if (!guestName.trim()) {
      setGuestFormError("이름을 입력해주세요.");
      return;
    }
    if (!guestUnitPrice || Number(guestUnitPrice) <= 0) {
      setGuestFormError("단가를 입력해주세요.");
      return;
    }
    if (!guestSessionCount || Number(guestSessionCount) <= 0) {
      setGuestFormError("회차를 선택해주세요.");
      return;
    }

    setCreatingGuestPayment(true);

    const guestAmount = Math.round(Number(guestUnitPrice) * guestSessionCount * 100) / 100;

    // 선택한 회차에 맞는 개인레슨 플랜이 없으면 자동으로 만든다 (단가 × 회차).
    let planIdToUse = null;
    const { data: existingPlan } = await supabase
      .from("membership_plans")
      .select("id")
      .eq("program", "pro")
      .eq("sessions_per_month", guestSessionCount)
      .eq("price", guestAmount)
      .eq("active", true)
      .maybeSingle();

    if (existingPlan) {
      planIdToUse = existingPlan.id;
    } else {
      const { data: newPlan, error: newPlanError } = await supabase
        .from("membership_plans")
        .insert({
          name: `개인레슨 ${guestSessionCount}회`,
          program: "pro",
          sessions_per_month: guestSessionCount,
          price: guestAmount,
          currency: "EUR",
          active: true,
          is_hidden: true,
        })
        .select("id")
        .single();

      if (newPlanError || !newPlan) {
        setGuestFormError("플랜 생성 실패: " + (newPlanError?.message || ""));
        setCreatingGuestPayment(false);
        return;
      }
      planIdToUse = newPlan.id;
    }

    let memberIdToUse = personalExistingMemberId || null;

    if (!memberIdToUse) {
      const { data: newMember, error: memberError } = await supabase
        .from("members")
        .insert({
          name: guestName.trim(),
          name_en: guestNameEn.trim() || null,
          guest_email: guestEmail.trim() || null,
          address_street: guestAddressStreet.trim() || null,
          address_zip: guestAddressZip.trim() || null,
          address_city: guestAddressCity.trim() || null,
          program: "general",
          status: "active",
        })
        .select("id")
        .single();

      if (memberError || !newMember) {
        setGuestFormError("회원 등록 실패: " + (memberError?.message || ""));
        setCreatingGuestPayment(false);
        return;
      }
      memberIdToUse = newMember.id;
    }

    const { data: newPayment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        member_id: memberIdToUse,
        plan_id: planIdToUse,
        depositor_name: "개인레슨(현장)",
        total_amount: guestAmount,
        net_amount: Math.round((guestAmount / 1.19) * 100) / 100,
        vat_amount: Math.round((guestAmount - guestAmount / 1.19) * 100) / 100,
        status: "confirmed",
        payment_method: "manual",
        requested_at: new Date().toISOString(),
        confirmed_at: new Date().toISOString(),
        confirmed_by: adminUserId,
      })
      .select("id")
      .single();

    if (paymentError || !newPayment) {
      setGuestFormError("결제 기록 실패: " + (paymentError?.message || ""));
      setCreatingGuestPayment(false);
      return;
    }

    let invoiceNote = "";
    try {
      const res = await fetch("/api/generate-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: newPayment.id,
          descriptionOverride: guestDescription,
          customInvoiceNumber: guestInvoiceNumber.trim() || null,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        invoiceNote = ` (⚠ 인보이스 발급 실패: ${result.error || "알 수 없는 오류"})`;
      } else if (!result.emailSent) {
        invoiceNote = ` (인보이스 ${result.invoiceNumber} 발급됨, 이메일 발송 실패: ${
          result.emailError || "알 수 없는 이유"
        })`;
      } else {
        invoiceNote = ` (인보이스 ${result.invoiceNumber} 발급 및 이메일 발송 완료)`;
      }
    } catch (e) {
      invoiceNote = ` (⚠ 인보이스 발급 요청 자체가 실패했습니다: ${e.message})`;
    }

    setCreatingGuestPayment(false);
    setGuestFormNote(`${guestName.trim()}님 등록 및 결제 생성 완료.${invoiceNote}`);
    setGuestName("");
    setGuestNameEn("");
    setGuestEmail("");
    setGuestAddressStreet("");
    setGuestAddressZip("");
    setGuestAddressCity("");
    setGuestSessionCount(1);
    setPersonalExistingMemberId("");
    setPersonalExistingSearch("");
    setGuestInvoiceNumber("");
    setGuestDescription(defaultPersonalDescription());
    setPersonalPaymentsLoaded(false);
    await loadPersonalPayments();
    await loadNextInvoiceNumberPreview();
    setInvoicesLoaded(false);
    setRevenueLoaded(false);
  }

  // 등록된 회원의 아카데미 수업(현장결제) + 결제 생성 + 인보이스 발행을 한 번에 처리한다.
  async function handleCreateAcademyPayment() {
    setAcademyFormError("");
    setAcademyFormNote("");

    if (!academyMemberId) {
      setAcademyFormError("회원을 선택해주세요.");
      return;
    }
    if (!academyPlanId) {
      setAcademyFormError("플랜을 선택해주세요.");
      return;
    }
    if (!academyUnitPrice || Number(academyUnitPrice) < 0) {
      setAcademyFormError("가격을 입력해주세요.");
      return;
    }

    setCreatingAcademyPayment(true);

    const rawPrice = Number(academyUnitPrice);
    const discount = academyUseCoupon && academyCoupon ? Math.min(COUPON_AMOUNT, rawPrice) : 0;
    const totalAmount = Math.max(rawPrice - discount, 0);
    const netAmount = Math.round((totalAmount / 1.19) * 100) / 100;
    const vatAmount = Math.round((totalAmount - netAmount) * 100) / 100;
    const appliedCouponId = academyUseCoupon && academyCoupon ? academyCoupon.id : null;

    const targetMonth = getTargetMonthStr();

    // 같은 대상 월(target_month)의 기존 active 회원권만 만료 처리 (중복배정 정정용).
    await supabase
      .from("memberships")
      .update({ status: "expired" })
      .eq("member_id", academyMemberId)
      .eq("status", "active")
      .eq("target_month", targetMonth);

    const { error: membershipError } = await supabase.from("memberships").insert({
      member_id: academyMemberId,
      plan_id: academyPlanId,
      start_date: todayStr(),
      target_month: targetMonth,
      status: "active",
      sessions_used: 0,
    });

    if (membershipError) {
      setAcademyFormError("회원권 등록 실패: " + membershipError.message);
      setCreatingAcademyPayment(false);
      return;
    }

    const { data: newPayment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        member_id: academyMemberId,
        plan_id: academyPlanId,
        depositor_name: academyDepositorName.trim() || "현장결제(아카데미)",
        total_amount: totalAmount,
        net_amount: netAmount,
        vat_amount: vatAmount,
        status: "confirmed",
        payment_method: "manual",
        coupon_id: appliedCouponId,
        discount_amount: discount,
        requested_at: new Date().toISOString(),
        confirmed_at: new Date().toISOString(),
        confirmed_by: adminUserId,
      })
      .select("id")
      .single();

    if (paymentError || !newPayment) {
      setAcademyFormError("결제 기록 실패: " + (paymentError?.message || ""));
      setCreatingAcademyPayment(false);
      return;
    }

    if (appliedCouponId) {
      await supabase
        .from("coupons")
        .update({ used: true, used_at: new Date().toISOString(), payment_id: newPayment.id })
        .eq("id", appliedCouponId);
    }

    let invoiceNote = "";
    try {
      const res = await fetch("/api/generate-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: newPayment.id,
          descriptionOverride: academyDescription.trim() || undefined,
          customInvoiceNumber: academyInvoiceNumber.trim() || null,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        invoiceNote = ` (⚠ 인보이스 발급 실패: ${result.error || "알 수 없는 오류"})`;
      } else if (!result.emailSent) {
        invoiceNote = ` (인보이스 ${result.invoiceNumber} 발급됨, 이메일 발송 실패: ${
          result.emailError || "알 수 없는 이유"
        })`;
      } else {
        invoiceNote = ` (인보이스 ${result.invoiceNumber} 발급 및 이메일 발송 완료)`;
      }
    } catch (e) {
      invoiceNote = ` (⚠ 인보이스 발급 요청 자체가 실패했습니다: ${e.message})`;
    }

    const memberName = registeredMembers.find((m) => m.id === academyMemberId)?.name || "회원";
    setCreatingAcademyPayment(false);
    setAcademyFormNote(`${memberName}님 결제 생성 완료.${invoiceNote}`);
    setAcademyMemberId("");
    setAcademySearch("");
    setAcademyPlanId("");
    setAcademyUnitPrice("");
    setAcademyPlans([]);
    setAcademyCoupon(null);
    setAcademyUseCoupon(false);
    setAcademyMemberEmail("");
    setAcademyDepositorName("");
    setAcademyInvoiceNumber("");
    setAcademyDescription("");
    setInvoicesLoaded(false);
    setRevenueLoaded(false);
  }

  async function loadPayments() {
    const { data: pending } = await supabase
      .from("payments")
      .select(
        "id, total_amount, net_amount, vat_amount, discount_amount, depositor_name, requested_at, member_id, plan_id, members(name, program), membership_plans(name, sessions_per_month)"
      )
      .eq("status", "pending")
      .order("requested_at", { ascending: true });
    setPendingPayments(pending || []);

    const { data: confirmed } = await supabase
      .from("payments")
      .select(
        "id, total_amount, depositor_name, confirmed_at, members(name), membership_plans(name)"
      )
      .eq("status", "confirmed")
      .order("confirmed_at", { ascending: false })
      .limit(20);
    setConfirmedPayments(confirmed || []);
  }

  async function loadInvoices() {
    const { data, error } = await supabase
      .from("invoices")
      .select(
        "id, invoice_number, issued_at, total_amount, payment_id, pdf_url"
      )
      .order("issued_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("인보이스 조회 실패:", error);
      setInvoices([]);
      setInvoicesLoaded(true);
      return;
    }

    const invoiceList = data || [];
    const paymentIds = invoiceList.map((inv) => inv.payment_id).filter(Boolean);

    let paymentsMap = {};
    if (paymentIds.length > 0) {
      const { data: paymentsData } = await supabase
        .from("payments")
        .select("id, members(name), membership_plans(name)")
        .in("id", paymentIds);

      (paymentsData || []).forEach((p) => {
        paymentsMap[p.id] = p;
      });
    }

    const merged = invoiceList.map((inv) => ({
      ...inv,
      payments: paymentsMap[inv.payment_id] || null,
    }));

    setInvoices(merged);
    setInvoicesLoaded(true);
  }

  async function handleOpenInvoicePdf(invoiceId) {
    setOpeningPdfPath(invoiceId);

    // 팝업 차단 우회: 클릭 이벤트 직후(비동기 작업 전에) 빈 탭을 먼저 열어둔다
    const newTab = window.open("", "_blank");

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch("/api/invoice-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ invoiceId }),
      });
      const result = await res.json();

      if (!res.ok || !result.url) {
        setErrorMsg("PDF를 여는 데 실패했습니다: " + (result.error || "알 수 없는 오류"));
        setOpeningPdfPath(null);
        if (newTab) newTab.close();
        return;
      }

      if (newTab) {
        newTab.location.href = result.url;
      } else {
        // 팝업이 아예 차단되어 새 탭 자체가 안 열린 경우, 같은 탭에서라도 열어준다
        window.location.href = result.url;
      }
    } catch (e) {
      setErrorMsg("PDF를 여는 데 실패했습니다: " + e.message);
      if (newTab) newTab.close();
    }
    setOpeningPdfPath(null);
  }

  async function handleDownloadZip(invoiceList) {
    setDownloadingZip(true);
    setErrorMsg("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setErrorMsg("로그인이 필요합니다.");
        setDownloadingZip(false);
        return;
      }

      const invoiceIds = invoiceList.map((inv) => inv.id);

      const res = await fetch("/api/invoices-zip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ invoiceIds }),
      });

      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        setErrorMsg("다운로드 실패: " + (result.error || "알 수 없는 오류"));
        setDownloadingZip(false);
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "invoices.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setErrorMsg("다운로드 실패: " + e.message);
    }
    setDownloadingZip(false);
  }

  async function loadSettings() {
    const { data } = await supabase
      .from("payment_settings")
      .select("id, bank_name, account_holder, iban, bic")
      .limit(1)
      .maybeSingle();

    if (data) {
      setSettingsId(data.id);
      setSettingsForm({
        bank_name: data.bank_name || "",
        account_holder: data.account_holder || "",
        iban: data.iban || "",
        bic: data.bic || "",
      });
    }
    setSettingsLoaded(true);
  }

  async function loadRevenue() {
    // 2026년 8월까지는 테스트 운영 기간이라 매출 집계에서 제외, 9월부터 정식 집계
    const { data } = await supabase
      .from("payments")
      .select("total_amount, confirmed_at")
      .eq("status", "confirmed")
      .gte("confirmed_at", "2026-09-01")
      .order("confirmed_at", { ascending: true });
    setAllConfirmedPayments(data || []);
    setRevenueLoaded(true);
  }

  useEffect(() => {
    async function check() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile || profile.role !== "admin") {
        router.push("/dashboard");
        return;
      }

      setIsAdmin(true);
      setAdminUserId(user.id);

      try {
        const stored = localStorage.getItem(
          "double-j-sports-payments-cleared-before"
        );
        if (stored) setClearedBefore(stored);
      } catch (e) {
        // localStorage 접근 불가 시 그냥 무시 (숨김 기능만 안 됨)
      }

      try {
        const storedPersonal = localStorage.getItem(
          "double-j-sports-personal-cleared-before"
        );
        if (storedPersonal) setPersonalClearedBefore(storedPersonal);
      } catch (e) {
        // localStorage 접근 불가 시 그냥 무시 (숨김 기능만 안 됨)
      }

      try {
        const storedHiddenIds = localStorage.getItem(
          "double-j-sports-personal-hidden-ids"
        );
        if (storedHiddenIds) setHiddenPersonalIds(JSON.parse(storedHiddenIds));
      } catch (e) {
        // localStorage 접근 불가 시 그냥 무시 (숨김 기능만 안 됨)
      }

      await loadPayments();
      setLoading(false);
    }

    check();
  }, [router]);

  // 탭 전환 시 필요한 데이터 지연 로딩
  useEffect(() => {
    if (activeTab === "invoices" && !invoicesLoaded) loadInvoices();
    if (activeTab === "settings" && !settingsLoaded) loadSettings();
    if (activeTab === "revenue" && !revenueLoaded) loadRevenue();
    if (activeTab === "personal" && !personalPlansLoaded) loadPersonalPlans();
    if (activeTab === "personal" && !personalPaymentsLoaded) loadPersonalPayments();
    if (activeTab === "personal" && !registeredMembersLoaded) loadRegisteredMembers();
    if (activeTab === "personal" && !nextInvoiceNumberPreviewLoaded) loadNextInvoiceNumberPreview();
    if (activeTab === "pending" && !nextInvoiceNumberPreviewLoaded) loadNextInvoiceNumberPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  function openConfirmModal(payment) {
    setModalPayment(payment);
    setInvoiceNumberDraft("");
    setDescriptionDraft(defaultDescription());
    loadNextInvoiceNumberPreview();
  }

  function closeConfirmModal() {
    setModalPayment(null);
    setInvoiceNumberDraft("");
    setDescriptionDraft("");
  }

  function handleClearConfirmedList() {
    const now = nowInGermany().toISOString();
    try {
      localStorage.setItem("double-j-sports-payments-cleared-before", now);
    } catch (e) {
      // localStorage 접근 불가 시에도 이번 세션 동안은 화면에서 숨겨지도록 진행
    }
    setClearedBefore(now);
  }

  function handleClearPersonalList() {
    const now = nowInGermany().toISOString();
    try {
      localStorage.setItem("double-j-sports-personal-cleared-before", now);
    } catch (e) {
      // localStorage 접근 불가 시에도 이번 세션 동안은 화면에서 숨겨지도록 진행
    }
    setPersonalClearedBefore(now);
  }

  async function handleConfirm(payment, description, customInvoiceNumber) {
    setErrorMsg("");
    setSuccessMsg("");
    setConfirmingId(payment.id);
    closeConfirmModal();

    const { error: paymentUpdateError } = await supabase
      .from("payments")
      .update({
        status: "confirmed",
        confirmed_at: nowInGermany().toISOString(),
        confirmed_by: adminUserId,
      })
      .eq("id", payment.id);

    if (paymentUpdateError) {
      setConfirmingId(null);
      setErrorMsg("결제 확인 실패: " + paymentUpdateError.message);
      return;
    }

    const targetMonth = getTargetMonthStr();

    // 같은 대상 월(target_month)의 기존 active 회원권이 있으면 만료 처리 (중복결제 정정용).
    // 다른 월(예: 이번달이 남아있는데 다음달을 미리 결제) 회원권은 건드리지 않는다 —
    // 이번달 회원권은 이번달이 끝날 때까지 그대로 유효해야 하기 때문.
    await supabase
      .from("memberships")
      .update({ status: "expired" })
      .eq("member_id", payment.member_id)
      .eq("status", "active")
      .eq("target_month", targetMonth);

    const { error: membershipError } = await supabase
      .from("memberships")
      .insert({
        member_id: payment.member_id,
        plan_id: payment.plan_id,
        start_date: todayStr(),
        target_month: targetMonth,
        status: "active",
        sessions_used: 0,
      });

    if (membershipError) {
      setConfirmingId(null);
      setErrorMsg(
        "결제는 확인됐지만 회원권 배정에 실패했습니다: " +
          membershipError.message +
          " (회원권 배정 화면에서 수동으로 배정해주세요)"
      );
      await loadPayments();
      return;
    }

    let invoiceNote = "";
    try {
      const res = await fetch("/api/generate-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: payment.id,
          descriptionOverride: description,
          customInvoiceNumber: customInvoiceNumber || null,
        }),
      });
      const result = await res.json();

      if (!res.ok) {
        invoiceNote = ` (⚠ 인보이스 발급 실패: ${result.error || "알 수 없는 오류"})`;
      } else if (!result.emailSent) {
        invoiceNote = ` (인보이스 ${result.invoiceNumber} 발급됨, 이메일 발송은 실패: ${
          result.emailError || "알 수 없는 이유"
        })`;
      } else {
        invoiceNote = ` (인보이스 ${result.invoiceNumber} 발급 및 이메일 발송 완료)`;
      }
    } catch (e) {
      invoiceNote = ` (⚠ 인보이스 발급 요청 자체가 실패했습니다: ${e.message})`;
    }

    setConfirmingId(null);
    setSuccessMsg(
      `${payment.members?.name || "회원"}님의 결제가 확인되고 회원권이 배정되었습니다.${invoiceNote}`
    );
    await loadPayments();
    // 인보이스/매출현황 탭 캐시 무효화 (다음에 탭 전환 시 새로 불러오도록)
    setInvoicesLoaded(false);
    setRevenueLoaded(false);
  }

  // 이미 status='confirmed'로 들어간 결제(회원권 수동 배정 등, 확인 모달을 거치지 않은 건)에
  // 인보이스를 발행하기 위한 함수. 결제 확인/회원권 배정은 이미 끝난 상태라 인보이스 API만 호출한다.
  async function handleGenerateInvoiceForConfirmed(payment) {
    setManualInvoicingId(payment.id);
    let note = "";
    try {
      const res = await fetch("/api/generate-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: payment.id }),
      });
      const result = await res.json();

      if (!res.ok) {
        note = `⚠ 인보이스 발급 실패: ${result.error || "알 수 없는 오류"}`;
      } else if (!result.emailSent) {
        note = `인보이스 ${result.invoiceNumber} 발급됨 (이메일 발송 실패: ${
          result.emailError || "알 수 없는 이유"
        })`;
      } else {
        note = `인보이스 ${result.invoiceNumber} 발급 및 이메일 발송 완료`;
      }
    } catch (e) {
      note = `⚠ 인보이스 발급 요청 자체가 실패했습니다: ${e.message}`;
    }

    setManualInvoicingId(null);
    setManuallyInvoiced((prev) => ({ ...prev, [payment.id]: note }));
    setInvoicesLoaded(false);
    setRevenueLoaded(false);
  }

  // 개인레슨 "인보이스 발행" 클릭 시 바로 발급하지 않고, 이름/이메일/주소를
  // 한 번 더 확인·수정할 수 있는 모달을 연다.
  function openPersonalInvoiceModal(payment) {
    setPimPayment(payment);
    setPimName(payment.members?.name || "");
    setPimNameEn(payment.members?.name_en || "");
    setPimEmail(payment.members?.guest_email || "");
    setPimAddressStreet(payment.members?.address_street || "");
    setPimAddressZip(payment.members?.address_zip || "");
    setPimAddressCity(payment.members?.address_city || "");
    setPimDescription(defaultPersonalDescription(payment.membership_plans?.sessions_per_month));
    setPimInvoiceNumber("");
    setPimError("");
  }

  function closePersonalInvoiceModal() {
    setPimPayment(null);
    setPimError("");
  }

  // 모달에서 수정한 이름/이메일/주소를 members 테이블에 먼저 저장한 뒤,
  // 그 정보로 인보이스를 발급한다.
  async function handleConfirmPersonalInvoice() {
    if (!pimPayment) return;
    setPimError("");

    if (!pimNameEn.trim()) {
      setPimError("영문 이름을 입력해주세요. (인보이스에 영문 이름이 필요합니다)");
      return;
    }

    setPimSaving(true);

    const { error: updateError } = await supabase
      .from("members")
      .update({
        name: pimName.trim(),
        name_en: pimNameEn.trim() || null,
        guest_email: pimEmail.trim() || null,
        address_street: pimAddressStreet.trim() || null,
        address_zip: pimAddressZip.trim() || null,
        address_city: pimAddressCity.trim() || null,
      })
      .eq("id", pimPayment.member_id);

    if (updateError) {
      setPimSaving(false);
      setPimError("회원 정보 저장 실패: " + updateError.message);
      return;
    }

    const payment = pimPayment;
    setManualInvoicingId(payment.id);
    let note = "";
    try {
      const res = await fetch("/api/generate-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: payment.id,
          descriptionOverride: pimDescription,
          customInvoiceNumber: pimInvoiceNumber.trim() || null,
        }),
      });
      const result = await res.json();

      if (!res.ok) {
        note = `⚠ 인보이스 발급 실패: ${result.error || "알 수 없는 오류"}`;
      } else if (!result.emailSent) {
        note = `인보이스 ${result.invoiceNumber} 발급됨 (이메일 발송 실패: ${
          result.emailError || "알 수 없는 이유"
        })`;
      } else {
        note = `인보이스 ${result.invoiceNumber} 발급 및 이메일 발송 완료`;
      }
    } catch (e) {
      note = `⚠ 인보이스 발급 요청 자체가 실패했습니다: ${e.message}`;
    }

    setManualInvoicingId(null);
    setManuallyInvoiced((prev) => ({ ...prev, [payment.id]: note }));
    setInvoicesLoaded(false);
    setRevenueLoaded(false);
    setPimSaving(false);

    // 수정된 이름/주소가 목록에도 바로 반영되도록 새로고침
    setPersonalPaymentsLoaded(false);
    await loadPersonalPayments();

    closePersonalInvoiceModal();
  }

  // "삭제"는 실제 DB 삭제 대신, 이 관리자 브라우저에서만 그 항목을
  // "전체 개인레슨 등록 내역" 목록에서 숨긴다. 데이터(결제/인보이스/회원)는 그대로 남는다.
  function handleHidePersonalPayment(payment) {
    setHiddenPersonalIds((prev) => {
      if (prev.includes(payment.id)) return prev;
      const next = [...prev, payment.id];
      try {
        localStorage.setItem(
          "double-j-sports-personal-hidden-ids",
          JSON.stringify(next)
        );
      } catch (e) {
        // localStorage 접근 불가 시에도 이번 세션 동안은 화면에서 숨겨지도록 진행
      }
      return next;
    });
  }

  // 이미 발급된 인보이스를 새 번호로 다시 만들지 않고, 저장된 PDF 그대로 이메일만 재전송한다.
  // (이메일 발송 실패 같은 경우 재시도용)
  async function handleResendInvoice(payment) {
    setResendingId(payment.id);
    let note = "";
    try {
      const res = await fetch("/api/resend-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: payment.id }),
      });
      const result = await res.json();

      if (!res.ok) {
        note = `⚠ 재전송 실패: ${result.error || "알 수 없는 오류"}`;
      } else {
        note = `인보이스 ${result.invoiceNumber} → ${result.sentTo} 재전송 완료`;
      }
    } catch (e) {
      note = `⚠ 재전송 요청 자체가 실패했습니다: ${e.message}`;
    }
    setResendingId(null);
    setResendNote((prev) => ({ ...prev, [payment.id]: note }));
  }

  function handleSettingsChange(key, value) {
    setSettingsForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSettingsSubmit(e) {
    e.preventDefault();
    setSettingsError("");
    setSettingsSuccess("");
    setSettingsSaving(true);

    let error;

    if (settingsId) {
      const { error: updateError } = await supabase
        .from("payment_settings")
        .update(settingsForm)
        .eq("id", settingsId);
      error = updateError;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("payment_settings")
        .insert(settingsForm)
        .select()
        .single();
      error = insertError;
      if (inserted) setSettingsId(inserted.id);
    }

    setSettingsSaving(false);

    if (error) {
      setSettingsError("저장 실패: " + error.message);
      return;
    }

    setSettingsSuccess("저장되었습니다.");
  }

  if (loading || !isAdmin) {
    return <LoadingScreen text="확인 중..." />;
  }

  // ===== 매출현황 집계 계산 =====
  const revenueByMonth = {};
  allConfirmedPayments.forEach((p) => {
    if (!p.confirmed_at) return;
    const key = monthKey(p.confirmed_at);
    revenueByMonth[key] = (revenueByMonth[key] || 0) + Number(p.total_amount || 0);
  });
  const sortedMonthKeys = Object.keys(revenueByMonth).sort();
  const last6Months = sortedMonthKeys.slice(-6);
  const maxRevenue = Math.max(1, ...last6Months.map((k) => revenueByMonth[k]));
  const thisMonthKey = monthKey(todayStr());
  const thisMonthRevenue = revenueByMonth[thisMonthKey] || 0;

  return (
    <main
      style={{
        background: "#f3f7fc",
        minHeight: "100vh",
        paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 18px 4px" }}>
        <Link href="/dashboard" style={{ color: "#1b3a63", display: "flex" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>결제 관리</div>
      </div>

      {/* 탭 바 */}
      <div style={{ display: "flex", gap: 6, padding: "14px 18px 0", overflowX: "auto" }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: 700,
              border: "none",
              borderRadius: 999,
              background: activeTab === tab.key ? BLUE : "white",
              color: activeTab === tab.key ? "white" : "#5b7699",
              cursor: "pointer",
              whiteSpace: "nowrap",
              boxShadow: "0 1px 4px rgba(30,60,110,0.06)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "14px 18px 0" }}>
        {errorMsg && (
          <div style={{ background: "#fdecec", color: "#b3261e", padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 14 }}>
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div style={{ background: "#e9f1fb", color: "#1b3a63", padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 14 }}>
            {successMsg}
          </div>
        )}

        {/* ===================== 입금확인 탭 ===================== */}
        {activeTab === "pending" && (
          <>
            <div style={{ background: "white", borderRadius: 16, padding: 18, marginBottom: 16, boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#1b3a63", marginBottom: 12 }}>
                입금 확인 대기 ({pendingPayments.length}건)
              </div>

              {pendingPayments.length === 0 && (
                <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>
                  현재 입금 확인 대기 중인 신청이 없습니다.
                </p>
              )}

              {pendingPayments.map((p, idx) => (
                <div key={p.id} style={{ padding: "14px 0", borderTop: idx === 0 ? "none" : "1px solid #f0f3f8" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#1b3a63" }}>
                      {p.members?.name || "(알 수 없음)"}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: BLUE, background: "#e9f1fb", padding: "2px 8px", borderRadius: 999 }}>
                      {p.members?.program}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#33455e", marginTop: 6 }}>
                    {p.membership_plans?.name} ({p.membership_plans?.sessions_per_month}회) ·{" "}
                    <strong>{p.total_amount} EUR</strong>
                {Number(p.discount_amount) > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#3B82C4", background: "#e9f1fb", padding: "2px 8px", borderRadius: 999, marginLeft: 8 }}>
                    쿠폰 {p.discount_amount} EUR 할인 적용
                  </span>
                )}
                  </div>
                  <div style={{ fontSize: 12, color: "#8ea0b8", marginTop: 4 }}>
                    입금자명: <strong>{p.depositor_name}</strong> · 신청일시: {new Date(p.requested_at).toLocaleString("ko-KR")}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button
                      type="button"
                      style={{ padding: "10px 18px", fontSize: 13, fontWeight: 700, border: "none", borderRadius: 10, background: BLUE, color: "white", cursor: "pointer" }}
                      disabled={confirmingId === p.id}
                      onClick={() => openConfirmModal(p)}
                    >
                      {confirmingId === p.id ? "처리 중..." : "입금확인 · 회원권 활성화"}
                    </button>
                    <button
                      type="button"
                      style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, border: "1px solid #e5eaf2", borderRadius: 10, background: "white", color: "#8ea0b8", cursor: "pointer" }}
                      disabled={confirmingId === p.id}
                      onClick={() => handleReject(p)}
                    >
                      닫기
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: "white", borderRadius: 16, padding: 18, boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#1b3a63" }}>최근 확인 완료 내역</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {confirmedPayments.some((p) => !clearedBefore || p.confirmed_at > clearedBefore) && (
                    <button
                      type="button"
                      onClick={handleClearConfirmedList}
                      style={{ fontSize: 12, fontWeight: 700, color: "#8ea0b8", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      모두 지우기
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowConfirmedRecent((prev) => !prev)}
                    style={{ fontSize: 12, fontWeight: 700, color: "#3B82C4", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    {showConfirmedRecent ? "접기 ▲" : "펼치기 ▼"}
                  </button>
                </div>
              </div>

              {showConfirmedRecent && (() => {
                const visibleConfirmed = confirmedPayments.filter((p) => !clearedBefore || p.confirmed_at > clearedBefore);
                if (visibleConfirmed.length === 0) {
                  return <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>아직 확인된 결제 내역이 없습니다.</p>;
                }
                return visibleConfirmed.map((p, idx) => (
                  <div key={p.id} style={{ padding: "10px 0", borderTop: idx === 0 ? "none" : "1px solid #f0f3f8", fontSize: 13 }}>
                    <div style={{ color: "#1b3a63", fontWeight: 600 }}>
                      {p.members?.name} — {p.membership_plans?.name} · {p.total_amount} EUR
                    </div>
                    <div style={{ color: "#8ea0b8", fontSize: 12, marginTop: 2 }}>
                      입금자명: {p.depositor_name} · 확인일시: {new Date(p.confirmed_at).toLocaleString("ko-KR")}
                    </div>
                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        type="button"
                        disabled={manualInvoicingId === p.id}
                        onClick={() => handleGenerateInvoiceForConfirmed(p)}
                        style={{
                          padding: "6px 12px",
                          fontSize: 12,
                          fontWeight: 700,
                          border: "1px solid #3B82C4",
                          borderRadius: 8,
                          background: "white",
                          color: "#3B82C4",
                          cursor: manualInvoicingId === p.id ? "default" : "pointer",
                          opacity: manualInvoicingId === p.id ? 0.6 : 1,
                        }}
                      >
                        {manualInvoicingId === p.id ? "발행 중..." : "인보이스 발행"}
                      </button>
                      <button
                        type="button"
                        disabled={resendingId === p.id}
                        onClick={() => handleResendInvoice(p)}
                        style={{
                          padding: "6px 12px",
                          fontSize: 12,
                          fontWeight: 700,
                          border: "1px solid #e5eaf2",
                          borderRadius: 8,
                          background: "white",
                          color: "#5b7699",
                          cursor: resendingId === p.id ? "default" : "pointer",
                          opacity: resendingId === p.id ? 0.6 : 1,
                        }}
                      >
                        {resendingId === p.id ? "재전송 중..." : "인보이스 재전송"}
                      </button>
                    </div>
                    {manuallyInvoiced[p.id] && (
                      <div style={{ fontSize: 12, color: "#5b7699", marginTop: 4 }}>
                        {manuallyInvoiced[p.id]}
                      </div>
                    )}
                    {resendNote[p.id] && (
                      <div style={{ fontSize: 12, color: "#5b7699", marginTop: 4 }}>
                        {resendNote[p.id]}
                      </div>
                    )}
                  </div>
                ));
              })()}
            </div>          </>
        )}

        {/* ===================== 인보이스 탭 ===================== */}
        {activeTab === "invoices" && (
          <div style={{ background: "white", borderRadius: 16, padding: 18, boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#1b3a63", marginBottom: 12 }}>
              발급된 인보이스 ({invoices.length}건)
            </div>

            <input
              type="text"
              value={invoiceSearchQuery}
              onChange={(e) => setInvoiceSearchQuery(e.target.value)}
              placeholder="회원 이름으로 검색"
              style={{
                width: "100%",
                padding: 12,
                fontSize: 14,
                border: "1px solid #e5eaf2",
                borderRadius: 10,
                background: "#f7fafd",
                marginBottom: 14,
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />

            {!invoicesLoaded && <p style={{ fontSize: 13, color: "#8ea0b8" }}>불러오는 중...</p>}

            {invoicesLoaded && invoices.length === 0 && (
              <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>아직 발급된 인보이스가 없습니다.</p>
            )}

            {invoicesLoaded && invoices.length > 0 && (() => {
              const isSearching = invoiceSearchQuery.trim().length > 0;

              const filtered = invoices.filter((inv) => {
                if (!isSearching) return true;
                const name = inv.payments?.members?.name || "";
                return name.includes(invoiceSearchQuery.trim());
              });

              if (isSearching) {
                if (filtered.length === 0) {
                  return <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>검색 결과가 없습니다.</p>;
                }

                const groupedByMonth = {};
                filtered.forEach((inv) => {
                  const key = inv.issued_at ? inv.issued_at.slice(0, 7) : "미상";
                  if (!groupedByMonth[key]) groupedByMonth[key] = [];
                  groupedByMonth[key].push(inv);
                });
                const monthKeys = Object.keys(groupedByMonth).sort((a, b) => (a < b ? 1 : -1));

                return monthKeys.map((monthKey) => (
                  <div key={monthKey} style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: BLUE, marginBottom: 8 }}>
                      {monthKey === "미상" ? "날짜 미상" : `${monthKey.slice(0, 4)}년 ${Number(monthKey.slice(5, 7))}월`}
                    </div>
                    {groupedByMonth[monthKey].map((inv, idx) => (
                      <InvoiceRow key={inv.id} inv={inv} idx={idx} openingPdfPath={openingPdfPath} handleOpenInvoicePdf={handleOpenInvoicePdf} />
                    ))}
                  </div>
                ));
              }

              // 검색 중이 아닐 때: 월 하나씩 넘겨보기
              const now = nowInGermany();
              const targetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + invoiceMonthOffset, 1));
              const targetKey = `${targetDate.getUTCFullYear()}-${String(targetDate.getUTCMonth() + 1).padStart(2, "0")}`;
              const targetLabel = `${targetDate.getUTCFullYear()}년 ${targetDate.getUTCMonth() + 1}월`;

              const monthInvoices = invoices.filter((inv) => inv.issued_at && inv.issued_at.slice(0, 7) === targetKey);

              return (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <button
                      type="button"
                      onClick={() => setInvoiceMonthOffset((v) => v - 1)}
                      style={{ padding: "6px 12px", border: "1px solid #e5eaf2", borderRadius: 8, background: "white", color: "#1b3a63", cursor: "pointer" }}
                    >
                      ‹
                    </button>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#1b3a63" }}>{targetLabel}</div>
                    <button
                      type="button"
                      onClick={() => setInvoiceMonthOffset((v) => v + 1)}
                      style={{ padding: "6px 12px", border: "1px solid #e5eaf2", borderRadius: 8, background: "white", color: "#1b3a63", cursor: "pointer" }}
                    >
                      ›
                    </button>
                  </div>

                  {monthInvoices.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleDownloadZip(monthInvoices)}
                      disabled={downloadingZip}
                      style={{
                        width: "100%",
                        padding: 12,
                        fontSize: 13,
                        fontWeight: 700,
                        border: "1px solid #e5eaf2",

                        borderRadius: 10,
                        background: "white",
                        color: BLUE,
                        cursor: downloadingZip ? "default" : "pointer",
                        marginBottom: 14,
                      }}
                    >
                      {downloadingZip ? "압축 중..." : `이 달 인보이스 모두 다운받기 (${monthInvoices.length}건)`}
                    </button>
                  )}

                  {monthInvoices.length === 0 && (
                    <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>이 달에는 발급된 인보이스가 없습니다.</p>
                  )}

                  {monthInvoices.map((inv, idx) => (
                    <InvoiceRow key={inv.id} inv={inv} idx={idx} openingPdfPath={openingPdfPath} handleOpenInvoicePdf={handleOpenInvoicePdf} />
                  ))}
                </>
              );
            })()}
          </div>
        )}

        {/* ===================== 계좌설정 탭 ===================== */}
        {activeTab === "settings" && (
          <div style={{ background: "white", borderRadius: 16, padding: 18, boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
            <p style={{ fontSize: 13, color: "#8ea0b8", marginTop: 0, marginBottom: 16 }}>
              회원권 신청 시 학부모/회원에게 안내되는 입금 계좌 정보입니다.
            </p>

            {!settingsLoaded ? (
              <p style={{ fontSize: 13, color: "#8ea0b8" }}>불러오는 중...</p>
            ) : (
              <form onSubmit={handleSettingsSubmit}>
                {[
                  { key: "bank_name", label: "은행명" },
                  { key: "account_holder", label: "예금주" },
                  { key: "iban", label: "IBAN" },
                  { key: "bic", label: "BIC" },
                ].map((f) => (
                  <div key={f.key}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", display: "block", marginBottom: 6 }}>
                      {f.label}
                    </label>
                    <input
                      type="text"
                      value={settingsForm[f.key]}
                      onChange={(e) => handleSettingsChange(f.key, e.target.value)}
                      style={{ width: "100%", padding: 14, fontSize: 15, border: "1px solid #e5eaf2", borderRadius: 10, background: "#f7fafd", marginBottom: 14, boxSizing: "border-box", fontFamily: "inherit" }}
                    />
                  </div>
                ))}

                {settingsError && (
                  <div style={{ background: "#fdecec", color: "#b3261e", padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 14 }}>
                    {settingsError}
                  </div>
                )}
                {settingsSuccess && (
                  <div style={{ background: "#e9f1fb", color: "#1b3a63", padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 14 }}>
                    {settingsSuccess}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={settingsSaving}
                  style={{ width: "100%", padding: 14, fontSize: 15, fontWeight: 700, color: "white", background: settingsSaving ? "#9db8d6" : BLUE, border: "none", borderRadius: 10, cursor: settingsSaving ? "default" : "pointer" }}
                >
                  {settingsSaving ? "저장 중..." : "저장"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ===================== 매출현황 탭 ===================== */}
        {activeTab === "revenue" && (
          <>
            <div style={{ background: "white", borderRadius: 16, padding: 18, marginBottom: 16, boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
              <div style={{ fontSize: 13, color: "#8ea0b8", marginBottom: 4 }}>이번 달 매출</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#1b3a63" }}>
                {thisMonthRevenue.toLocaleString()} EUR
              </div>
            </div>

            <div style={{ background: "white", borderRadius: 16, padding: 18, marginBottom: 16, boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#1b3a63", marginBottom: 16 }}>
                최근 {last6Months.length}개월 매출
              </div>

              {!revenueLoaded && <p style={{ fontSize: 13, color: "#8ea0b8" }}>불러오는 중...</p>}

              {revenueLoaded && last6Months.length === 0 && (
                <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>아직 확정된 매출 데이터가 없습니다.</p>
              )}

              {revenueLoaded && last6Months.length > 0 && (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 160, paddingTop: 10 }}>
                  {last6Months.map((key) => {
                    const value = revenueByMonth[key];
                    const heightPct = Math.max(4, (value / maxRevenue) * 100);
                    return (
                      <div key={key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                        <div style={{ fontSize: 11, color: "#1b3a63", fontWeight: 700, marginBottom: 4 }}>
                          {value.toLocaleString()}
                        </div>
                        <div
                          style={{
                            width: "100%",
                            height: `${heightPct}%`,
                            background: key === thisMonthKey ? BLUE : "#bcd7ee",
                            borderRadius: "6px 6px 0 0",
                          }}
                        />
                        <div style={{ fontSize: 11, color: "#8ea0b8", marginTop: 6 }}>
                          {key.slice(5, 7)}월
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ background: "white", borderRadius: 16, padding: 18, boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#1b3a63", marginBottom: 12 }}>월별 매출 상세</div>

              {revenueLoaded && sortedMonthKeys.length === 0 && (
                <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>데이터가 없습니다.</p>
              )}

              {[...sortedMonthKeys].reverse().map((key, idx) => (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: idx === 0 ? "none" : "1px solid #f0f3f8", fontSize: 13 }}>
                  <span style={{ color: "#33455e" }}>{monthLabelKr(key)}</span>
                  <strong style={{ color: "#1b3a63" }}>{revenueByMonth[key].toLocaleString()} EUR</strong>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ===================== 개인레슨 탭 ===================== */}
        {activeTab === "personal" && (
          <>
            <div style={{ background: "white", borderRadius: 16, padding: 18, marginBottom: 16, boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#1b3a63", marginBottom: 4 }}>
                수동 결제 등록
              </div>
              <p style={{ fontSize: 12, color: "#8ea0b8", marginTop: 0, marginBottom: 12 }}>
                개인레슨 또는 아카데미 수업 결제를 등록하고, 결제 생성과 인보이스 발행까지 한 번에 처리합니다.
              </p>

              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={() => setOnsiteMode("personal")}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    fontSize: 13,
                    fontWeight: 700,
                    border: onsiteMode === "personal" ? "none" : "1px solid #e5eaf2",
                    borderRadius: 8,
                    background: onsiteMode === "personal" ? BLUE : "white",
                    color: onsiteMode === "personal" ? "white" : "#8ea0b8",
                    cursor: "pointer",
                  }}
                >
                  개인레슨
                </button>
                <button
                  type="button"
                  onClick={() => setOnsiteMode("academy")}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    fontSize: 13,
                    fontWeight: 700,
                    border: onsiteMode === "academy" ? "none" : "1px solid #e5eaf2",
                    borderRadius: 8,
                    background: onsiteMode === "academy" ? BLUE : "white",
                    color: onsiteMode === "academy" ? "white" : "#8ea0b8",
                    cursor: "pointer",
                  }}
                >
                  아카데미 수업
                </button>
              </div>

              {onsiteMode === "personal" && (
              <>
              <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", display: "block", marginBottom: 6 }}>
                기존 회원에서 불러오기 (선택)
              </label>
              <input
                type="text"
                value={personalExistingSearch}
                onChange={(e) => setPersonalExistingSearch(e.target.value)}
                placeholder="회원 이름 검색"
                style={{ width: "100%", boxSizing: "border-box", padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 8, marginBottom: 6 }}
              />
              <select
                value={personalExistingMemberId}
                onChange={(e) => handleSelectExistingPersonalMember(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box", padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 8, marginBottom: 10, background: "white" }}
              >
                <option value="">직접 입력 (신규 등록)</option>
                {(() => {
                  const matched = registeredMembers.filter((m) =>
                    personalExistingSearch.trim()
                      ? (m.name || "").includes(personalExistingSearch.trim()) ||
                        (m.name_en || "").toLowerCase().includes(personalExistingSearch.trim().toLowerCase())
                      : true
                  );
                  const frankfurt = matched.filter((m) => m.region !== "dusseldorf");
                  const dusseldorf = matched.filter((m) => m.region === "dusseldorf");
                  return (
                    <>
                      <optgroup label={getRegionLabel("frankfurt")}>
                        {frankfurt.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} {m.name_en ? `(${m.name_en})` : ""}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label={getRegionLabel("dusseldorf")}>
                        {dusseldorf.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} {m.name_en ? `(${m.name_en})` : ""}
                          </option>
                        ))}
                      </optgroup>
                    </>
                  );
                })()}
              </select>
              {personalExistingMemberId && (
                <div style={{ background: "#e9f1fb", color: "#1b3a63", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 10 }}>
                  기존 회원 "{guestName}"님 정보를 불러왔어요. 아래 이름·주소는 수정 가능합니다.
                </div>
              )}

              <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", display: "block", marginBottom: 6 }}>이름</label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="이름"
                autoComplete="off"
                style={{ width: "100%", boxSizing: "border-box", padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 8, marginBottom: 10 }}
              />

              <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", display: "block", marginBottom: 6 }}>영문 이름 (인보이스용)</label>
              <input
                type="text"
                value={guestNameEn}
                onChange={(e) => setGuestNameEn(e.target.value)}
                placeholder="영문 이름"
                autoComplete="off"
                style={{ width: "100%", boxSizing: "border-box", padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 8, marginBottom: 10 }}
              />

              <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", display: "block", marginBottom: 6 }}>이메일 (인보이스 발송용)</label>
              <input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="이메일"
                autoComplete="off"
                style={{ width: "100%", boxSizing: "border-box", padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 8, marginBottom: 10 }}
              />

              <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", display: "block", marginBottom: 6 }}>
                주소 (250유로 이상 인보이스는 독일 법상 필수)
              </label>
              <input
                type="text"
                value={guestAddressStreet}
                onChange={(e) => setGuestAddressStreet(e.target.value)}
                placeholder="거리명, 번지 (예: Cäsar-von-hofacker Straße 3)"
                style={{ width: "100%", boxSizing: "border-box", padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 8, marginBottom: 8 }}
              />
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input
                  type="text"
                  value={guestAddressZip}
                  onChange={(e) => setGuestAddressZip(e.target.value)}
                  placeholder="우편번호"
                  style={{ width: 110, boxSizing: "border-box", padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 8 }}
                />
                <input
                  type="text"
                  value={guestAddressCity}
                  onChange={(e) => setGuestAddressCity(e.target.value)}
                  placeholder="도시"
                  style={{ flex: 1, boxSizing: "border-box", padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 8 }}
                />
              </div>
              {Number(guestUnitPrice) * guestSessionCount >= 250 && !guestAddressStreet.trim() && (
                <div style={{ background: "#fff4e5", color: "#c07a1e", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 10 }}>
                  250유로 이상 결제입니다 — 독일 세법상 인보이스에 주소가 필요해요. 위 주소 칸을 채워주세요.
                </div>
              )}

              <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", display: "block", marginBottom: 6 }}>
                단가 (1회당, EUR)
              </label>
              <input
                type="number"
                value={guestUnitPrice}
                onChange={(e) => setGuestUnitPrice(e.target.value)}
                placeholder="예: 70"
                style={{ width: "100%", boxSizing: "border-box", padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 8, marginBottom: 10 }}
              />

              <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", display: "block", marginBottom: 6 }}>회차</label>
              <select
                value={guestSessionCount}
                onChange={(e) => {
                  const count = Number(e.target.value);
                  setGuestSessionCount(count);
                  setGuestDescription(defaultPersonalDescription(count));
                }}
                style={{ width: "100%", boxSizing: "border-box", padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 8, marginBottom: 10, background: "white" }}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}회
                  </option>
                ))}
              </select>

              <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", display: "block", marginBottom: 6 }}>
                총 금액 (단가 × 회차, 자동 계산)
              </label>
              <div
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#1b3a63",
                  border: "1px solid #e5eaf2",
                  borderRadius: 8,
                  marginBottom: 10,
                  background: "#f3f7fc",
                }}
              >
                {guestUnitPrice && Number(guestUnitPrice) > 0
                  ? `${(Number(guestUnitPrice) * guestSessionCount).toFixed(2)} EUR`
                  : "단가를 입력해주세요"}
              </div>

              <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", display: "block", marginBottom: 6 }}>
                인보이스 번호 (선택, 비워두면 자동 생성)
              </label>
              <input
                type="text"
                value={guestInvoiceNumber}
                onChange={(e) => setGuestInvoiceNumber(e.target.value)}
                placeholder={nextInvoiceNumberPreview ? `비워두면 ${nextInvoiceNumberPreview} 로 자동 생성` : "예: 2026-001"}
                style={{ width: "100%", boxSizing: "border-box", padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 8, marginBottom: 10 }}
              />

              <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", display: "block", marginBottom: 6 }}>
                인보이스 항목 설명 (Description)
              </label>
              <textarea
                value={guestDescription}
                onChange={(e) => setGuestDescription(e.target.value)}
                rows={3}
                style={{ width: "100%", boxSizing: "border-box", padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 8, resize: "vertical", fontFamily: "inherit", marginBottom: 12 }}
              />

              {guestFormError && (
                <div style={{ background: "#fdecec", color: "#b3261e", padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 10 }}>
                  {guestFormError}
                </div>
              )}
              {guestFormNote && (
                <div style={{ background: "#e9f1fb", color: "#1b3a63", padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 10 }}>
                  {guestFormNote}
                </div>
              )}

              <button
                type="button"
                disabled={creatingGuestPayment}
                onClick={handleCreateGuestPayment}
                style={{
                  width: "100%",
                  padding: "12px 0",
                  fontSize: 14,
                  fontWeight: 700,
                  border: "none",
                  borderRadius: 10,
                  background: BLUE,
                  color: "white",
                  cursor: creatingGuestPayment ? "default" : "pointer",
                  opacity: creatingGuestPayment ? 0.6 : 1,
                }}
              >
                {creatingGuestPayment ? "처리 중..." : "등록 · 결제 생성 · 인보이스 발행"}
              </button>
              </>
              )}

              {onsiteMode === "academy" && (
              <>
              <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", display: "block", marginBottom: 6 }}>
                회원 검색
              </label>
              <input
                type="text"
                value={academySearch}
                onChange={(e) => setAcademySearch(e.target.value)}
                placeholder="회원 이름 검색"
                style={{ width: "100%", boxSizing: "border-box", padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 8, marginBottom: 6 }}
              />
              <select
                value={academyMemberId}
                onChange={(e) => handleSelectAcademyMember(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box", padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 8, marginBottom: 10, background: "white" }}
              >
                <option value="">회원 선택</option>
                {(() => {
                  const matched = registeredMembers.filter((m) =>
                    academySearch.trim()
                      ? (m.name || "").includes(academySearch.trim()) ||
                        (m.name_en || "").toLowerCase().includes(academySearch.trim().toLowerCase())
                      : true
                  );
                  const frankfurt = matched.filter((m) => m.region !== "dusseldorf");
                  const dusseldorf = matched.filter((m) => m.region === "dusseldorf");
                  return (
                    <>
                      <optgroup label={getRegionLabel("frankfurt")}>
                        {frankfurt.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} {m.name_en ? `(${m.name_en})` : ""}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label={getRegionLabel("dusseldorf")}>
                        {dusseldorf.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} {m.name_en ? `(${m.name_en})` : ""}
                          </option>
                        ))}
                      </optgroup>
                    </>
                  );
                })()}
              </select>

              {academyMemberId && (
                <>
                  <div style={{ background: "#f3f7fc", color: "#1b3a63", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 10 }}>
                    영문 이름: {registeredMembers.find((m) => m.id === academyMemberId)?.name_en || "-"}
                    {" · "}
                    이메일: {academyMemberEmail || "-"}
                  </div>

                  <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", display: "block", marginBottom: 6 }}>
                    플랜
                  </label>
                  <select
                    value={academyPlanId}
                    onChange={(e) => {
                      const planId = e.target.value;
                      setAcademyPlanId(planId);
                      const plan = academyPlans.find((pp) => pp.id === planId);
                      setAcademyUnitPrice(plan ? String(plan.price) : "");
                    }}
                    style={{ width: "100%", boxSizing: "border-box", padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 8, marginBottom: 10, background: "white" }}
                  >
                    <option value="">플랜 선택</option>
                    {academyPlans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sessions_per_month}회) · {p.price} {p.currency}
                      </option>
                    ))}
                  </select>

                  <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", display: "block", marginBottom: 6 }}>
                    단가 (EUR, 직접 수정 가능)
                  </label>
                  <input
                    type="number"
                    value={academyUnitPrice}
                    onChange={(e) => setAcademyUnitPrice(e.target.value)}
                    placeholder="예: 100"
                    autoComplete="off"
                    style={{ width: "100%", boxSizing: "border-box", padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 8, marginBottom: 10 }}
                  />

                  {academyCoupon && (
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1b3a63", marginBottom: 10 }}>
                      <input
                        type="checkbox"
                        checked={academyUseCoupon}
                        onChange={(e) => setAcademyUseCoupon(e.target.checked)}
                      />
                      보유 쿠폰 적용 (-{Math.min(COUPON_AMOUNT, academyCoupon.amount || COUPON_AMOUNT)} EUR)
                    </label>
                  )}

                  <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", display: "block", marginBottom: 6 }}>
                    총 금액
                  </label>
                  <div
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: 10,
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#1b3a63",
                      border: "1px solid #e5eaf2",
                      borderRadius: 8,
                      marginBottom: 10,
                      background: "#f3f7fc",
                    }}
                  >
                    {(() => {
                      if (!academyPlanId) return "플랜을 선택해주세요";
                      const raw = Number(academyUnitPrice) || 0;
                      const discount = academyUseCoupon && academyCoupon ? Math.min(COUPON_AMOUNT, raw) : 0;
                      return `${Math.max(raw - discount, 0).toFixed(2)} EUR${discount ? ` (쿠폰 -${discount} EUR 적용)` : ""}`;
                    })()}
                  </div>

                  <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", display: "block", marginBottom: 6 }}>
                    입금자명 (선택)
                  </label>
                  <input
                    type="text"
                    value={academyDepositorName}
                    onChange={(e) => setAcademyDepositorName(e.target.value)}
                    placeholder="비워두면 '현장결제(아카데미)'로 기록"
                    style={{ width: "100%", boxSizing: "border-box", padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 8, marginBottom: 10 }}
                  />

                  <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", display: "block", marginBottom: 6 }}>
                    인보이스 번호 (선택, 비워두면 자동 생성)
                  </label>
                  <input
                    type="text"
                    value={academyInvoiceNumber}
                    onChange={(e) => setAcademyInvoiceNumber(e.target.value)}
                    placeholder={nextInvoiceNumberPreview ? `비워두면 ${nextInvoiceNumberPreview} 로 자동 생성` : "예: 2026-001"}
                    style={{ width: "100%", boxSizing: "border-box", padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 8, marginBottom: 10 }}
                  />

                  <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", display: "block", marginBottom: 6 }}>
                    인보이스 항목 설명 (선택, 비워두면 기본 문구 사용)
                  </label>
                  <textarea
                    value={academyDescription}
                    onChange={(e) => setAcademyDescription(e.target.value)}
                    rows={3}
                    style={{ width: "100%", boxSizing: "border-box", padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 8, resize: "vertical", fontFamily: "inherit", marginBottom: 12 }}
                  />
                </>
              )}

              {academyFormError && (
                <div style={{ background: "#fdecec", color: "#b3261e", padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 10 }}>
                  {academyFormError}
                </div>
              )}
              {academyFormNote && (
                <div style={{ background: "#e9f1fb", color: "#1b3a63", padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 10 }}>
                  {academyFormNote}
                </div>
              )}

              <button
                type="button"
                disabled={creatingAcademyPayment || !academyMemberId}
                onClick={handleCreateAcademyPayment}
                style={{
                  width: "100%",
                  padding: "12px 0",
                  fontSize: 14,
                  fontWeight: 700,
                  border: "none",
                  borderRadius: 10,
                  background: BLUE,
                  color: "white",
                  cursor: creatingAcademyPayment ? "default" : "pointer",
                  opacity: creatingAcademyPayment || !academyMemberId ? 0.6 : 1,
                }}
              >
                {creatingAcademyPayment ? "처리 중..." : "회원권 등록 · 결제 생성 · 인보이스 발행"}
              </button>
              </>
              )}
            </div>

            <div style={{ background: "white", borderRadius: 16, padding: 18, boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#1b3a63" }}>최근 등록한 개인레슨</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {personalPayments.some((p) => !personalClearedBefore || p.confirmed_at > personalClearedBefore) && (
                    <button
                      type="button"
                      onClick={handleClearPersonalList}
                      style={{ fontSize: 12, fontWeight: 700, color: "#8ea0b8", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      모두 지우기
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPersonalRecent((prev) => !prev)}
                    style={{ fontSize: 12, fontWeight: 700, color: "#3B82C4", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    {showPersonalRecent ? "접기 ▲" : "펼치기 ▼"}
                  </button>
                </div>
              </div>

              {showPersonalRecent && (() => {
                const visiblePersonal = personalPayments.filter((p) => !personalClearedBefore || p.confirmed_at > personalClearedBefore);
                if (personalPaymentsLoaded && visiblePersonal.length === 0) {
                  return <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>아직 등록된 개인레슨이 없습니다.</p>;
                }
                return visiblePersonal.map((p, idx) => (
                <div key={p.id} style={{ padding: "10px 0", borderTop: idx === 0 ? "none" : "1px solid #f0f3f8", fontSize: 13 }}>
                  <div style={{ color: "#1b3a63", fontWeight: 600 }}>
                    {p.members?.name} — {p.membership_plans?.name} · {p.total_amount} EUR
                  </div>
                  <div style={{ color: "#8ea0b8", fontSize: 12, marginTop: 2 }}>
                    등록일시: {new Date(p.confirmed_at).toLocaleString("ko-KR")}
                  </div>
                  <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      type="button"
                      disabled={manualInvoicingId === p.id}
                      onClick={() => openPersonalInvoiceModal(p)}
                      style={{
                        padding: "6px 12px",
                        fontSize: 12,
                        fontWeight: 700,
                        border: "1px solid #3B82C4",
                        borderRadius: 8,
                        background: "white",
                        color: "#3B82C4",
                        cursor: manualInvoicingId === p.id ? "default" : "pointer",
                        opacity: manualInvoicingId === p.id ? 0.6 : 1,
                      }}
                    >
                      {manualInvoicingId === p.id ? "발행 중..." : "인보이스 발행"}
                    </button>
                    <button
                      type="button"
                      disabled={resendingId === p.id}
                      onClick={() => handleResendInvoice(p)}
                      style={{
                        padding: "6px 12px",
                        fontSize: 12,
                        fontWeight: 700,
                        border: "1px solid #e5eaf2",
                        borderRadius: 8,
                        background: "white",
                        color: "#5b7699",
                        cursor: resendingId === p.id ? "default" : "pointer",
                        opacity: resendingId === p.id ? 0.6 : 1,
                      }}
                    >
                      {resendingId === p.id ? "재전송 중..." : "인보이스 재전송"}
                    </button>
                  </div>
                  {manuallyInvoiced[p.id] && (
                    <div style={{ fontSize: 12, color: "#5b7699", marginTop: 4 }}>{manuallyInvoiced[p.id]}</div>
                  )}
                  {resendNote[p.id] && (
                    <div style={{ fontSize: 12, color: "#5b7699", marginTop: 4 }}>{resendNote[p.id]}</div>
                  )}
                </div>
                ));
              })()}
            </div>

            {/* 전체 개인레슨 등록 내역: "모두 지우기"와 무관하게 지금까지의 전체 이력을 보여준다.
                이름/이메일/주소/인보이스 재전송까지 여기서 전부 관리할 수 있도록 함. */}
            <div style={{ background: "white", borderRadius: 16, padding: 18, boxShadow: "0 2px 10px rgba(30,60,110,0.06)", marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setShowAllPersonal((v) => !v)}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 15, color: "#1b3a63" }}>
                  전체 개인레슨 등록 내역 ({personalPayments.filter((p) => !hiddenPersonalIds.includes(p.id)).length}건)
                </div>
                <div style={{ fontSize: 12, color: "#3B82C4", fontWeight: 700 }}>
                  {showAllPersonal ? "접기 ▲" : "펼치기 ▼"}
                </div>
              </button>

              {showAllPersonal && (
                <div style={{ marginTop: 12 }}>
                  {(() => {
                    const visibleAllPersonal = personalPayments.filter((p) => !hiddenPersonalIds.includes(p.id));
                    if (personalPaymentsLoaded && visibleAllPersonal.length === 0) {
                      return <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>표시할 개인레슨 내역이 없습니다.</p>;
                    }
                    return visibleAllPersonal.map((p, idx) => {
                    const addressLine = [p.members?.address_street, p.members?.address_zip, p.members?.address_city]
                      .filter(Boolean)
                      .join(", ");
                    return (
                      <div key={p.id} style={{ padding: "10px 0", borderTop: idx === 0 ? "none" : "1px solid #f0f3f8", fontSize: 13 }}>
                        <div style={{ color: "#1b3a63", fontWeight: 600 }}>
                          {p.members?.name} — {p.membership_plans?.name} · {p.total_amount} EUR
                        </div>
                        <div style={{ color: "#8ea0b8", fontSize: 12, marginTop: 2 }}>
                          {p.members?.guest_email || "이메일 없음"}
                          {addressLine ? ` · ${addressLine}` : ""}
                        </div>
                        <div style={{ color: "#8ea0b8", fontSize: 12, marginTop: 2 }}>
                          등록일시: {new Date(p.confirmed_at).toLocaleString("ko-KR")}
                        </div>
                        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 10 }}>
                          <button
                            type="button"
                            disabled={manualInvoicingId === p.id}
                            onClick={() => openPersonalInvoiceModal(p)}
                            style={{
                              padding: "6px 12px",
                              fontSize: 12,
                              fontWeight: 700,
                              border: "1px solid #3B82C4",
                              borderRadius: 8,
                              background: "white",
                              color: "#3B82C4",
                              cursor: manualInvoicingId === p.id ? "default" : "pointer",
                              opacity: manualInvoicingId === p.id ? 0.6 : 1,
                            }}
                          >
                            {manualInvoicingId === p.id ? "발행 중..." : "인보이스 발행"}
                          </button>
                          <button
                            type="button"
                            disabled={resendingId === p.id}
                            onClick={() => handleResendInvoice(p)}
                            style={{
                              padding: "6px 12px",
                              fontSize: 12,
                              fontWeight: 700,
                              border: "1px solid #e5eaf2",
                              borderRadius: 8,
                              background: "white",
                              color: "#5b7699",
                              cursor: resendingId === p.id ? "default" : "pointer",
                              opacity: resendingId === p.id ? 0.6 : 1,
                            }}
                          >
                            {resendingId === p.id ? "재전송 중..." : "인보이스 재전송"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleHidePersonalPayment(p)}
                            style={{
                              padding: "6px 12px",
                              fontSize: 12,
                              fontWeight: 700,
                              border: "1px solid #f3c6c2",
                              borderRadius: 8,
                              background: "white",
                              color: "#b3261e",
                              cursor: "pointer",
                            }}
                          >
                            숨기기
                          </button>
                        </div>
                        {manuallyInvoiced[p.id] && (
                          <div style={{ fontSize: 12, color: "#5b7699", marginTop: 4 }}>{manuallyInvoiced[p.id]}</div>
                        )}
                        {resendNote[p.id] && (
                          <div style={{ fontSize: 12, color: "#5b7699", marginTop: 4 }}>{resendNote[p.id]}</div>
                        )}
                      </div>
                    );
                    });
                  })()}
                </div>
              )}
            </div>
          </>
        )}

        <div style={{ textAlign: "center", padding: "16px 18px", fontSize: 13 }}>
          <Link href="/dashboard" style={{ color: BLUE, fontWeight: 700, textDecoration: "none" }}>
            ← 관리자 홈으로
          </Link>
        </div>
      </div>

      {/* ===================== 입금확인 모달 ===================== */}
      {modalPayment && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(20,35,60,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}
          onClick={closeConfirmModal}
        >
          <div style={{ background: "white", borderRadius: 16, padding: 20, width: "100%", maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#1b3a63", marginBottom: 6 }}>
              입금 확인 · 인보이스 발급
            </div>

              <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", display: "block", marginBottom: 6 }}>
                인보이스 번호 (선택, 비워두면 자동 생성)
              </label>
              <input
                type="text"
                value={invoiceNumberDraft}
                onChange={(e) => setInvoiceNumberDraft(e.target.value)}
                placeholder={nextInvoiceNumberPreview ? `비워두면 ${nextInvoiceNumberPreview} 로 자동 생성` : "예: 2026-001"}
                style={{
                  width: "100%",
                  padding: 10,
                  fontSize: 13,
                  border: "1px solid #e5eaf2",
                  borderRadius: 8,
                  boxSizing: "border-box",
                  marginBottom: 14,
                }}
              />
            <p style={{ fontSize: 13, color: "#8ea0b8", marginTop: 0 }}>
              {modalPayment.members?.name || "회원"}님 · {modalPayment.membership_plans?.name} ·{" "}
              <strong style={{ color: "#1b3a63" }}>{modalPayment.total_amount} EUR</strong>
            </p>

            <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63" }}>인보이스 항목 설명 (Description)</label>
            <textarea
              value={descriptionDraft}
              onChange={(e) => setDescriptionDraft(e.target.value)}
              rows={3}
              style={{ width: "100%", marginTop: 6, padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 10, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
            />
            <p style={{ fontSize: 12, color: "#aab9cc", marginTop: 4 }}>
              보통 자동으로 채워진 이번 달 문구 그대로 발급하면 됩니다. 필요할 때만 수정해주세요.
              (회차·금액은 자동 계산되어 여기서 바뀌지 않습니다)
            </p>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => handleConfirm(modalPayment, descriptionDraft, invoiceNumberDraft)}
                style={{ flex: 1, padding: "12px 16px", fontSize: 14, fontWeight: 700, border: "none", borderRadius: 10, background: BLUE, color: "white", cursor: "pointer" }}
              >
                이대로 발급
              </button>
              <button
                type="button"
                onClick={closeConfirmModal}
                style={{ padding: "12px 16px", fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 10, background: "white", color: "#5b7699", cursor: "pointer" }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== 개인레슨 인보이스 발행 확인/수정 모달 ===================== */}
      {pimPayment && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(20,35,60,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}
          onClick={closePersonalInvoiceModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "white", borderRadius: 16, padding: 24, width: "100%", maxWidth: 420, maxHeight: "90vh", overflowY: "auto" }}
          >
            <div style={{ fontWeight: 800, fontSize: 16, color: "#1b3a63", marginBottom: 4 }}>
              인보이스 발행 · 정보 확인
            </div>
            <div style={{ fontSize: 12, color: "#8ea0b8", marginBottom: 16 }}>
              발급 전에 이름/이메일/주소가 맞는지 확인하고, 틀린 부분은 고쳐주세요.
            </div>

            <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", display: "block", marginBottom: 6 }}>이름</label>
            <input
              type="text"
              value={pimName}
              onChange={(e) => setPimName(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 8, marginBottom: 10 }}
            />

            <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", display: "block", marginBottom: 6 }}>영문 이름 (인보이스 표기용, 필수)</label>
            <input
              type="text"
              value={pimNameEn}
              onChange={(e) => setPimNameEn(e.target.value)}
              placeholder="예: Haohua Wang"
              style={{ width: "100%", boxSizing: "border-box", padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 8, marginBottom: 10 }}
            />

            <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", display: "block", marginBottom: 6 }}>이메일</label>
            <input
              type="email"
              value={pimEmail}
              onChange={(e) => setPimEmail(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 8, marginBottom: 10 }}
            />

            <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", display: "block", marginBottom: 6 }}>
              주소 (250유로 이상 인보이스는 독일 법상 필수)
            </label>
            <input
              type="text"
              value={pimAddressStreet}
              onChange={(e) => setPimAddressStreet(e.target.value)}
              placeholder="거리명, 번지"
              style={{ width: "100%", boxSizing: "border-box", padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 8, marginBottom: 8 }}
            />
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input
                type="text"
                value={pimAddressZip}
                onChange={(e) => setPimAddressZip(e.target.value)}
                placeholder="우편번호"
                style={{ width: 110, boxSizing: "border-box", padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 8 }}
              />
              <input
                type="text"
                value={pimAddressCity}
                onChange={(e) => setPimAddressCity(e.target.value)}
                placeholder="도시"
                style={{ flex: 1, boxSizing: "border-box", padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 8 }}
              />
            </div>
            {Number(pimPayment?.total_amount) >= 250 && !pimAddressStreet.trim() && (
              <div style={{ background: "#fff4e5", color: "#c07a1e", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 10 }}>
                250유로 이상 결제입니다 — 독일 세법상 인보이스에 주소가 필요해요.
              </div>
            )}

            <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", display: "block", marginBottom: 6 }}>인보이스 항목 설명</label>
            <textarea
              value={pimDescription}
              onChange={(e) => setPimDescription(e.target.value)}
              rows={2}
              style={{ width: "100%", boxSizing: "border-box", padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 8, marginBottom: 10, fontFamily: "inherit" }}
            />

            <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", display: "block", marginBottom: 6 }}>
              인보이스 번호 (선택, 비워두면 자동 생성)
            </label>
            <input
              type="text"
              value={pimInvoiceNumber}
              onChange={(e) => setPimInvoiceNumber(e.target.value)}
              placeholder={nextInvoiceNumberPreview ? `비워두면 ${nextInvoiceNumberPreview} 로 자동 생성` : "예: 2026-001"}
              style={{ width: "100%", boxSizing: "border-box", padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 8, marginBottom: 10 }}
            />

            <div style={{ fontSize: 12, color: "#8ea0b8", marginBottom: 10 }}>
              금액: {pimPayment?.total_amount} EUR (VAT 포함)
            </div>

            {pimError && (
              <div style={{ background: "#fdecec", color: "#b3261e", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 10 }}>
                {pimError}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button
                type="button"
                disabled={pimSaving}
                onClick={handleConfirmPersonalInvoice}
                style={{ flex: 1, padding: "12px 16px", fontSize: 14, fontWeight: 700, border: "none", borderRadius: 10, background: BLUE, color: "white", cursor: pimSaving ? "default" : "pointer", opacity: pimSaving ? 0.6 : 1 }}
              >
                {pimSaving ? "처리 중..." : "확인하고 발행"}
              </button>
              <button
                type="button"
                onClick={closePersonalInvoiceModal}
                disabled={pimSaving}
                style={{ padding: "12px 16px", fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 10, background: "white", color: "#5b7699", cursor: "pointer" }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function InvoiceRow({ inv, idx, openingPdfPath, handleOpenInvoicePdf }) {
  return (
    <div style={{ padding: "12px 0", borderTop: idx === 0 ? "none" : "1px solid #f0f3f8", fontSize: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
        <div>
          <span style={{ color: "#1b3a63", fontWeight: 700 }}>{inv.invoice_number}</span>
          <span style={{ color: "#33455e", marginLeft: 8 }}>
            {inv.payments?.members?.name} · {inv.payments?.membership_plans?.name}
          </span>
        </div>
        {inv.pdf_url && (
          <button
            type="button"
            onClick={() => handleOpenInvoicePdf(inv.id)}
            disabled={openingPdfPath === inv.id}
            style={{
              color: BLUE,
              fontWeight: 700,
              fontSize: 12,
              background: "none",
              border: "none",
              cursor: openingPdfPath === inv.id ? "default" : "pointer",
              padding: 0,
            }}
          >
            {openingPdfPath === inv.id ? "여는 중..." : "PDF 보기"}
          </button>
        )}
      </div>
      <div style={{ color: "#8ea0b8", fontSize: 12, marginTop: 4 }}>
        발행일: {inv.issued_at ? new Date(inv.issued_at).toLocaleDateString("ko-KR", { timeZone: "Europe/Berlin" }) : "-"} · 금액: {inv.total_amount} EUR
      </div>
    </div>
  );
}
