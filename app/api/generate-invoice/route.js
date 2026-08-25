import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { generateInvoicePdfBuffer } from "../../../lib/invoicePdf";
import { nowInGermany } from "../../../lib/germanyTime";

export const runtime = "nodejs";

function formatDateDE(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function monthLabelEn(d) {
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export async function POST(request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { paymentId, descriptionOverride } = await request.json();

    if (!paymentId) {
      return NextResponse.json(
        { error: "paymentId가 필요합니다." },
        { status: 400 }
      );
    }

    // 1. 결제 + 회원 + 상품 정보 조회 (service role이라 RLS 영향 안 받음)
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select(
        "id, member_id, plan_id, total_amount, net_amount, vat_amount, confirmed_at, members(id, name, name_en, program, guardian_id), membership_plans(name, sessions_per_month)"
      )
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json(
        { error: "결제 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const member = payment.members;

    if (!member?.name_en) {
      return NextResponse.json(
        {
          error:
            "이 회원은 영문 이름이 등록되어 있지 않습니다. 관리자 > 회원 관리에서 먼저 등록해주세요.",
        },
        { status: 400 }
      );
    }

    // 2. 학부모 이메일 조회 (guardians → users, 관계명을 안전하게 2단계로 조회)
    let guardianEmail = null;
    if (member.guardian_id) {
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
        guardianEmail = guardianUser?.email || null;
      }
    }

    // 3. 회사/계좌 정보
    const { data: settings } = await supabaseAdmin
      .from("payment_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!settings) {
      return NextResponse.json(
        { error: "결제 설정(payment_settings) 정보가 없습니다." },
        { status: 500 }
      );
    }

    // 4. 인보이스 번호 채번 (연도별 1부터, 동시성 안전)
    const { data: invoiceNumber, error: numError } = await supabaseAdmin.rpc(
      "next_invoice_number"
    );

    if (numError || !invoiceNumber) {
      return NextResponse.json(
        { error: "인보이스 번호 채번 실패: " + (numError?.message || "") },
        { status: 500 }
      );
    }

    const invoiceYear = Number(String(invoiceNumber).split("-")[0]);
    const issueDate = nowInGermany();
    const sessionsPerMonth = payment.membership_plans?.sessions_per_month || 0;
    const unitPrice =
      sessionsPerMonth > 0
        ? Number(payment.total_amount) / sessionsPerMonth
        : Number(payment.total_amount);

    // 5. PDF 생성
    const autoDescription = `Double J GmbH --\nAkademie-Training (${monthLabelEn(
      issueDate
    )})`;
    const finalDescription =
      descriptionOverride && descriptionOverride.trim()
        ? descriptionOverride
        : autoDescription;

    const pdfBuffer = await generateInvoicePdfBuffer({
      invoiceNumber,
      issueDate: formatDateDE(issueDate),
      memberNameEn: member.name_en,
      description: finalDescription,
      quantity: sessionsPerMonth,
      unitPrice,
      netAmount: payment.net_amount,
      vatAmount: payment.vat_amount,
      totalAmount: payment.total_amount,
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

    // 6. 비공개 Storage 버킷에 저장 (연도별 폴더로 정리)
    const pdfPath = `${invoiceYear}/${invoiceNumber}.pdf`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("invoices")
      .upload(pdfPath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: "PDF 저장 실패: " + uploadError.message },
        { status: 500 }
      );
    }

    // 7. invoices 테이블 기록
    const { error: insertError } = await supabaseAdmin.from("invoices").insert({
      payment_id: payment.id,
      invoice_number: invoiceNumber,
      invoice_year: invoiceYear,
      total_amount: payment.total_amount,
      net_amount: payment.net_amount,
      vat_amount: payment.vat_amount,
      issued_at: issueDate.toISOString(),
      pdf_url: pdfPath,
    });

    if (insertError) {
      return NextResponse.json(
        { error: "invoices 테이블 저장 실패: " + insertError.message },
        { status: 500 }
      );
    }

    // 8. 이메일 발송 (실패해도 인보이스 발급 자체는 성공으로 처리)
    let emailSent = false;
    let emailError = null;

    if (guardianEmail && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      try {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
          },
        });

        await transporter.sendMail({
          from: `"Double J Sports" <${process.env.GMAIL_USER}>`,
          to: guardianEmail,
          subject: `[Double J Sports] Invoice ${invoiceNumber}`,
          html: `<p>안녕하세요,<br/>${member.name}님의 인보이스(${invoiceNumber})가 발급되었습니다. 첨부된 PDF를 확인해주세요.</p>`,
          attachments: [
            {
              filename: `${invoiceNumber}.pdf`,
              content: pdfBuffer,
            },
          ],
        });

        emailSent = true;
      } catch (e) {
        emailError = e.message;
      }
    } else if (!guardianEmail) {
      emailError = "학부모 이메일 주소를 찾을 수 없습니다.";
    } else if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      emailError = "GMAIL_USER 또는 GMAIL_APP_PASSWORD 환경변수가 설정되지 않았습니다.";
    }

    return NextResponse.json({
      success: true,
      invoiceNumber,
      emailSent,
      emailError,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "서버 오류: " + err.message },
      { status: 500 }
    );
  }
}
