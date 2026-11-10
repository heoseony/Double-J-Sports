"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";
import LoadingScreen from "../../../components/LoadingScreen";
import { useLanguage } from "../../../../lib/i18n/LanguageContext";
import { translatePlanName } from "../../../../lib/i18n/nameTranslations";

const BLUE = "#3B82C4";
const COUPON_AMOUNT = 20;

export default function SubscribePage() {
  const router = useRouter();
  const params = useParams();
  const memberId = params.id;
  const { t, lang } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState(null);
  const [plans, setPlans] = useState([]);
  const [settings, setSettings] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [planId, setPlanId] = useState("");
  const [depositorName, setDepositorName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);

  const [pendingPayments, setPendingPayments] = useState([]);

  const [availableCoupon, setAvailableCoupon] = useState(null);
  const [useCoupon, setUseCoupon] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function loadPendingPayments() {
    const { data } = await supabase
      .from("payments")
      .select("id, total_amount, depositor_name, status, requested_at, membership_plans(name)")
      .eq("member_id", memberId)
      .eq("status", "pending")
      .order("requested_at", { ascending: false });
    setPendingPayments(data || []);
  }

  async function loadAvailableCoupon() {
    const { data } = await supabase
      .from("coupons")
      .select("id, amount")
      .eq("member_id", memberId)
      .eq("used", false)
      .order("issued_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    setAvailableCoupon(data || null);
  }

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: memberData, error: memberError } = await supabase
        .from("members")
        .select("id, name, program")
        .eq("id", memberId)
        .single();

      if (memberError || !memberData) {
        setErrorMsg(t("subscribe.errMemberNotFound"));
        setLoading(false);
        return;
      }
      setMember(memberData);

      const { data: planData } = await supabase
        .from("membership_plans")
        .select("id, name, program, sessions_per_month, price, currency")
        .eq("active", true)
        .eq("program", memberData.program)
        .order("price", { ascending: true });
      setPlans(planData || []);

      const { data: settingsData } = await supabase
        .from("payment_settings")
        .select("bank_name, account_holder, iban, bic")
        .single();
      setSettings(settingsData);

      await loadPendingPayments();
      await loadAvailableCoupon();
      setLoading(false);
    }

    load();
  }, [router, memberId]);

  const selectedPlan = plans.find((p) => p.id === planId);
  const rawPrice = selectedPlan ? Number(selectedPlan.price) : 0;
  const discount = useCoupon && availableCoupon ? Math.min(COUPON_AMOUNT, rawPrice) : 0;
  const finalPrice = Math.max(rawPrice - discount, 0);

  // 신청하기 버튼: 입력 확인 후 안내 모달을 먼저 띄운다
  function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");

    if (!planId || !depositorName.trim()) {
      setErrorMsg(t("subscribe.errFillRequired"));
      return;
    }

    const plan = plans.find((p) => p.id === planId);
    if (!plan) {
      setErrorMsg(t("subscribe.errPlanNotFound"));
      return;
    }

    setShowConfirm(true);
  }

  // 모달에서 "확인하고 신청하기"를 누르면 실제 신청 처리
  async function doSubmit() {
    setErrorMsg("");

    if (!planId || !depositorName.trim()) {
      setShowConfirm(false);
      setErrorMsg(t("subscribe.errFillRequired"));
      return;
    }

    const plan = plans.find((p) => p.id === planId);
    if (!plan) {
      setShowConfirm(false);
      setErrorMsg(t("subscribe.errPlanNotFound"));
      return;
    }

    setSubmitting(true);

    const totalAmount = finalPrice;
    const netAmount = Math.round((totalAmount / 1.19) * 100) / 100;
    const vatAmount = Math.round((totalAmount - netAmount) * 100) / 100;
    const appliedCouponId = useCoupon && availableCoupon ? availableCoupon.id : null;

    const { data: paymentData, error } = await supabase
      .from("payments")
      .insert({
        member_id: memberId,
        plan_id: planId,
        depositor_name: depositorName.trim(),
        total_amount: totalAmount,
        net_amount: netAmount,
        vat_amount: vatAmount,
        status: "pending",
        coupon_id: appliedCouponId,
        discount_amount: discount,
      })
      .select()
      .single();

    if (error) {
      setSubmitting(false);
      setShowConfirm(false);
      setErrorMsg(t("subscribe.errSubmitFailedPrefix") + error.message);
      return;
    }

    if (appliedCouponId) {
      await supabase
        .from("coupons")
        .update({ used: true, used_at: new Date().toISOString(), payment_id: paymentData.id })
        .eq("id", appliedCouponId);
    }

    setSubmitting(false);
    setShowConfirm(false);
    setSubmitted({ ...paymentData, planName: plan.name });
    setPlanId("");
    setDepositorName("");
    setUseCoupon(false);
    await loadPendingPayments();
    await loadAvailableCoupon();
  }

  if (loading) {
    return <LoadingScreen />;
  }

  if (errorMsg && !member) {
    return (
      <main style={{ minHeight: "100vh", background: "#f3f7fc", padding: 20 }}>
        <div
          style={{
            background: "#fdecec",
            color: "#b3261e",
            padding: 12,
            borderRadius: 10,
            fontSize: 13,
          }}
        >
          {errorMsg}
        </div>
      </main>
    );
  }

  const selectStyle = {
    width: "100%",
    padding: 14,
    fontSize: 16,
    border: "1px solid #e5eaf2",
    borderRadius: 10,
    background: "#f7fafd",
    marginBottom: 12,
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  const labelStyle = {
    fontSize: 13,
    fontWeight: 700,
    color: "#1b3a63",
    display: "block",
    marginBottom: 6,
  };

  const inputStyle = {
    width: "100%",
    padding: 14,
    fontSize: 16,
    border: "1px solid #e5eaf2",
    borderRadius: 10,
    background: "#f7fafd",
    marginBottom: 4,
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  return (
    <main
      style={{
        background: "#f3f7fc",
        minHeight: "100vh",
        paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "18px 18px 4px",
        }}
      >
        <Link href="/members" style={{ color: "#1b3a63", display: "flex" }}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>
          {t("subscribe.title", { name: member?.name })}
        </div>
      </div>

      <div style={{ padding: "10px 18px 0" }}>
        {submitted && (
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: 18,
              marginBottom: 16,
              boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
              border: "1px solid #d9ecdd",
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 15,
                color: "#1b7a45",
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {t("subscribe.submittedTitle")}
            </div>
            <p style={{ fontSize: 14, margin: 0, lineHeight: 1.6, color: "#33455e" }}>
              {t("subscribe.body1")}<strong style={{ color: "#1b3a63" }}>{submitted.total_amount} EUR</strong>{t("subscribe.body2")}{" "}
              <strong style={{ color: "#1b3a63" }}>"{submitted.depositor_name}"</strong>{t("subscribe.body3")}
            </p>
            <div
              style={{
                background: "#fff6e0",
                border: "1px solid #f3d38a",
                color: "#7a5200",
                padding: 12,
                borderRadius: 10,
                fontSize: 13,
                lineHeight: 1.6,
                fontWeight: 600,
                marginTop: 12, marginBottom: 0,
              }}
            >
              {t("subscribe.nextMonthNotice")}
            </div>
            <div
              style={{
                color: "#d32f2f",
                fontSize: 14,
                fontWeight: 800,
                lineHeight: 1.7,
                marginTop: 12,
              }}
            >
              {lang === "en" ? (
                <>
                  Please enter the invoice number (Rechnungsnummer) in the payment reference field (Verwendungszweck) when you transfer.
                  <div style={{ fontWeight: 700, marginTop: 2 }}>
                    This is required so that we can confirm your payment smoothly.
                  </div>
                </>
              ) : (
                <>
                  입금 시 송금 메모란(Verwendungszweck)에 반드시 인보이스 번호(Rechnungsnummer)를 기재해 주시기 바랍니다.
                  <div style={{ fontWeight: 700, marginTop: 2 }}>원활한 입금 확인을 위해 꼭 필요합니다.</div>
                </>
              )}
            </div>
            {Number(submitted.discount_amount) > 0 && (
              <p style={{ fontSize: 13, color: BLUE, marginTop: 8, marginBottom: 0, fontWeight: 700 }}>
                {t("subscribe.couponAppliedMsg", { amount: submitted.discount_amount })}
              </p>
            )}
            <div
              style={{
                marginTop: 12,
                padding: 14,
                background: "#f7fafd",
                borderRadius: 12,
                fontSize: 14,
                lineHeight: 1.9,
                color: "#1b3a63",
              }}
            >
              <div>{t("subscribe.bankLabel")}{settings?.bank_name || "-"}</div>
              <div>{t("subscribe.accountHolderLabel")}{settings?.account_holder || "-"}</div>
              <div>IBAN: {settings?.iban || "-"}</div>
              <div>BIC: {settings?.bic || "-"}</div>
            </div>
            <p style={{ fontSize: 12, color: "#8ea0b8", marginTop: 10, marginBottom: 0 }}>
              {t("subscribe.invoiceNotice")}
            </p>
          </div>
        )}

        {pendingPayments.length > 0 && (
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: 18,
              marginBottom: 16,
              boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 15, color: "#1b3a63", marginBottom: 12 }}>
              {t("subscribe.pendingTitle")}
            </div>
            {pendingPayments.map((p, idx) => (
              <div
                key={p.id}
                style={{
                  padding: "12px 0",
                  borderTop: idx === 0 ? "none" : "1px solid #f0f3f8",
                  fontSize: 14,
                }}
              >
                <div style={{ color: "#33455e" }}>
                  {translatePlanName(p.membership_plans?.name, lang)} ·{" "}
                  <strong style={{ color: "#1b3a63" }}>{p.total_amount} EUR</strong>
                </div>
                <div style={{ color: "#8ea0b8", fontSize: 12, marginTop: 4 }}>
                  {t("subscribe.depositorLabelInline")}{p.depositor_name} · {t("subscribe.requestedLabelInline")}
                  {new Date(p.requested_at).toLocaleDateString(lang === "en" ? "en-US" : "ko-KR")}
                </div>
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 18,
            boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 15, color: "#1b3a63", marginBottom: 14 }}>
            {t("subscribe.newSubscriptionTitle")}
          </div>
          <div
              style={{
                background: "#fff6e0",
                border: "1px solid #f3d38a",
                color: "#7a5200",
                padding: 12,
                borderRadius: 10,
                fontSize: 13,
                lineHeight: 1.6,
                fontWeight: 600,
                marginBottom: 14,
              }}
            >
              {t("subscribe.nextMonthNotice")}
            </div>

          {plans.length === 0 ? (
            <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>
              {t("subscribe.noPlansAvailable")}
            </p>
          ) : (
            <form onSubmit={handleSubmit}>
              <label style={labelStyle}>{t("subscribe.selectPlanLabel")}</label>
              <select
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                style={selectStyle}
              >
                <option value="">{t("subscribe.selectPlaceholder")}</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {t("subscribe.planOptionFormat", { name: translatePlanName(p.name, lang), sessions: p.sessions_per_month, price: p.price, currency: p.currency })}
                  </option>
                ))}
              </select>

              {availableCoupon && pendingPayments.length === 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: 12,
                    background: "#e9f1fb",
                    borderRadius: 10,
                    marginBottom: 12,
                  }}
                >
                  <input
                    type="checkbox"
                    id="useCoupon"
                    checked={useCoupon}
                    onChange={(e) => setUseCoupon(e.target.checked)}
                    style={{ marginTop: 3, width: 18, height: 18 }}
                  />
                  <label htmlFor="useCoupon" style={{ fontSize: 13, color: "#1b3a63", cursor: "pointer" }}>
                    <strong>{t("subscribe.couponLabel")}</strong> {t("subscribe.couponDetail", { amount: availableCoupon.amount })}
                  </label>
                </div>
              )}

              {selectedPlan && (
                <div
                  style={{
                    padding: 14,
                    background: "#f7fafd",
                    borderRadius: 10,
                    marginBottom: 12,
                    fontSize: 14,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#5b7699" }}>
                    <span>{t("subscribe.planPriceLabel")}</span>
                    <span>{rawPrice} {selectedPlan.currency}</span>
                  </div>
                  {discount > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", color: BLUE, marginTop: 4 }}>
                      <span>{t("subscribe.couponDiscountLabel")}</span>
                      <span>- {discount} {selectedPlan.currency}</span>
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      color: "#1b3a63",
                      fontWeight: 700,
                      marginTop: 8,
                      paddingTop: 8,
                      borderTop: "1px solid #e5eaf2",
                    }}
                  >
                    <span>{t("subscribe.finalPriceLabel")}</span>
                    <span>{finalPrice} {selectedPlan.currency}</span>
                  </div>
                </div>
              )}

              <label style={labelStyle}>{t("subscribe.depositorNameLabel")}</label>
              <input
                type="text"
                value={depositorName}
                onChange={(e) => setDepositorName(e.target.value)}
                placeholder={t("subscribe.depositorNamePlaceholder")}
                style={inputStyle}
              />

              {errorMsg && (
                <div
                  style={{
                    background: "#fdecec",
                    color: "#b3261e",
                    padding: 12,
                    borderRadius: 10,
                    fontSize: 13,
                    marginTop: 10,
                  }}
                >
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: "100%",
                  marginTop: 16,
                  padding: 14,
                  fontSize: 15,
                  fontWeight: 700,
                  color: "white",
                  background: submitting ? "#9db8d6" : BLUE,
                  border: "none",
                  borderRadius: 10,
                  cursor: submitting ? "default" : "pointer",
                }}
              >
                {submitting ? t("subscribe.submitting") : t("subscribe.submit")}
              </button>
            </form>
          )}
        </div>

        <div style={{ textAlign: "center", padding: "16px 18px", fontSize: 13 }}>
          <Link href="/members" style={{ color: BLUE, fontWeight: 700, textDecoration: "none" }}>
            {t("subscribe.backToPlayers")}
          </Link>
        </div>
      </div>

      {showConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(20,35,60,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => {
            if (!submitting) setShowConfirm(false);
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: 20,
              width: "100%",
              maxWidth: 420,
              boxShadow: "0 8px 30px rgba(20,35,60,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 800, fontSize: 16, color: "#1b3a63", marginBottom: 12 }}>
              {lang === "en" ? "Please read before submitting" : "신청 전 꼭 확인해 주세요"}
            </div>

            <div
              style={{
                background: "#fff6e0",
                border: "1px solid #f3d38a",
                color: "#7a5200",
                padding: 14,
                borderRadius: 10,
                fontSize: 14,
                lineHeight: 1.7,
              }}
            >
              {lang === "en" ? (
                <>
                  <div style={{ fontWeight: 800 }}>
                    Please enter the invoice number in the payment reference field (Verwendungszweck) when you transfer.
                  </div>
                  <div style={{ marginTop: 4 }}>This is required so that we can confirm your payment smoothly.</div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 800 }}>
                    입금 시 송금 메모란(Verwendungszweck)에 반드시 인보이스 번호(Rechnungsnummer)를 기재해 주시기 바랍니다.
                  </div>
                  <div style={{ marginTop: 4 }}>원활한 입금 확인을 위해 꼭 필요합니다.</div>
                </>
              )}
            </div>

            <p style={{ fontSize: 13, color: "#33455e", lineHeight: 1.7, margin: "12px 0 0" }}>
              {lang === "en"
                ? "Invoices are issued starting on the 1st of each month. Please transfer after you receive the invoice."
                : "인보이스는 매월 1일부터 발급됩니다. 인보이스를 받으신 뒤 입금해 주세요."}
            </p>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={doSubmit}
                disabled={submitting}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  fontSize: 14,
                  fontWeight: 700,
                  border: "none",
                  borderRadius: 10,
                  background: submitting ? "#9db8d6" : BLUE,
                  color: "white",
                  cursor: submitting ? "default" : "pointer",
                }}
              >
                {submitting
                  ? lang === "en" ? "Submitting..." : "신청 중..."
                  : lang === "en" ? "Confirm and submit" : "확인하고 신청하기"}
              </button>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                style={{
                  padding: "12px 16px",
                  fontSize: 14,
                  border: "1px solid #e5eaf2",
                  borderRadius: 10,
                  background: "white",
                  color: "#5b7699",
                  cursor: "pointer",
                }}
              >
                {lang === "en" ? "Cancel" : "취소"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
