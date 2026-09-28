"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import LoadingScreen from "../../components/LoadingScreen";

// 구글 로그인 완료 후 돌아오는 콜백 페이지.
// - 처음 구글로 로그인한 사람: users/guardians 계정을 자동으로 생성
// - 이미 계정이 있는 사람: 바로 로그인 처리
// 이후 역할(coach/guardian)에 따라 알맞은 화면으로 이동한다.
export default function AuthCallbackPage() {
  const router = useRouter();
  const handledRef = useRef(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function handle(user) {
      if (handledRef.current || !user) return;
      handledRef.current = true;

      try {
        const { data: existingUser } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        let role = existingUser?.role;

        if (!existingUser) {
          // 구글로 처음 로그인한 경우: users/guardians 계정 자동 생성
          const { error: userError } = await supabase.from("users").insert({
            id: user.id,
            email: user.email,
            role: "guardian",
          });

          if (userError) {
            setErrorMsg("계정 생성 실패: " + userError.message);
            handledRef.current = false;
            return;
          }

          const { error: guardianError } = await supabase
            .from("guardians")
            .insert({
              user_id: user.id,
              name:
                user.user_metadata?.full_name ||
                user.user_metadata?.name ||
                user.email,
              phone: null,
            });

          if (guardianError) {
            setErrorMsg("보호자 정보 생성 실패: " + guardianError.message);
            handledRef.current = false;
            return;
          }

          role = "guardian";
        }

        if (role === "coach") {
          router.replace("/coach/select-profile");
        } else {
          router.replace("/dashboard");
        }
      } catch (e) {
        setErrorMsg("로그인 처리 중 오류가 발생했습니다: " + e.message);
        handledRef.current = false;
      }
    }

    // 이미 세션이 잡혀있는 경우
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) handle(data.user);
    });

    // 세션이 막 생기는 순간을 감지 (레이스 컨디션 대비)
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) handle(session.user);
      }
    );

    return () => {
      listener?.subscription?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (errorMsg) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <div
          style={{
            background: "#fdecec",
            color: "#b3261e",
            padding: 16,
            borderRadius: 10,
            fontSize: 14,
            maxWidth: 360,
            textAlign: "center",
          }}
        >
          {errorMsg}
          <div style={{ marginTop: 12 }}>
            <a href="/login" style={{ color: "#3B82C4", fontWeight: 700 }}>
              로그인 화면으로 돌아가기
            </a>
          </div>
        </div>
      </main>
    );
  }

  return <LoadingScreen />;
}
