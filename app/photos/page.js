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

async function downloadMedia(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = url.split("/").pop() || "download";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    window.open(url, "_blank");
  }
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function addWatermark(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const photoImg = await loadImageElement(objectUrl);
    const logoImg = await loadImageElement("/logo-watermark.png");

    const canvas = document.createElement("canvas");
    canvas.width = photoImg.naturalWidth;
    canvas.height = photoImg.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(photoImg, 0, 0);

    const logoWidth = canvas.width * 0.14;
    const logoHeight = logoWidth * (logoImg.naturalHeight / logoImg.naturalWidth);
    const margin = canvas.width * 0.03;
    const x = canvas.width - logoWidth - margin;
    const y = margin;

    ctx.globalAlpha = 0.85;
    ctx.drawImage(logoImg, x, y, logoWidth, logoHeight);
    ctx.globalAlpha = 1;

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    );

    return new File([blob], file.name, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function PhotosPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [canUpload, setCanUpload] = useState(false);
  const [userId, setUserId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [posts, setPosts] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  async function loadPosts() {
    const { data, error } = await supabase
      .from("photo_posts")
      .select(
        "id, caption, uploaded_by, created_at, photo_post_media(id, media_url, media_type, order_index)"
      )
      .order("created_at", { ascending: false });

    if (!error) {
      const withSortedMedia = (data || []).map((p) => ({
        ...p,
        photo_post_media: [...(p.photo_post_media || [])].sort(
          (a, b) => a.order_index - b.order_index
        ),
      }));
      setPosts(withSortedMedia);
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

      await loadPosts();
      setLoading(false);
    }

    load();
  }, [router]);

  function handleFileChange(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setSelectedFiles(files);
    setPreviews(
      files.map((f) => ({
        url: URL.createObjectURL(f),
        isVideo: f.type.startsWith("video"),
      }))
    );
  }

  function resetForm() {
    setSelectedFiles([]);
    setPreviews([]);
    setCaption("");
    setShowForm(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setErrorMsg("사진 또는 동영상을 하나 이상 선택해주세요.");
      return;
    }

    setUploading(true);
    setErrorMsg("");

    const postId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const { error: postError } = await supabase.from("photo_posts").insert({
      id: postId,
      caption: caption || null,
      uploaded_by: userId,
    });

    if (postError) {
      setUploading(false);
      setErrorMsg("게시물 생성 실패: " + postError.message);
      return;
    }

    const mediaRows = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const mediaType = file.type.startsWith("video") ? "video" : "image";

      let fileToUpload = file;
      if (mediaType === "image") {
        try {
          fileToUpload = await addWatermark(file);
        } catch (wmError) {
          fileToUpload = file;
        }
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
      const path = `${postId}-${i}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("photos")
        .upload(path, fileToUpload);

      if (uploadError) {
        setErrorMsg(`업로드 실패 (${file.name}): ` + uploadError.message);
        continue;
      }

      const { data: urlData } = supabase.storage.from("photos").getPublicUrl(path);

      mediaRows.push({
        post_id: postId,
        media_url: urlData.publicUrl,
        media_type: mediaType,
        order_index: i,
      });
    }

    if (mediaRows.length > 0) {
      await supabase.from("photo_post_media").insert(mediaRows);
    }

    setUploading(false);
    resetForm();
    await loadPosts();
  }

  async function handleDeletePost(id) {
    setDeletingId(id);
    await supabase.from("photo_posts").delete().eq("id", id);
    await loadPosts();
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
              <label>사진 또는 동영상 (여러 개 선택 가능)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFileChange}
                style={{ marginTop: 4 }}
              />

              {previews.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 12,
                    overflowX: "auto",
                    paddingBottom: 4,
                  }}
                >
                  {previews.map((p, idx) => (
                    <div
                      key={idx}
                      style={{
                        flex: "0 0 auto",
                        width: 90,
                        height: 90,
                        borderRadius: 10,
                        overflow: "hidden",
                        background: "#eee",
                      }}
                    >
                      {p.isVideo ? (
                        <video
                          src={p.url}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <img
                          src={p.url}
                          alt="미리보기"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      )}
                    </div>
                  ))}
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

      {posts.length === 0 && !errorMsg && (
        <div className="card">
          <p style={{ fontSize: 14, color: "#777", margin: 0 }}>
            아직 등록된 사진/동영상이 없습니다.
          </p>
        </div>
      )}

      {posts.map((post) => {
        const canDelete = isAdmin || post.uploaded_by === userId;
        const mediaList = post.photo_post_media || [];

        return (
          <div
            key={post.id}
            className="card"
            style={{ marginBottom: 20, padding: 0, overflow: "hidden" }}
          >
            <div
              style={{
                display: "flex",
                overflowX: "auto",
                scrollSnapType: "x mandatory",
              }}
            >
              {mediaList.map((m) => (
                <div
                  key={m.id}
                  style={{
                    flex: "0 0 100%",
                    scrollSnapAlign: "start",
                    position: "relative",
                  }}
                >
                  {m.media_type === "video" ? (
                    <video
                      src={m.media_url}
                      controls
                      style={{ width: "100%", display: "block" }}
                    />
                  ) : (
                    <img
                      src={m.media_url}
                      alt={post.caption || "사진"}
                      style={{ width: "100%", display: "block" }}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => downloadMedia(m.media_url)}
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      background: "rgba(0,0,0,0.55)",
                      color: "white",
                      border: "none",
                      borderRadius: 20,
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    ↓ 다운로드
                  </button>
                </div>
              ))}
            </div>

            {mediaList.length > 1 && (
              <div
                style={{
                  textAlign: "center",
                  fontSize: 12,
                  color: "#999",
                  padding: "6px 0 0",
                }}
              >
                좌우로 넘겨서 {mediaList.length}개 보기
              </div>
            )}

            <div style={{ padding: 16 }}>
              {post.caption && (
                <p
                  style={{
                    fontSize: 14,
                    color: "#333",
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {post.caption}
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
                  {formatDate(post.created_at)}
                </span>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDeletePost(post.id)}
                    disabled={deletingId === post.id}
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
                    {deletingId === post.id ? "삭제 중..." : "삭제"}
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
