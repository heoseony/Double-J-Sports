"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

const BLUE = "#3B82C4";

const FIELDS = [
  { key: "bank_name", label: "은행명" },
  { key: "account_holder", label: "예금주" },
  { key: "iban", label: "IBAN" },
  { key: "bic", label: "BIC" },
  { key: "company_name", label: "회사명 (인보이스용)" },
  { key: "company_address", label: "회사 주소 (인보이스용)" },
  { key: "company_vat_id", label: "사업자번호 / VAT ID (인보이스용)" },
];

export default function AdminPaymentSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [settingsId, setSettingsId] = useState(null);
  const [form, setForm] = useState({
    bank_name: "",
    account_holder: "",
    iban: "",
    bic: "",
    company_name: "",
    company_address: "",
    company_vat_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    async function load() {
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

      const { data: settingsData } = await supabase
        .from("payment_settings")
        .select(
          "id, bank_name, account_holder, iban, bic, company_name, company_address, company_vat_id"
        )
        .limit(1)
        .maybeSingle();

      if (settingsData) {
        setSettingsId(settingsData.id);
        setForm({
          bank_name: settingsData.bank_name || "",
          account_holder: settingsData.account_holder || "",
          iban: settingsData.iban || "",
          bic: settingsData.bic || "",
          company_name: settingsData.company_name || "",
          company_address: settingsData.company_address || "",
          company_vat_id: settingsData.company_vat_id || "",
        });
      }

      setLoading(false);
    }

    load();
  }, [router]);

  function handleChange(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setSaving(true);

    let error;

    if (settingsId) {
      const { error: updateError } = await supabase
        .from("payment_settings")
        .update(form)
        .eq("id", settingsId);
      error = updateError;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("payment_settings")
        .insert(form)
        .select()
        .single();
      error = insertError;
      if (inserted) setSettingsId(inserted.id);
    }

    setSaving(false);

    if (error) {
      setErrorMsg("저장 실패: " + error.message);
      return;
    }

    setSuccessMsg("저장되었습니다.");
  }

  if (loading || !isAdmin) {
    return (
      <main style={{ minHeight: "100vh", background: "#f3f7fc", padding: 20 }}>
        <div style={{ fontSize: 14, color: "#5b7699" }}>확인 중...</div>
      </main>
    );
  }

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
    fontSize: 15,
    border: "1px solid #e5eaf2",
    borderRadius: 10,
    background: "#f7fafd",
    marginBottom: 14,
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
        <Link href="/dashboard" style={{ color: "#1b3a63", display: "flex" }}>
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
          결제 계좌 · 회사정보 설정
        </div>
      </div>

      <div style={{ padding: "10px 18px 0" }}>
        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 18,
            boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
          }}
        >
          <p style={{ fontSize: 13, color: "#8ea0b8", marginTop: 0, marginBottom: 16 }}>
            회원권 신청 화면과 Invoice 발급에 사용되는 정보입니다.
          </p>

          <form onSubmit={handleSubmit}>
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label style={labelStyle}>{f.label}</label>
                <input
                  type="text"
                  value={form[f.key]}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  style={inputStyle}
                />
              </div>
            ))}

            {errorMsg && (
              <div
                style={{
                  background: "#fdecec",
                  color: "#b3261e",
                  padding: 12,
                  borderRadius: 10,
                  fontSize: 13,
                  marginBottom: 14,
                }}
              >
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div
                style={{
                  background: "#e9f1fb",
                  color: "#1b3a63",
                  padding: 12,
                  borderRadius: 10,
                  fontSize: 13,
                  marginBottom: 14,
                }}
              >
                {successMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              style={{
                width: "100%",
                padding: 14,
                fontSize: 15,
                fontWeight: 700,
                color: "white",
                background: saving ? "#9db8d6" : BLUE,
                border: "none",
                borderRadius: 10,
                cursor: saving ? "default" : "pointer",
              }}
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </form>
        </div>

        <div style={{ textAlign: "center", padding: "16px 18px", fontSize: 13 }}>
          <Link href="/dashboard" style={{ color: BLUE, fontWeight: 700, textDecoration: "none" }}>
            ← 대시보드로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}
