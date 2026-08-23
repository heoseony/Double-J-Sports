"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import LoadingScreen from "../../components/LoadingScreen";

const BLUE = "#3B82C4";

const inputStyle = {
  width: "100%",
  padding: 12,
  fontSize: 14,
  border: "1px solid #e5eaf2",
  borderRadius: 10,
  marginBottom: 10,
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const labelStyle = {
  fontSize: 13,
  fontWeight: 700,
  color: "#1b3a63",
  display: "block",
  marginBottom: 6,
};

export default function AdminPlansPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [plans, setPlans] = useState([]);
  const [classes, setClasses] = useState([]);
  const [planClassMap, setPlanClassMap] = useState({}); // plan_id -> [class_id,...]

  // 새 상품 생성 폼
  const [newName, setNewName] = useState("");
  const [newProgram, setNewProgram] = useState("kids");
  const [newSessions, setNewSessions] = useState(8);
  const [newPrice, setNewPrice] = useState(100);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editSessions, setEditSessions] = useState(0);
  const [editPrice, setEditPrice] = useState(0);
  const [editAllClasses, setEditAllClasses] = useState(true);
  const [editSelectedClassIds, setEditSelectedClassIds] = useState([]);
  const [saving, setSaving] = useState(false);

  async function loadAll() {
    const { data: planData } = await supabase
      .from("membership_plans")
      .select(
        "id, name, program, sessions_per_month, price, currency, active, all_classes_allowed"
      )
      .order("program", { ascending: true });
    setPlans(planData || []);

    const { data: classData } = await supabase
      .from("classes")
      .select("id, program, class_name, weekday, start_time, end_time")
      .order("program", { ascending: true });
    setClasses(classData || []);

    const { data: mapData } = await supabase
      .from("membership_plan_classes")
      .select("plan_id, class_id");
    const map = {};
    (mapData || []).forEach((row) => {
      if (!map[row.plan_id]) map[row.plan_id] = [];
      map[row.plan_id].push(row.class_id);
    });
    setPlanClassMap(map);
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
      await loadAll();
      setLoading(false);
    }

    check();
  }, [router]);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);

    await supabase.from("membership_plans").insert({
      name: newName,
      program: newProgram,
      sessions_per_month: Number(newSessions),
      price: Number(newPrice),
      currency: "EUR",
      active: true,
      all_classes_allowed: true,
    });

    setCreating(false);
    setNewName("");
    setNewSessions(8);
    setNewPrice(100);
    await loadAll();
  }

  function startEdit(p) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditSessions(p.sessions_per_month);
    setEditPrice(p.price);
    setEditAllClasses(p.all_classes_allowed);
    setEditSelectedClassIds(planClassMap[p.id] || []);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function toggleClassSelection(classId) {
    setEditSelectedClassIds((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId]
    );
  }

  async function saveEdit(planId) {
    setSaving(true);

    await supabase
      .from("membership_plans")
      .update({
        name: editName,
        sessions_per_month: Number(editSessions),
        price: Number(editPrice),
        all_classes_allowed: editAllClasses,
      })
      .eq("id", planId);

    // 기존 허용 수업 목록 삭제 후 다시 저장
    await supabase
      .from("membership_plan_classes")
      .delete()
      .eq("plan_id", planId);

    if (!editAllClasses && editSelectedClassIds.length > 0) {
      const rows = editSelectedClassIds.map((classId) => ({
        plan_id: planId,
        class_id: classId,
      }));
      await supabase.from("membership_plan_classes").insert(rows);
    }

    setSaving(false);
    setEditingId(null);
    await loadAll();
  }

  async function toggleActive(planId, current) {
    await supabase
      .from("membership_plans")
      .update({ active: !current })
      .eq("id", planId);
    await loadAll();
  }

  if (loading || !isAdmin) {

  async function handleDelete(planId, planName) {
    if (!confirm(`"${planName}" 상품을 정말 삭제할까요?\n\n이미 신청/배정된 회원권이 있으면 삭제가 안 될 수 있어요.`)) return;

    const { error } = await supabase.from("membership_plans").delete().eq("id", planId);

    if (error) {
      alert("삭제 실패: 이미 신청/배정된 회원권이 연결되어 있어서 삭제할 수 없습니다.");
      return;
    }

    await loadAll();
  }
    return (
      <LoadingScreen text="확인 중..." />
    );
  }

  const programLabel = { kids: "Kids", women: "Women's", men: "Men's" };

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
          상품 관리
        </div>
      </div>

      <div style={{ padding: "10px 18px 0" }}>
        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 18,
            marginBottom: 16,
            boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: 15,
              color: "#1b3a63",
              marginBottom: 14,
            }}
          >
            새 상품 만들기
          </div>
          <form onSubmit={handleCreate}>
            <label style={labelStyle}>상품명</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="예: 유아A 월 8회"
              style={inputStyle}
            />

            <label style={labelStyle}>프로그램</label>
            <select
              value={newProgram}
              onChange={(e) => setNewProgram(e.target.value)}
              style={inputStyle}
            >
              <option value="kids">Kids</option>
              <option value="women">Women's</option>
              <option value="men">Men's</option>
            </select>

            <label style={labelStyle}>월 이용 횟수</label>
            <input
              type="number"
              value={newSessions}
              onChange={(e) => setNewSessions(e.target.value)}
              style={inputStyle}
            />

            <label style={labelStyle}>가격 (EUR)</label>
            <input
              type="number"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              style={{ ...inputStyle, marginBottom: 4 }}
            />

            <button
              type="submit"
              disabled={creating}
              style={{
                width: "100%",
                marginTop: 14,
                padding: 14,
                fontSize: 15,
                fontWeight: 700,
                color: "white",
                background: creating ? "#9db8d6" : BLUE,
                border: "none",
                borderRadius: 10,
                cursor: creating ? "default" : "pointer",
              }}
            >
              {creating ? "생성 중..." : "상품 생성"}
            </button>
          </form>
        </div>

        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 18,
            boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: 15,
              color: "#1b3a63",
              marginBottom: 12,
            }}
          >
            등록된 상품 ({plans.length}개)
          </div>

          {plans.length === 0 && (
            <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>
              아직 등록된 상품이 없습니다.
            </p>
          )}

          {plans.map((p, idx) => {
            const isEditing = editingId === p.id;
            const relevantClasses = classes.filter(
              (c) => c.program === p.program
            );

            if (isEditing) {
              return (
                <div
                  key={p.id}
                  style={{
                    padding: "16px 0",
                    borderTop: idx === 0 ? "none" : "1px solid #f0f3f8",
                  }}
                >
                  <div
                    style={{
                      background: "#f7fafd",
                      borderRadius: 12,
                      padding: 14,
                    }}
                  >
                    <label style={labelStyle}>상품명</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={inputStyle}
                    />

                    <label style={labelStyle}>월 이용 횟수</label>
                    <input
                      type="number"
                      value={editSessions}
                      onChange={(e) => setEditSessions(e.target.value)}
                      style={inputStyle}
                    />

                    <label style={labelStyle}>가격 (EUR)</label>
                    <input
                      type="number"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      style={inputStyle}
                    />

                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        marginTop: 6,
                        fontSize: 13,
                        color: "#33455e",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={editAllClasses}
                        onChange={(e) => setEditAllClasses(e.target.checked)}
                        style={{ marginTop: 3, width: 18, height: 18 }}
                      />
                      <span>
                        모든 {programLabel[p.program] || p.program} 수업 예약
                        가능 (체크 해제하면 특정 수업만 선택 가능)
                      </span>
                    </div>

                    {!editAllClasses && (
                      <div
                        style={{
                          marginTop: 12,
                          padding: 12,
                          background: "white",
                          borderRadius: 10,
                          border: "1px solid #e5eaf2",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#1b3a63",
                            marginBottom: 8,
                          }}
                        >
                          예약 허용할 수업 선택
                        </div>
                        {relevantClasses.length === 0 && (
                          <p style={{ fontSize: 12, color: "#8ea0b8", margin: 0 }}>
                            이 프로그램에 등록된 수업이 없습니다.
                          </p>
                        )}
                        {relevantClasses.map((c) => (
                          <div
                            key={c.id}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 10,
                              marginTop: 8,
                              fontSize: 13,
                              color: "#33455e",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={editSelectedClassIds.includes(c.id)}
                              onChange={() => toggleClassSelection(c.id)}
                              style={{ marginTop: 3, width: 18, height: 18 }}
                            />
                            <span>
                              {c.class_name} ({c.start_time?.slice(0, 5)}~
                              {c.end_time?.slice(0, 5)})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => saveEdit(p.id)}
                        style={{
                          flex: 1,
                          padding: "12px 16px",
                          fontSize: 14,
                          fontWeight: 700,
                          border: "none",
                          borderRadius: 10,
                          background: saving ? "#9db8d6" : BLUE,
                          color: "white",
                          cursor: saving ? "default" : "pointer",
                        }}
                      >
                        {saving ? "저장 중..." : "저장"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
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
                        취소
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            const allowedCount = (planClassMap[p.id] || []).length;

            return (
              <div
                key={p.id}
                style={{
                  padding: "14px 0",
                  borderTop: idx === 0 ? "none" : "1px solid #f0f3f8",
                  opacity: p.active ? 1 : 0.5,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#1b3a63" }}>
                    {p.name}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: BLUE,
                      background: "#e9f1fb",
                      padding: "2px 8px",
                      borderRadius: 999,
                    }}
                  >
                    {programLabel[p.program] || p.program}
                  </span>
                  {!p.active && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#b3261e",
                        background: "#fdecec",
                        padding: "2px 8px",
                        borderRadius: 999,
                      }}
                    >
                      비활성
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 13, color: "#33455e", marginTop: 6 }}>
                  {p.sessions_per_month}회 ·{" "}
                  <strong>{p.price} {p.currency}</strong>
                </div>

                <div style={{ fontSize: 12, color: "#8ea0b8", marginTop: 4 }}>
                  {p.all_classes_allowed
                    ? "모든 수업 예약 가능"
                    : `특정 수업만 예약 가능 (${allowedCount}개 수업)`}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => startEdit(p)}
                    style={{
                      padding: "9px 4px",
                      flex: 1,
                      textAlign: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      border: "1px solid #e5eaf2",
                      borderRadius: 10,
                      background: "white",
                      color: "#1b3a63",
                      cursor: "pointer",
                    }}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleActive(p.id, p.active)}
                    style={{
                      padding: "9px 4px",
                      flex: 1,
                      textAlign: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      border: p.active ? "1px solid #f3c6c2" : "1px solid #bcd7ee",
                      color: p.active ? "#b3261e" : BLUE,
                      borderRadius: 10,
                      background: "white",
                      cursor: "pointer",
                    }}
                  >
                    {p.active ? "비활성화" : "활성화"}
                  </button>
                </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id, p.name)}
                    style={{
                      padding: "9px 4px",
                      flex: 1,
                      textAlign: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      border: "1px solid #f5c6c2",
                      borderRadius: 10,
                      background: "white",
                      color: "#c0392b",
                      cursor: "pointer",
                    }}
                  >
                    삭제
                  </button>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: "center", padding: "16px 18px", fontSize: 13 }}>
          <Link href="/dashboard" style={{ color: BLUE, fontWeight: 700, textDecoration: "none" }}>
            ← 관리자 홈으로
          </Link>
        </div>
      </div>
    </main>
  );
}
