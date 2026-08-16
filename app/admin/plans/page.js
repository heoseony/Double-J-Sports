"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

const inputStyle = {
  width: "100%",
  padding: 10,
  fontSize: 14,
  border: "1px solid #ddd",
  borderRadius: 8,
  marginBottom: 8,
  boxSizing: "border-box",
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
    return (
      <main className="page">
        <div className="subtitle">확인 중...</div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="brand">Double J Sports</div>
      <div className="subtitle">회원권 상품 · 가격 관리</div>

      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 10 }}>새 상품 만들기</div>
        <form onSubmit={handleCreate}>
          <label>상품명</label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="예: 유아A 월 8회"
            style={inputStyle}
          />

          <label>프로그램</label>
          <select
            value={newProgram}
            onChange={(e) => setNewProgram(e.target.value)}
            style={inputStyle}
          >
            <option value="kids">Kids</option>
            <option value="women">Women's</option>
            <option value="men">Men's</option>
          </select>

          <label>월 이용 횟수</label>
          <input
            type="number"
            value={newSessions}
            onChange={(e) => setNewSessions(e.target.value)}
            style={inputStyle}
          />

          <label>가격 (EUR)</label>
          <input
            type="number"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            style={inputStyle}
          />

          <button className="primary" type="submit" disabled={creating}>
            {creating ? "생성 중..." : "상품 생성"}
          </button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>등록된 상품</div>

        {plans.map((p) => {
          const isEditing = editingId === p.id;
          const relevantClasses = classes.filter(
            (c) => c.program === p.program
          );

          if (isEditing) {
            return (
              <div
                key={p.id}
                style={{
                  padding: "12px 0",
                  borderBottom: "1px solid #eee",
                  background: "#fafafa",
                }}
              >
                <label style={{ fontSize: 12 }}>상품명</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={inputStyle}
                />

                <label style={{ fontSize: 12 }}>월 이용 횟수</label>
                <input
                  type="number"
                  value={editSessions}
                  onChange={(e) => setEditSessions(e.target.value)}
                  style={inputStyle}
                />

                <label style={{ fontSize: 12 }}>가격 (EUR)</label>
                <input
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  style={inputStyle}
                />

                <div className="checkbox-row" style={{ marginTop: 4 }}>
                  <input
                    type="checkbox"
                    checked={editAllClasses}
                    onChange={(e) => setEditAllClasses(e.target.checked)}
                  />
                  <span>
                    모든 {p.program} 수업 예약 가능 (체크 해제하면 특정
                    수업만 선택 가능)
                  </span>
                </div>

                {!editAllClasses && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: 10,
                      background: "white",
                      borderRadius: 8,
                      border: "1px solid #eee",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                      예약 허용할 수업 선택
                    </div>
                    {relevantClasses.length === 0 && (
                      <p style={{ fontSize: 12, color: "#777" }}>
                        이 프로그램에 등록된 수업이 없습니다.
                      </p>
                    )}
                    {relevantClasses.map((c) => (
                      <div key={c.id} className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={editSelectedClassIds.includes(c.id)}
                          onChange={() => toggleClassSelection(c.id)}
                        />
                        <span>
                          {c.class_name} ({c.start_time?.slice(0, 5)}~
                          {c.end_time?.slice(0, 5)})
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    style={{
                      padding: "8px 14px",
                      fontSize: 13,
                      border: "none",
                      borderRadius: 8,
                      background: "#0b3d2e",
                      color: "white",
                      cursor: "pointer",
                    }}
                    disabled={saving}
                    onClick={() => saveEdit(p.id)}
                  >
                    {saving ? "저장 중..." : "저장"}
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: "8px 14px",
                      fontSize: 13,
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      background: "white",
                      cursor: "pointer",
                    }}
                    onClick={cancelEdit}
                  >
                    취소
                  </button>
                </div>
              </div>
            );
          }

          const allowedCount = (planClassMap[p.id] || []).length;

          return (
            <div
              key={p.id}
              style={{
                padding: "12px 0",
                borderBottom: "1px solid #eee",
                fontSize: 14,
                opacity: p.active ? 1 : 0.5,
              }}
            >
              <div style={{ fontWeight: 700 }}>
                [{p.program}] {p.name} · {p.sessions_per_month}회 ·{" "}
                {p.price} {p.currency}
                {!p.active && " (비활성)"}
              </div>
              <div style={{ color: "#777", marginTop: 2, fontSize: 13 }}>
                {p.all_classes_allowed
                  ? "모든 수업 예약 가능"
                  : `특정 수업만 예약 가능 (${allowedCount}개 수업)`}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  style={{
                    padding: "8px 14px",
                    fontSize: 13,
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    background: "white",
                    cursor: "pointer",
                  }}
                  onClick={() => startEdit(p)}
                >
                  수정
                </button>
                <button
                  type="button"
                  style={{
                    padding: "8px 14px",
                    fontSize: 13,
                    border: p.active
                      ? "1px solid #b3261e"
                      : "1px solid #0b3d2e",
                    color: p.active ? "#b3261e" : "#0b3d2e",
                    borderRadius: 8,
                    background: "white",
                    cursor: "pointer",
                  }}
                  onClick={() => toggleActive(p.id, p.active)}
                >
                  {p.active ? "비활성화" : "활성화"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="link-row">
        <Link href="/admin">← 관리자 홈으로</Link>
      </div>
    </main>
  );
}
