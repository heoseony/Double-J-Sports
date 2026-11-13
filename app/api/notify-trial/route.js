import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import crypto from "crypto";

export const runtime = "nodejs";

const PROGRAM_LABEL = {
  pro: "프로",
  academy: "아카데미",
  women: "여성 취미반",
  men: "남성 취미반",
  private: "1:1 개인 코칭",
};

function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export async function POST(request) {
  try {
    const expected = process.env.TRIAL_WEBHOOK_SECRET;
    const got = request.headers.get("x-webhook-secret");
    if (!expected || !safeEqual(got, expected)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const b = await request.json();

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return NextResponse.json({ error: "mail env missing" }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });

    const program = PROGRAM_LABEL[b.program] || b.program;
    const link = "https://double-j-sports.vercel.app/admin/trial-applications";

    await transporter.sendMail({
      from: `"Double J Sports" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER,
      subject: `[Double J] 체험수업 신청 - ${String(b.name || "").slice(0, 60)}`,
      html: `
        <h3>새 체험수업 신청이 들어왔습니다</h3>
        <p><b>이름</b> ${esc(b.name)}<br/>
        <b>연락처</b> ${esc(b.contact)}<br/>
        <b>국가</b> ${esc(b.country || "-")}<br/>
        <b>희망 프로그램</b> ${esc(program)}<br/>
        <b>문의</b> ${esc(b.message || "-").replace(/\n/g, "<br/>")}</p>
        <p><a href="${link}">앱에서 확인하기</a></p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
