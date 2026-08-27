import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    const { data: allInvoices, error } = await supabaseAdmin
      .from("invoices")
      .select(
        "id, invoice_number, invoice_year, total_amount, net_amount, vat_amount, issued_at, pdf_url, payments(member_id, members(id, name, name_en, guardian_id, guardians(name)))"
      )
      .order("issued_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "인보이스 목록 조회 실패: " + error.message },
        { status: 500 }
      );
    }

    if (profile?.role === "admin") {
      return NextResponse.json({ invoices: allInvoices || [], isAdmin: true });
    }

    // 학부모: 본인 선수 인보이스만
    const { data: guardian } = await supabaseAdmin
      .from("guardians")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!guardian) {
      return NextResponse.json({ invoices: [], isAdmin: false });
    }

    const own = (allInvoices || []).filter(
      (inv) => inv.payments?.members?.guardian_id === guardian.id
    );

    return NextResponse.json({ invoices: own, isAdmin: false });
  } catch (err) {
    return NextResponse.json(
      { error: "서버 오류: " + err.message },
      { status: 500 }
    );
  }
}
