"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { nowInGermany } from "../../../lib/germanyTime";
import { supabase } from "../../../lib/supabaseClient";
import LoadingScreen from "../../components/LoadingScreen";
import { confirmDialog } from "../../components/ConfirmModal";

const BLUE = "#3B82C4";
const WEEKDAY = { 1: "월", 2: "화", 3: "수", 4: "목", 5: "금", 6: "토", 0: "일" };
const REGION_LABEL = { dusseldorf: "뒤셀도르프", frankfurt: "프랑크푸르트" };

function pad2(n) {
  return String(n).padStart(2, "0");
}
function todayStr() {
  const d = nowInGermany();
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
function classLabel(c) {
  return `${c.class_name} · ${WEEKDAY[c.weekday] ?? ""} ${(c.start_time || "").slice(0, 5)}`;
}

export default function AdminRosterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [roster, setRoster] = useState([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function init() {
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
        .maybeSingle();
      if (!profile || profile.role !== "admin") {
        router.push("/dashboard");
        return;
      }

      const { data: cls } = await supabase
        .from("classes")
        .select("id, class_name, region, weekday, start_time, auto_enroll_region_members, active")
        .eq("active", true)
        .eq("region", "dusseldorf")
        .order("region", { ascending: true })
        .order("weekday", { ascending: true })
        .order("start_time", { ascending: true });
      setClasses(cls || []);

      const { data: mems } = await supabase
        .from("members")
        .select("id, name, region, status, is_test")
        .order("name", { ascending: true })
        .limit(3000);
      setAllMembers((mems || []).filter((m) => m.status === "active" && !m.is_test));

      if (cls && cls.length > 0) setSelectedClassId(cls[0].id);
      setLoading(false);
    }
    init();
  }, [router]);

  useEffect(() => {
    if (selectedClassId) loadRoster(selectedClassId);
  }, [selectedClassId]);

  async function loadRoster(classId) {
    const { data, error } = await supabase
      .from("class_fixed_roster")
      .select("member_id, members(id, name, region)")
      .eq("class_id", classId);
    if (error) {
      setErrorMsg("명단을 불러오지 못했습니다: " + error.message);
      return;
    }
    const rows = (data || [])
      .map((r) => r.members)
      .filter(Boolean)
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ko"));
    setRoster(rows);
  }

  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const rosterIds = new Set(roster.map((m) => m.id));
  const q = query.trim().toLowerCase();
  const candidates = q
    ? allMembers
        .filter((m) => !rosterIds.has(m.id) && (m.name || "").toLowerCase().includes(q))
        .sort((a, b) => {
          const ra = selectedClass && a.region === selectedClass.region ? 0 : 1;
          const rb = selectedClass && b.region === selectedClass.region ? 0 : 1;
          return ra - rb;
        })
        .slice(0, 15)
    : [];

  async function handleAdd(member) {
    setBusy(true);
    setMsg("");
    setErrorMsg("");
    const { error } = await supabase
      .from("class_fixed_roster")
      .insert({ class_id: selectedClassId, member_id: member.id });
    if (error) {
      setErrorMsg("추가하지 못했습니다: " + error.message);
    } else {
      setMsg(`${member.name} 님을 명단에 추가했어요. 앞으로 남은 회차에도 예약됩니다.`);
      setQuery("");
      await loadRoster(selectedClassId);
    }
    setBusy(false);
  }

  async function handleRemove(member) {
    const ok = await confirmDialog({
      title: "명단에서 빼기",
      message: `${member.name} 님을 이 수업의 고정 명단에서 뺄까요?`,
      keepLabel: "취소",
      goLabel: "명단에서 빼기",
    });
    if (!ok) return;
    const delFuture = await confirmDialog({
      title: "앞으로 남은 예약",
      message:
        "앞으로 남은 회차의 예약도 같이 지울까요? 이미 출석·결석 처리된 기록은 지우지 않아요.",
      keepLabel: "예약은 그대로 두기",
      goLabel: "예약도 삭제",
    });

    setBusy(true);
    setMsg("");
    setErrorMsg("");

    const { error } = await supabase
      .from("class_fixed_roster")
      .delete()
      .eq("class_id", selectedClassId)
      .eq("member_id", member.id);
    if (error) {
      setErrorMsg("빼지 못했습니다: " + error.message);
      setBusy(false);
      return;
    }

    let removedBookings = 0;
    if (delFuture) {
      const { data: sessions } = await supabase
        .from("class_sessions")
        .select("id")
        .eq("class_id", selectedClassId)
        .gte("session_date", todayStr());
      const ids = (sessions || []).map((s) => s.id);
      if (ids.length > 0) {
        const { data: deleted, error: delErr } = await supabase
          .from("bookings")
          .delete()
          .eq("member_id", member.id)
          .eq("status", "booked")
          .in("class_session_id", ids)
          .select("id");
        if (delErr) {
          setErrorMsg("명단에서는 뺐지만 예약을 지우지 못했습니다: " + delErr.message);
        } else {
          removedBookings = (deleted || []).length;
        }
      }
    }

    setMsg(
      delFuture
        ? `${member.name} 님을 명단에서 뺐어요. 남은 예약 ${removedBookings}건도 삭제했어요.`
        : `${member.name} 님을 명단에서 뺐어요. 남은 예약은 그대로 두었어요.`
    );
    await loadRoster(selectedClassId);
    setBusy(false);
  }

  if (loading) return <LoadingScreen text="확인 중..." />;

  return (
    <main
      style={{
        background: "#f3f7fc",
        minHeight: "100vh",
        paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "20px 16px" }}>
        <Link href="/more" style={{ fontSize: 13, color: "#8ea0b8", textDecoration: "none" }}>
          ← 뒤로
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1f2a3d", margin: "8px 0 4px" }}>
          고정 명단 관리
        </h1>
        <p style={{ fontSize: 13, color: "#8ea0b8", margin: "0 0 16px", lineHeight: 1.5 }}>
          명단에 넣은 아이들은 새 수업 회차가 만들어질 때 자동으로 예약돼요.
        </p>

        <select
          value={selectedClassId}
          onChange={(e) => {
            setSelectedClassId(e.target.value);
            setMsg("");
            setErrorMsg("");
            setQuery("");
          }}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #dbe4f0",
            background: "#fff",
            fontSize: 15,
            marginBottom: 12,
          }}
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {(REGION_LABEL[c.region] || c.region) + " · " + classLabel(c)}
            </option>
          ))}
        </select>

        {selectedClass?.auto_enroll_region_members ? (
          <div
            style={{
              background: "#fef6e0",
              color: "#a87a14",
              borderRadius: 12,
              padding: "10px 12px",
              fontSize: 13,
              lineHeight: 1.5,
              marginBottom: 12,
            }}
          >
            이 수업은 지역 전체 자동 등록도 켜져 있어요. 같은 지역의 활성 회원이 모두 자동으로 예약됩니다.
          </div>
        ) : null}

        {msg ? (
          <div style={{ background: "#e9f8f0", color: "#2ea86e", borderRadius: 12, padding: "10px 12px", fontSize: 13, marginBottom: 12 }}>
            {msg}
          </div>
        ) : null}
        {errorMsg ? (
          <div style={{ background: "#fdecec", color: "#d64545", borderRadius: 12, padding: "10px 12px", fontSize: 13, marginBottom: 12 }}>
            {errorMsg}
          </div>
        ) : null}

        <div style={{ background: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, boxShadow: "0 1px 4px rgba(31,42,61,0.06)" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#1f2a3d", marginBottom: 10 }}>
            현재 명단 ({roster.length}명)
          </div>
          {roster.length === 0 ? (
            <div style={{ fontSize: 13, color: "#8ea0b8" }}>명단이 비어 있어요.</div>
          ) : (
            roster.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderTop: "1px solid #eef2f8",
                }}
              >
                <div>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "#1f2a3d" }}>{m.name}</span>
                  <span style={{ fontSize: 12, color: "#8ea0b8", marginLeft: 8 }}>
                    {REGION_LABEL[m.region] || m.region}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleRemove(m)}
                  style={{
                    border: "1px solid #f3c7c7",
                    background: "#fff",
                    color: "#d64545",
                    borderRadius: 10,
                    padding: "6px 12px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  빼기
                </button>
              </div>
            ))
          )}
        </div>

        <div style={{ background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 1px 4px rgba(31,42,61,0.06)" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#1f2a3d", marginBottom: 10 }}>
            명단에 추가
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="회원 이름 검색"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #dbe4f0",
              fontSize: 15,
              marginBottom: 8,
            }}
          />
          {q && candidates.length === 0 ? (
            <div style={{ fontSize: 13, color: "#8ea0b8" }}>검색 결과가 없어요.</div>
          ) : null}
          {candidates.map((m) => (
            <div
              key={m.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 0",
                borderTop: "1px solid #eef2f8",
              }}
            >
              <div>
                <span style={{ fontSize: 15, fontWeight: 600, color: "#1f2a3d" }}>{m.name}</span>
                <span style={{ fontSize: 12, color: "#8ea0b8", marginLeft: 8 }}>
                  {REGION_LABEL[m.region] || m.region}
                </span>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleAdd(m)}
                style={{
                  border: "none",
                  background: BLUE,
                  color: "#fff",
                  borderRadius: 10,
                  padding: "6px 14px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                추가
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
