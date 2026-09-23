import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { paymentId } = await request.json();

    if (!paymentId) {
      return NextResponse.json({ error: "paymentId가 필요합니다." }, { status: 400 });
    }

    // 1. 이 결제에 이미 발급된 인보이스 중 가장 최근 것을 찾는다 (새로 번호 채번하지 않음)
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .select("id, invoice_number, pdf_url")
      .eq("payment_id", paymentId)
      .order("issued_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: "이 결제에 발급된 인보이스가 없습니다. 먼저 인보이스 발행을 해주세요." },
        { status: 404 }
      );
    }

    // 2. 회원 + 이메일 조회 (guardian_id 있으면 guardian 이메일, 없으면 guest_email)
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select("id, members(id, name, guardian_id, guest_email)")
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json({ error: "결제 정보를 찾을 수 없습니다." }, { status: 404 });
    }

    const member = payment.members;
    let email = null;

    if (member?.guardian_id) {
      const { data: guardian } = await supabaseAdmin
        .from("guardians")
        .select("user_id")
        .eq("id", member.guardian_id)
        .single();
      if (guardian?.user_id) {
        const { data: guardianUser } = await supabaseAdmin
          .from("users")
          .select("email")
          .eq("id", guardian.user_id)
          .single();
        email = guardianUser?.email || null;
      }
    }
    if (!email && member?.guest_email) {
      email = member.guest_email;
    }

    if (!email) {
      return NextResponse.json({ error: "발송할 이메일 주소를 찾을 수 없습니다." }, { status: 400 });
    }

    // 3. 저장된 PDF 다운로드
    const { data: pdfFile, error: downloadError } = await supabaseAdmin.storage
      .from("invoices")
      .download(invoice.pdf_url);

    if (downloadError || !pdfFile) {
      return NextResponse.json(
        { error: "PDF 파일을 찾을 수 없습니다: " + (downloadError?.message || "") },
        { status: 500 }
      );
    }
    const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());

    // 4. 이메일 재전송
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return NextResponse.json(
        { error: "GMAIL_USER 또는 GMAIL_APP_PASSWORD 환경변수가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"Double J Sports" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `[Double J Sports] Invoice ${invoice.invoice_number}`,
      html: `<p>안녕하세요,<br/>${member?.name || ""}님의 인보이스(${invoice.invoice_number})를 다시 보내드립니다. 첨부된 PDF를 확인해주세요.</p>`,
      attachments: [
        {
          filename: `${invoice.invoice_number}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    return NextResponse.json({
      success: true,
      invoiceNumber: invoice.invoice_number,
      sentTo: email,
    });
  } catch (err) {
    return NextResponse.json({ error: "서버 오류: " + err.message }, { status: 500 });
  }
}
