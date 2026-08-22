import { NextResponse } from "next/server";
import JSZip from "jszip";
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

    // 관리자만 일괄 다운로드 가능
    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "관리자만 이용할 수 있습니다." },
        { status: 403 }
      );
    }

    const { invoiceIds } = await request.json();
    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return NextResponse.json(
        { error: "invoiceIds가 필요합니다." },
        { status: 400 }
      );
    }

    const { data: invoices, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .select("id, invoice_number, pdf_url")
      .in("id", invoiceIds);

    if (invoiceError || !invoices || invoices.length === 0) {
      return NextResponse.json(
        { error: "인보이스를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const zip = new JSZip();
    let successCount = 0;
    const failedNumbers = [];

    for (const inv of invoices) {
      if (!inv.pdf_url) {
        failedNumbers.push(inv.invoice_number);
        continue;
      }

      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from("invoices")
        .download(inv.pdf_url);

      if (downloadError || !fileData) {
        failedNumbers.push(inv.invoice_number);
        continue;
      }

      const buffer = Buffer.from(await fileData.arrayBuffer());
      zip.file(`${inv.invoice_number}.pdf`, buffer);
      successCount++;
    }

    if (successCount === 0) {
      return NextResponse.json(
        { error: "다운로드 가능한 인보이스 파일이 없습니다." },
        { status: 500 }
      );
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="invoices.zip"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "서버 오류: " + err.message },
      { status: 500 }
    );
  }
}
