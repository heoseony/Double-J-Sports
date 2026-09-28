import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { nowInGermany } from "../../../../lib/germanyTime";

export const runtime = "nodejs";

// 매일 자동으로 돌면서, 활성화된 모든 수업에 대해 "앞으로 28일치" 세션이
// 비어있으면 채워준다. 기존 관리자 화면의 "미래 4주치 생성" 버튼과 동일한 로직.
export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "인증 실패" }, { status: 401 });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data: classes, error: classesError } = await supabaseAdmin
      .from("classes")
      .select("id, weekday, start_time, end_time, active")
      .eq("active", true);

    if (classesError) {
      return NextResponse.json(
        { error: "수업 목록 조회 실패: " + classesError.message },
        { status: 500 }
      );
    }

    let createdCount = 0;
    let checkedCount = 0;

    for (const c of classes || []) {
      const targetDates = [];
      const today = nowInGermany();
      for (let i = 0; i < 28; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        if (d.getDay() === c.weekday) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          targetDates.push(`${yyyy}-${mm}-${dd}`);
        }
      }

      for (const dateStr of targetDates) {
        checkedCount += 1;
        const { data: existing } = await supabaseAdmin
          .from("class_sessions")
          .select("id")
          .eq("class_id", c.id)
          .eq("session_date", dateStr)
          .maybeSingle();

        if (!existing) {
          const { error } = await supabaseAdmin.from("class_sessions").insert({
            class_id: c.id,
            session_date: dateStr,
            start_time: c.start_time,
            end_time: c.end_time,
            status: "scheduled",
          });
          if (!error) createdCount += 1;
        }
      }
    }

    return NextResponse.json({
      success: true,
      classesChecked: (classes || []).length,
      datesChecked: checkedCount,
      created: createdCount,
    });
  } catch (err) {
    return NextResponse.json({ error: "서버 오류: " + err.message }, { status: 500 });
  }
}
