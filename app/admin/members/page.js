"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

const PROGRAM_LABEL = {
  kids: "Kids",
  womens: "Women's",
  mens: "Men's",
};

export default function AdminMembersPage() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [programFilter, setProgramFilter] = useState("all");

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("members")
        .select("id, name, birth_date, program, status, guardians(name, phone)")
        .order("created_at", { ascending: false });

      if (error) {
        setErrorMsg("회원 목록을 불러오지 못했습니다: " + error.message);
        setLoading(false);
        return;
      }

      setMembers(data || []);
      setLoading(false);
    }

    load();
  }, []);

  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (programFilter !== "all" && m.program !== programFilter) return false;
      if (search) {
        const q = search.trim().toLowerCase();
        const guardianName = m.guardians?.name || "";
        if (
          !m.name.toLowerCase().includes(q) &&
          !guardianName.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [members, search, programFilter]);

  if (loading) {
    return (
      <main className="admin-page">
        <div className="subtitle">불러오는 중...</div>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <div className="brand">회원 관리</div>
      <div className="subtitle">회원 목록 확인 및 회원권 배정/조정</div>

      <div className="card">
        {errorMsg && <div className="message error">{errorMsg}</div>}

        <label>검색 (선수명 / 보호자명)</label>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름으로 검색"
        />

        <label>프로그램</label>
        <select
          value={programFilter}
          onChange={(e) => setProgramFilter(e.target.value)}
        >
          <option value="all">전체</option>
          <option value="kids">Kids</option>
          <option value="womens">Women's</option>
          <option value="mens">Men's</option>
        </select>

        <div style={{ marginTop: 20 }}>
          {filtered.length === 0 && (
            <p style={{ fontSize: 15, color: "#555" }}>
              조건에 맞는 회원이 없습니다.
            </p>
          )}

          {filtered.map((m) => (
            <Link
              key={m.id}
              href={`/admin/members/${m.id}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div className="list-row">
                <div>
                  <span className={`badge ${m.program}`}>
                    {PROGRAM_LABEL[m.program] || m.program}
                  </span>
                  <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6 }}>
                    {m.name}
                  </div>
                  <div style={{ fontSize: 13, color: "#777", marginTop: 4 }}>
                    보호자: {m.guardians?.name || "-"}
                    {m.status !== "active" ? ` · ${m.status}` : ""}
                  </div>
                </div>
                <span className="small-btn secondary">상세</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="link-row">
          <Link href="/admin">← 관리자 홈으로</Link>
        </div>
      </div>
    </main>
  );
}
