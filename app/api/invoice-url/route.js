import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request) {
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

    const { invoiceId } = await request.json();
    if (!invoiceId) {
      return NextResponse.json(
        { error: "invoiceId가 필요합니다." },
        { status: 400 }
      );
    }

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .select("id, pdf_url, payments(member_id, members(guardian_id))")
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: "인보이스를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    let allowed = profile?.role === "admin";

    if (!allowed) {
      const { data: guardian } = await supabaseAdmin
        .from("guardians")
        .select("id")
        .eq("user_id", user.id)
        .single();

      allowed =
        !!guardian && guardian.id === invoice.payments?.members?.guardian_id;
    }

    if (!allowed) {
      return NextResponse.json(
        { error: "이 인보이스에 접근할 권한이 없습니다." },
        { status: 403 }
      );
    }

    // 60초짜리 임시 링크만 발급 — 비공개 버킷이라 이 링크 없이는 아무도 못 엶
    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("invoices")
      .createSignedUrl(invoice.pdf_url, 60);

    if (signError) {
      return NextResponse.json(
        { error: "다운로드 링크 생성 실패: " + signError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: signed.signedUrl });
  } catch (err) {
    return NextResponse.json(
      { error: "서버 오류: " + err.message },
      { status: 500 }
    );
  }
}
