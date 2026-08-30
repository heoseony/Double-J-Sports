"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";
import LoadingScreen from "../../../components/LoadingScreen";
import { useLanguage } from "../../../../lib/i18n/LanguageContext";

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

  async function handleSubmit(e) {
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
                  {p.membership_plans?.name} ·{" "}
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
                    {t("subscribe.planOptionFormat", { name: p.name, sessions: p.sessions_per_month, price: p.price, currency: p.currency })}
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
    </main>
  );
}
