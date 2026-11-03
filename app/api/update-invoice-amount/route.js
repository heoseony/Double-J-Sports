import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { generateInvoicePdfBuffer } from "../../../lib/invoicePdf";

export const runtime = "nodejs";

// 이미 발행된 인보이스의 금액(과 항목 설명)을 고치고 PDF를 다시 만든다.
// 인보이스 번호/발행일은 그대로 유지하고, 결제 내역(payments)과 인보이스(invoices)의 금액을 함께 바꾼다.
export async function POST(request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    // 관리자만 사용 가능
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const { data: authData } = await supabaseAdmin.auth.getUser(token);
    const authUser = authData?.user;
    if (!authUser) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", authUser.id)
      .single();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "관리자만 사용할 수 있습니다." }, { status: 403 });
    }

    const { invoiceId, newTotal, description, resend } = await request.json();
    if (!invoiceId) {
      return NextResponse.json({ error: "invoiceId가 필요합니다." }, { status: 400 });
    }
    const totalNum = Number(newTotal);
    if (!isFinite(totalNum) || totalNum < 0) {
      return NextResponse.json({ error: "금액이 올바르지 않습니다." }, { status: 400 });
    }
    const newTotalAmount = Math.round(totalNum * 100) / 100;
    const newNetAmount = Math.round((newTotalAmount / 1.19) * 100) / 100;
    const newVatAmount = Math.round((newTotalAmount - newNetAmount) * 100) / 100;

    const { data: invoice, error: invError } = await supabaseAdmin
      .from("invoices")
      .select("id, payment_id, invoice_number, invoice_year, issued_at, pdf_url, total_amount, description, amount_edits")
      .eq("id", invoiceId)
      .single();
    if (invError || !invoice) {
      return NextResponse.json({ error: "인보이스를 찾을 수 없습니다." }, { status: 404 });
    }

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select(
        "id, member_id, total_amount, members(id, name, name_en, guardian_id, guest_email, address_street, address_zip, address_city), membership_plans(name, sessions_per_month)"
      )
      .eq("id", invoice.payment_id)
      .single();
    if (paymentError || !payment) {
      return NextResponse.json({ error: "결제 정보를 찾을 수 없습니다." }, { status: 404 });
    }
    const member = payment.members;
    if (!member?.name_en) {
      return NextResponse.json({ error: "회원의 영문 이름이 없습니다." }, { status: 400 });
    }

    const { data: settings } = await supabaseAdmin
      .from("payment_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (!settings) {
      return NextResponse.json({ error: "결제 설정 정보가 없습니다." }, { status: 500 });
    }

    // 발행일은 원래 발행 시각의 독일 날짜를 그대로 사용한다.
    const ymd = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(invoice.issued_at));
    const [yy, mm, dd] = ymd.split("-");
    const issueDateStr = `${dd}.${mm}.${yy}`;
    const monthLabel = new Date(Date.UTC(Number(yy), Number(mm) - 1, 15)).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });

    const finalDescription =
      description && String(description).trim()
        ? String(description)
        : invoice.description || `Double J GmbH --\nAkademie-Training (${monthLabel})`;

    const sessionsPerMonth = payment.membership_plans?.sessions_per_month || 0;
    const unitPrice = sessionsPerMonth > 0 ? newTotalAmount / sessionsPerMonth : newTotalAmount;

    const pdfBuffer = await generateInvoicePdfBuffer({
      invoiceNumber: invoice.invoice_number,
      issueDate: issueDateStr,
      memberNameEn: member.name_en,
      memberAddress: {
        street: member.address_street,
        zip: member.address_zip,
        city: member.address_city,
      },
      description: finalDescription,
      quantity: sessionsPerMonth,
      unitPrice,
      netAmount: newNetAmount,
      vatAmount: newVatAmount,
      totalAmount: newTotalAmount,
      company: {
        name: settings.company_name,
        address: settings.company_address,
        phone: settings.company_phone,
        email: settings.company_email,
      },
      bank: {
        bankName: settings.bank_name,
        accountHolder: settings.account_holder,
        iban: settings.iban,
        bic: settings.bic,
        amtsgericht: settings.amtsgericht,
        handelsregister: settings.handelsregister,
        steuerNr: settings.steuer_nr,
        ustIdNr: settings.ust_id_nr,
        eoriNr: settings.eori_nr,
      },
    });

    const pdfPath = invoice.pdf_url || `${invoice.invoice_year}/${invoice.invoice_number}.pdf`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("invoices")
      .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
    if (uploadError) {
      return NextResponse.json({ error: "PDF 저장 실패: " + uploadError.message }, { status: 500 });
    }

    const { error: payUpdateError } = await supabaseAdmin
      .from("payments")
      .update({
        total_amount: newTotalAmount,
        net_amount: newNetAmount,
        vat_amount: newVatAmount,
      })
      .eq("id", payment.id);
    if (payUpdateError) {
      return NextResponse.json({ error: "결제 금액 수정 실패: " + payUpdateError.message }, { status: 500 });
    }

    const edits = Array.isArray(invoice.amount_edits) ? invoice.amount_edits : [];
    edits.push({
      at: new Date().toISOString(),
      by: authUser.id,
      old_total: Number(invoice.total_amount),
      new_total: newTotalAmount,
    });
    const { error: invUpdateError } = await supabaseAdmin
      .from("invoices")
      .update({
        total_amount: newTotalAmount,
        net_amount: newNetAmount,
        vat_amount: newVatAmount,
        description: finalDescription,
        amount_edits: edits,
      })
      .eq("id", invoice.id);
    if (invUpdateError) {
      return NextResponse.json({ error: "인보이스 수정 실패: " + invUpdateError.message }, { status: 500 });
    }

    // 선택: 수정된 PDF를 이메일로 다시 보내기
    let emailSent = false;
    let emailError = null;
    if (resend) {
      let to = null;
      if (member.guardian_id) {
        const { data: guardian } = await supabaseAdmin
          .from("guardians")
          .select("user_id")
          .eq("id", member.guardian_id)
          .single();
        if (guardian?.user_id) {
          const { data: gu } = await supabaseAdmin
            .from("users")
            .select("email")
            .eq("id", guardian.user_id)
            .single();
          to = gu?.email || null;
        }
      }
      if (!to && member.guest_email) to = member.guest_email;

      if (!to) {
        emailError = "받는 사람 이메일을 찾을 수 없습니다.";
      } else if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        emailError = "GMAIL_USER 또는 GMAIL_APP_PASSWORD 환경변수가 설정되지 않았습니다.";
      } else {
        try {
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
          });
          const safe = (member.name_en || member.name || "").replace(/[^a-zA-Z0-9가-힣]/g, "");
          await transporter.sendMail({
            from: `"Double J Sports" <${process.env.GMAIL_USER}>`,
            to,
            subject: `[Double J Sports] Invoice ${invoice.invoice_number} (corrected)`,
            html: `<p>안녕하세요,<br/>${member.name}님의 인보이스(${invoice.invoice_number})가 정정되어 다시 발송드립니다. 이전 인보이스 대신 첨부된 PDF를 확인해주세요.</p>`,
            attachments: [
              {
                filename: safe ? `${invoice.invoice_number}-${safe}.pdf` : `${invoice.invoice_number}.pdf`,
                content: pdfBuffer,
              },
            ],
          });
          emailSent = true;
        } catch (e) {
          emailError = e.message;
        }
      }
    }

    return NextResponse.json({
      success: true,
      invoiceNumber: invoice.invoice_number,
      oldTotal: Number(invoice.total_amount),
      newTotal: newTotalAmount,
      emailSent,
      emailError,
    });
  } catch (err) {
    return NextResponse.json({ error: "서버 오류: " + err.message }, { status: 500 });
  }
}
