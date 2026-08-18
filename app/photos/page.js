"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function PhotosPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [canUpload, setCanUpload] = useState(false);
  const [userId, setUserId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [photos, setPhotos] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  async function loadPhotos() {
    const { data, error } = await supabase
      .from("photos")
      .select("id, image_url, caption, media_type, uploaded_by, created_at")
      .order("created_at", { ascending: false });

    if (!error) {
      setPhotos(data || []);
    } else {
      setErrorMsg("갤러리를 불러오지 못했습니다: " + error.message);
    }
  }

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);

      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role === "coach" || profile?.role === "admin") {
        setCanUpload(true);
      }
      if (profile?.role === "admin") {
        setIsAdmin(true);
      }

      await loadPhotos();
      setLoading(false);
    }

    load();
  }, [router]);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function resetForm() {
    setSelectedFile(null);
    setPreviewUrl("");
    setCaption("");
    setShowForm(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg("사진 또는 동영상을 선택해주세요.");
      return;
    }

    setUploading(true);
    setErrorMsg("");

    const mediaType = selectedFile.type.startsWith("video") ? "video" : "image";
    const safeName = selectedFile.name.replace(/[^a-zA-Z0-9.]/g, "_");
    const path = `${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("photos")
      .upload(path, selectedFile);

    if (uploadError) {
      setUploading(false);
      setErrorMsg("업로드 실패: " + uploadError.message);
      return;
    }

    const { data: urlData } = supabase.storage.from("photos").getPublicUrl(path);

    const { error: insertError } = await supabase.from("photos").insert({
      image_url: urlData.publicUrl,
      caption: caption || null,
      media_type: mediaType,
      uploaded_by: userId,
    });

    setUploading(false);

    if (insertError) {
      setErrorMsg("저장 실패: " + insertError.message);
      return;
    }

    resetForm();
    await loadPhotos();
  }

  async function handleDelete(id) {
    setDeletingId(id);
    await supabase.from("photos").delete().eq("id", id);
    await loadPhotos();
    setDeletingId(null);
  }

  if (loading) {
    return (
      <main className="page">
        <div className="subtitle">불러오는 중...</div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="brand">Double J Sports</div>
      <div className="subtitle">갤러리</div>

      {canUpload && (
        <div className="card" style={{ marginBottom: 20 }}>
          {!showForm ? (
            <button className="primary" onClick={() => setShowForm(true)}>
              + 사진/동영상 올리기
            </button>
          ) : (
            <form onSubmit={handleUpload}>
              <label>사진 또는 동영상</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileChange}
                style={{ marginTop: 4 }}
              />

              {previewUrl && (
                <div style={{ marginTop: 12 }}>
                  {selectedFile?.type.startsWith("video") ? (
                    <video
                      src={previewUrl}
                      controls
                      style={{ width: "100%", borderRadius: 10 }}
                    />
                  ) : (
                    <img
                      src={previewUrl}
                      alt="미리보기"
                      style={{ width: "100%", borderRadius: 10 }}
                    />
                  )}
                </div>
              )}

              <label>설명 (선택)</label>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="예: 오늘 유아A반 훈련 모습"
              />

              {errorMsg && <div className="message error">{errorMsg}</div>}

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button className="primary" type="submit" disabled={uploading}>
                  {uploading ? "업로드 중..." : "게시하기"}
                </button>
                <button
                  type="button"
                  className="primary"
                  style={{ background: "#999" }}
                  onClick={resetForm}
                >
                  취소
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {!showForm && errorMsg && (
        <div className="message error" style={{ marginBottom: 14 }}>
          {errorMsg}
        </div>
      )}

      {photos.length === 0 && !errorMsg && (
        <div className="card">
          <p style={{ fontSize: 14, color: "#777", margin: 0 }}>
            아직 등록된 사진/동영상이 없습니다.
          </p>
        </div>
      )}

      {photos.map((p) => {
        const canDelete = isAdmin || p.uploaded_by === userId;

        return (
          <div
            key={p.id}
            className="card"
            style={{ marginBottom: 20, padding: 0, overflow: "hidden" }}
          >
            {p.media_type === "video" ? (
              <video
                src={p.image_url}
                controls
                style={{ width: "100%", display: "block" }}
              />
            ) : (
              <img
                src={p.image_url}
                alt={p.caption || "사진"}
                style={{ width: "100%", display: "block" }}
              />
            )}

            <div style={{ padding: 16 }}>
              {p.caption && (
                <p
                  style={{
                    fontSize: 14,
                    color: "#333",
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {p.caption}
                </p>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 8,
                }}
              >
                <span style={{ fontSize: 12, color: "#999" }}>
                  {formatDate(p.created_at)}
                </span>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id)}
                    disabled={deletingId === p.id}
                    style={{
                      fontSize: 12,
                      border: "1px solid #b3261e",
                      color: "#b3261e",
                      background: "white",
                      borderRadius: 8,
                      padding: "4px 10px",
                      cursor: "pointer",
                    }}
                  >
                    {deletingId === p.id ? "삭제 중..." : "삭제"}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </main>
  );
}
