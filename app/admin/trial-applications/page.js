"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import LoadingScreen from "../../components/LoadingScreen";

const BLUE = "#3B82C4";

const PROGRAM_LABEL = {
  pro: "프로",
  academy: "아카데미",
  women: "여성 취미반",
  men: "남성 취미반",
  private: "1:1 개인 코칭",
};

const STATUS = {
  new: { label: "신규", bg: "#fdecea", color: "#e53935" },
  contacted: { label: "연락함", bg: "#fef6e0", color: "#b7791f" },
  done: { label: "등록 완료", bg: "#e9f8f0", color: "#2ea86e" },
  cancelled: { label: "취소/보류", bg: "#eef0f3", color: "#7b8794" },
};

const FILTERS = [
  { key: "all", label: "전체" },
  { key: "new", label: "신규" },
  { key: "contacted", label: "연락함" },
  { key: "done", label: "등록 완료" },
  { key: "cancelled", label: "취소/보류" },
];

function fmt(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function TrialApplicationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [memos, setMemos] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function load() {
    const { data, error } = await supabase
      .from("trial_applications")
      .select("id, created_at, name, contact, country, program, message, locale, status, admin_memo")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) {
      setErrorMsg("불러오기 실패: " + error.message);
      return;
    }
    setItems(data || []);
    const m = {};
    (data || []).forEach((x) => {
      m[x.id] = x.admin_memo || "";
    });
    setMemos(m);
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
      await load();
      setLoading(false);
    }
    check();
  }, [router]);

  async function setStatus(id, status) {
    setBusyId(id);
    setErrorMsg("");
    const { error } = await supabase
      .from("trial_applications")
      .update({ status, handled_at: status === "new" ? null : new Date().toISOString() })
      .eq("id", id);
    setBusyId(null);
    if (error) {
      setErrorMsg("저장 실패: " + error.message);
      return;
    }
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
  }

  async function saveMemo(id) {
    setBusyId(id);
    setErrorMsg("");
    const { error } = await supabase
      .from("trial_applications")
      .update({ admin_memo: (memos[id] || "").trim() || null })
      .eq("id", id);
    setBusyId(null);
    if (error) setErrorMsg("메모 저장 실패: " + error.message);
  }

  async function remove(id) {
    if (!window.confirm("이 신청을 삭제할까요? 되돌릴 수 없어요.")) return;
    setBusyId(id);
    const { error } = await supabase.from("trial_applications").delete().eq("id", id);
    setBusyId(null);
    if (error) {
      setErrorMsg("삭제 실패: " + error.message);
      return;
    }
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  if (loading || !isAdmin) {
    return <LoadingScreen text="확인 중..." />;
  }

  const shown = filter === "all" ? items : items.filter((x) => x.status === filter);
  const newCount = items.filter((x) => x.status === "new").length;

  return (
    <main style={{ background: "#f3f7fc", minHeight: "100vh", paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 18px 4px" }}>
        <Link href="/dashboard" style={{ color: "#1b3a63", display: "flex" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>체험수업 신청</div>
        {newCount > 0 && (
          <span style={{ background: "#e53935", color: "white", fontSize: 11, fontWeight: 800, borderRadius: 999, padding: "2px 8px" }}>
            신규 {newCount}
          </span>
        )}
      </div>

      <div style={{ padding: "10px 18px 0" }}>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 10 }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              style={{
                padding: "7px 13px",
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 999,
                border: filter === f.key ? "none" : "1px solid #e5eaf2",
                background: filter === f.key ? BLUE : "white",
                color: filter === f.key ? "white" : "#5b6b82",
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {errorMsg && <div style={{ fontSize: 13, color: "#b3261e", marginBottom: 10 }}>{errorMsg}</div>}

        {shown.length === 0 && (
          <div style={{ background: "white", borderRadius: 16, padding: 18, fontSize: 14, color: "#8ea0b8", boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
            신청 내역이 없습니다.
          </div>
        )}

        {shown.map((x) => {
          const st = STATUS[x.status] || STATUS.new;
          const isPhone = /^[0-9+\-\s()]{7,}$/.test(x.contact || "");
          const isMail = /@/.test(x.contact || "");
          return (
            <div key={x.id} style={{ background: "white", borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: "0 2px 10px rgba(30,60,110,0.06)", opacity: busyId === x.id ? 0.6 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>{x.name}</div>
                <span style={{ background: st.bg, color: st.color, fontSize: 11, fontWeight: 800, borderRadius: 999, padding: "3px 9px" }}>{st.label}</span>
              </div>
              <div style={{ fontSize: 12, color: "#8ea0b8", marginBottom: 10 }}>
                {fmt(x.created_at)}
                {x.locale ? ` · ${x.locale}` : ""}
              </div>
              <div style={{ fontSize: 14, color: "#33445c", lineHeight: 1.7 }}>
                <div>
                  <b>연락처</b>{" "}
                  {isPhone ? (
                    <a href={`tel:${x.contact.replace(/\s/g, "")}`} style={{ color: BLUE }}>{x.contact}</a>
                  ) : isMail ? (
                    <a href={`mailto:${x.contact}`} style={{ color: BLUE }}>{x.contact}</a>
                  ) : (
                    x.contact
                  )}
                </div>
                {x.country && (<div><b>국가</b> {x.country}</div>)}
                <div><b>희망 프로그램</b> {PROGRAM_LABEL[x.program] || x.program}</div>
                {x.message && (<div style={{ whiteSpace: "pre-wrap" }}><b>문의</b> {x.message}</div>)}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                {Object.keys(STATUS).map((k) => (
                  <button
                    key={k}
                    type="button"
                    disabled={busyId === x.id || x.status === k}
                    onClick={() => setStatus(x.id, k)}
                    style={{
                      padding: "7px 11px",
                      fontSize: 12,
                      fontWeight: 700,
                      borderRadius: 8,
                      border: x.status === k ? "none" : "1px solid #e5eaf2",
                      background: x.status === k ? STATUS[k].bg : "white",
                      color: x.status === k ? STATUS[k].color : "#5b6b82",
                      cursor: x.status === k ? "default" : "pointer",
                    }}
                  >
                    {STATUS[k].label}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <input
                  type="text"
                  value={memos[x.id] || ""}
                  onChange={(e) => setMemos((p) => ({ ...p, [x.id]: e.target.value }))}
                  placeholder="메모 (예: 토요일 오전 상담 예정)"
                  style={{ flex: 1, padding: 10, fontSize: 13, border: "1px solid #e5eaf2", borderRadius: 8, boxSizing: "border-box" }}
                />
                <button
                  type="button"
                  onClick={() => saveMemo(x.id)}
                  disabled={busyId === x.id}
                  style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "white", background: BLUE, border: "none", borderRadius: 8, cursor: "pointer" }}
                >
                  저장
                </button>
              </div>

              <div style={{ textAlign: "right", marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => remove(x.id)}
                  style={{ border: "none", background: "none", color: "#b3261e", fontSize: 12, cursor: "pointer" }}
                >
                  삭제
                </button>
              </div>
            </div>
          );
        })}

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <Link href="/dashboard" style={{ color: BLUE, fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
            ← 관리자 홈으로
          </Link>
        </div>
      </div>
    </main>
  );
}
