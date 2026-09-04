"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { useLanguage } from "../../lib/i18n/LanguageContext";
import { translateCategoryName } from "../../lib/i18n/nameTranslations";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function roleLabel(role, t) {
  if (role === "admin") return t("gallery.roleAdmin");
  if (role === "coach") return t("gallery.roleCoach");
  return "";
}

// 카테고리별로 다른 색을 배정해서, 전체 보기에서도 어느 목록 사진인지 한눈에 구분되게 한다.
const CATEGORY_COLORS = [
  "#3B82C4", // 파랑
  "#e0784f", // 주황
  "#4caf7d", // 초록
  "#a06cd5", // 보라
  "#e0b23b", // 노랑
  "#e0567a", // 핑크
  "#4a90a4", // 청록
];

function getCategoryColor(categoryId, categories) {
  if (!categoryId) return "#8ea0b8";
  const idx = categories.findIndex((c) => c.id === categoryId);
  if (idx === -1) return "#8ea0b8";
  return CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
}

async function downloadMedia(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const filename = url.split("/").pop() || "download";

    // 모바일(주로 안드로이드 크롬)에서 Web Share API가 지원되면
    // 공유 시트를 띄워서 "사진에 저장"으로 바로 갤러리에 담을 수 있게 한다.
    // 지원 안 되는 환경(대부분의 데스크톱 브라우저)에서는 기존 다운로드 방식으로 자동 전환.
    try {
      const file = new File([blob], filename, { type: blob.type });
      if (
        typeof navigator !== "undefined" &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch (shareErr) {
      // 사용자가 공유 시트를 취소한 경우엔 그냥 종료 (에러 아님)
      if (shareErr && shareErr.name === "AbortError") return;
      // 그 외 공유 실패는 아래 기존 다운로드 방식으로 폴백
    }

    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
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
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// 파일 이름/MIME이 기기마다 다르게 보고되는 문제 때문에(특히 일부 갤럭시 기종),
// 확장자/타입 대신 파일의 실제 바이너리 시그니처(ftyp box)를 읽어서 HEIC/HEIF 여부를
// 판별한다. 이게 기기 상관없이 제일 확실한 방법.
async function isHeicByContent(file) {
  try {
    const buf = await file.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(buf);
    // bytes[4..7] === "ftyp"
    const ftyp = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
    if (ftyp !== "ftyp") return false;
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    return ["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1"].includes(
      brand
    );
  } catch (e) {
    return false;
  }
}

// 이미 업로드된 영상 URL로부터 첫 프레임을 캡처한다 (기존 영상 썸네일 소급 생성용).
async function generateVideoPosterFromUrl(url) {
  // 영상 URL을 직접 <video>에 연결하면 브라우저가 "교차 출처라 캔버스에서 못 꺼냄"으로
  // 막는 경우(tainted canvas)가 있어서, 먼저 파일을 통째로 내려받아 blob으로 만든 뒤
  // 그 blob으로 캡처한다 (같은 출처 취급되어 캔버스 제한에 안 걸림).
  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) {
    throw new Error("영상 파일을 내려받지 못했습니다.");
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    function cleanup() {
      URL.revokeObjectURL(objectUrl);
    }

    function captureFrame() {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (posterBlob) => {
            cleanup();
            if (!posterBlob) {
              reject(new Error("썸네일 캔버스 변환 실패"));
              return;
            }
            resolve(posterBlob);
          },
          "image/jpeg",
          0.8
        );
      } catch (err) {
        cleanup();
        reject(err);
      }
    }

    video.onloadeddata = () => {
      try {
        video.currentTime = Math.min(0.1, (video.duration || 1) / 2);
      } catch (err) {
        captureFrame();
      }
    };
    video.onseeked = captureFrame;
    video.onerror = () => {
      cleanup();
      reject(new Error("영상을 읽을 수 없습니다."));
    };
  });
}

async function normalizeImageFile(file) {
  if (!file.type.startsWith("image") && file.type !== "") return file;

  const looksHeicByName =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.(heic|heif)$/i.test(file.name);

  const isHeic = looksHeicByName || (await isHeicByContent(file));

  if (!isHeic) return file;

  const heic2any = (await import("heic2any")).default;
  const converted = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.9,
  });
  const finalBlob = Array.isArray(converted) ? converted[0] : converted;
  if (!finalBlob || finalBlob.size === 0) {
    throw new Error("HEIC 변환 결과가 비어있습니다.");
  }
  const newName = file.name.replace(/\.(heic|heif)$/i, ".jpg") || "converted.jpg";

  return new File([finalBlob], newName, { type: "image/jpeg" });
}

// 영상 파일에서 첫 프레임을 캡처해 JPEG 썸네일(Blob)로 만든다.
// <video> 태그가 기기/브라우저마다 첫 프레임을 안정적으로 안 그려주는 문제(특히
// 홈화면 추가 앱, 일부 모바일 브라우저) 때문에, 아예 실제 이미지 파일로 만들어서
// 썸네일용으로 별도 저장하는 방식으로 우회한다.
// 프로미스가 지정 시간 안에 끝나지 않으면 타임아웃 에러로 실패 처리한다.
// 느린 모바일 네트워크에서 업로드가 응답 없이 무한정 멈춰있는 문제를 막기 위함.
function withTimeout(promise, ms, timeoutMessage) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMessage || "요청 시간이 초과되었습니다."));
    }, ms);
    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function generateVideoPoster(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    function cleanup() {
      URL.revokeObjectURL(objectUrl);
    }

    function captureFrame() {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            cleanup();
            if (!blob) {
              reject(new Error("썸네일 캔버스 변환 실패"));
              return;
            }
            resolve(blob);
          },
          "image/jpeg",
          0.8
        );
      } catch (err) {
        cleanup();
        reject(err);
      }
    }

    video.onloadeddata = () => {
      try {
        video.currentTime = Math.min(0.1, (video.duration || 1) / 2);
      } catch (err) {
        captureFrame();
      }
    };
    video.onseeked = captureFrame;
    video.onerror = () => {
      cleanup();
      reject(new Error("영상을 읽을 수 없습니다."));
    };
  });
}

const WATERMARK_ENABLED = false; // 워터마크 임시 비활성화. 다시 켜려면 true로 변경.

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

    const logoWidth = canvas.width * 0.10;
    const logoHeight = logoWidth * (logoImg.naturalHeight / logoImg.naturalWidth);
    const margin = canvas.height * 0.03;
    const x = (canvas.width - logoWidth) / 2;
    const y = canvas.height - logoHeight - margin;

    ctx.globalAlpha = 0.85;
    ctx.drawImage(logoImg, x, y, logoWidth, logoHeight);
    ctx.globalAlpha = 1;

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    );

    if (!blob || blob.size === 0) {
      throw new Error("워터마크 합성 결과가 비어있습니다.");
    }

    return new File([blob], file.name, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function MediaThumb({ m }) {
  if (m.media_type === "video") {
    return (
      <>
        {m.poster_url ? (
          <img
            src={m.poster_url}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <video
            src={m.media_url}
            muted
            playsInline
            preload="metadata"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        )}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              borderTop: "7px solid transparent",
              borderBottom: "7px solid transparent",
              borderLeft: "11px solid white",
              marginLeft: 3,
            }}
          />
        </div>
      </>
    );
  }
  return (
    <img
      src={m.media_url}
      alt=""
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
    />
  );
}

// 그리드 칸(cell) 공통 스타일. overflow:hidden + minWidth/minHeight:0을 항상 명시해서
// 사진 원본 크기가 그리드 트랙 크기 계산에 영향을 주지 않게 강제한다.
// (이게 빠지면 브라우저에 따라 — 특히 안드로이드 크롬에서 — 1행이 부풀고 2행이 눌리는 현상이 생김)
function gridCellStyle(extra) {
  return {
    position: "relative",
    height: "100%",
    minHeight: 0,
    minWidth: 0,
    overflow: "hidden",
    cursor: "pointer",
    ...extra,
  };
}

function MediaGrid({ mediaList, onOpen }) {
  const count = mediaList.length;
  if (count === 0) return null;

  const gap = 2;
  const gridHeight = 260;

  if (count === 1) {
    return (
      <div
        style={{ position: "relative", width: "100%", height: 320, overflow: "hidden", background: "#eee", cursor: "pointer" }}
        onClick={() => onOpen(0)}
      >
        <MediaThumb m={mediaList[0]} />
      </div>
    );
  }

  if (count === 2) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap, height: gridHeight, overflow: "hidden" }}>
        {mediaList.map((m, i) => (
          <div key={m.id} style={gridCellStyle()} onClick={() => onOpen(i)}>
            <MediaThumb m={m} />
          </div>
        ))}
      </div>
    );
  }

  if (count === 3) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap,
          height: gridHeight,
          overflow: "hidden",
        }}
      >
        <div
          style={gridCellStyle({ gridRow: "1 / 3" })}
          onClick={() => onOpen(0)}
        >
          <MediaThumb m={mediaList[0]} />
        </div>
        <div style={gridCellStyle()} onClick={() => onOpen(1)}>
          <MediaThumb m={mediaList[1]} />
        </div>
        <div style={gridCellStyle()} onClick={() => onOpen(2)}>
          <MediaThumb m={mediaList[2]} />
        </div>
      </div>
    );
  }

  const visible = mediaList.slice(0, 4);
  const remaining = count - 4;

  return (
    <div
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr",
        gap,
        height: gridHeight,
        overflow: "hidden",
      }}
    >
      {visible.map((m, i) => {
        const isLastWithMore = i === 3 && remaining > 0;
        return (
          <div
            key={m.id}
            style={gridCellStyle()}
            onClick={() => onOpen(i)}
          >
            <MediaThumb m={m} />
            {isLastWithMore && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ color: "white", fontSize: 22, fontWeight: 700 }}>
                  +{remaining}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function navZoneStyle(side) {
  return {
    position: "absolute",
    [side]: 0,
    top: 0,
    bottom: 0,
    width: "35%",
    display: "flex",
    alignItems: "center",
    justifyContent: side === "left" ? "flex-start" : "flex-end",
    padding: "0 10px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    zIndex: 5,
  };
}

const navCircleStyle = {
  width: 40,
  height: 40,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.15)",
  color: "white",
  fontSize: 22,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "none",
};

function navBtnStyle(side) {
  return {
    position: "absolute",
    [side]: 10,
    top: "50%",
    transform: "translateY(-50%)",
    background: "rgba(255,255,255,0.15)",
    color: "white",
    border: "none",
    borderRadius: "50%",
    width: 40,
    height: 40,
    fontSize: 22,
    cursor: "pointer",
  };
}

function Lightbox({
  mediaList,
  index,
  t,
  title,
  caption,
  authorLabel,
  roleText,
  dateLabel,
  canDelete,
  isEditing,
  editTitleValue,
  editValue,
  editCategoryId,
  categories,
  onChangeEditTitle,
  onChangeEditValue,
  onChangeEditCategory,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  deleting,
  onClose,
  onChange,
}) {
  const touchStartX = useRef(null);
  const m = mediaList[index];

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "ArrowLeft") onChange(index - 1);
      if (e.key === "ArrowRight") onChange(index + 1);
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [index, onChange, onClose]);

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e) {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (deltaX > 50) onChange(index - 1);
    else if (deltaX < -50) onChange(index + 1);
    touchStartX.current = null;
  }

  if (!m) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.92)",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: 14,
        }}
      >
        <span style={{ color: "white", fontSize: 13 }}>
          {index + 1} / {mediaList.length}
        </span>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => downloadMedia(m.media_url)}
            style={{
              background: "rgba(255,255,255,0.15)",
              color: "white",
              border: "none",
              borderRadius: 20,
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ↓ {t("gallery.download")}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.15)",
              color: "white",
              border: "none",
              borderRadius: 20,
              width: 32,
              height: 32,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {index > 0 && (
          <button
            type="button"
            onClick={() => onChange(index - 1)}
            aria-label={t("gallery.prevPhotoAria")}
            style={navZoneStyle("left")}
          >
            <span style={navCircleStyle}>‹</span>
          </button>
        )}

        {m.media_type === "video" ? (
          <video
            src={m.media_url}
            controls
            autoPlay
            style={{ maxWidth: "100%", maxHeight: "100%" }}
          />
        ) : (
          <img
            src={m.media_url}
            alt=""
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
        )}

        {index < mediaList.length - 1 && (
          <button
            type="button"
            onClick={() => onChange(index + 1)}
            aria-label={t("gallery.nextPhotoAria")}
            style={navZoneStyle("right")}
          >
            <span style={navCircleStyle}>›</span>
          </button>
        )}
      </div>

      <div style={{ padding: 14 }}>
        {isEditing ? (
          <div>
            <input
              type="text"
              value={editTitleValue}
              onChange={(e) => onChangeEditTitle(e.target.value)}
              placeholder="제목"
              style={{
                width: "100%",
                borderRadius: 8,
                border: "1px solid #555",
                background: "rgba(255,255,255,0.08)",
                color: "white",
                padding: 8,
                fontSize: 14,
                fontWeight: 700,
                marginBottom: 8,
              }}
            />
            <textarea
              value={editValue}
              onChange={(e) => onChangeEditValue(e.target.value)}
              rows={2}
              placeholder="설명"
              style={{
                width: "100%",
                borderRadius: 8,
                border: "1px solid #555",
                background: "rgba(255,255,255,0.08)",
                color: "white",
                padding: 8,
                fontSize: 14,
                resize: "none",
              }}
            />
            <select
              value={editCategoryId || ""}
              onChange={(e) => onChangeEditCategory(e.target.value)}
              style={{
                width: "100%",
                borderRadius: 8,
                border: "1px solid #555",
                background: "rgba(255,255,255,0.08)",
                color: "white",
                padding: 8,
                fontSize: 14,
                marginTop: 8,
              }}
            >
              <option value="" style={{ color: "black" }}>
                카테고리 없음
              </option>
              {(categories || []).map((c) => (
                <option key={c.id} value={c.id} style={{ color: "black" }}>
                  {c.name}
                </option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                type="button"
                onClick={onSaveEdit}
                style={{
                  background: "#0b3d2e",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "6px 14px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                저장
              </button>
              <button
                type="button"
                onClick={onCancelEdit}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "6px 14px",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <>
            {title && (
              <p style={{ color: "white", fontSize: 15, fontWeight: 700, margin: 0, lineHeight: 1.4 }}>
                {title}
              </p>
            )}
            {caption && (
              <p
                style={{
                  color: "white",
                  fontSize: 14,
                  margin: title ? "4px 0 0" : 0,
                  lineHeight: 1.5,
                }}
              >
                {caption}
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
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
                {authorLabel}
                {roleText ? ` · ${roleText}` : ""} · {dateLabel}
              </span>
              {canDelete && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={onStartEdit}
                    style={{
                      background: "rgba(255,255,255,0.15)",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      padding: "4px 10px",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={onDelete}
                    disabled={deleting}
                    style={{
                      background: "rgba(179,38,30,0.85)",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      padding: "4px 10px",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    {deleting ? "삭제 중..." : "삭제"}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PhotosPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const { t, lang } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [canUpload, setCanUpload] = useState(false);
  const [userId, setUserId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [posts, setPosts] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");

  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [uploadCategoryId, setUploadCategoryId] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [backfilling, setBackfilling] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState({ current: 0, total: 0 });
  const [backfillMsg, setBackfillMsg] = useState("");
  const [converting, setConverting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [lightbox, setLightbox] = useState(null); // { postId, index }
  const [editingPostId, setEditingPostId] = useState(null);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [editCaptionValue, setEditCaptionValue] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");

  const loadRequestIdRef = useRef(0);

  async function loadPosts() {
    const requestId = ++loadRequestIdRef.current;

    // 세션이 아직 메모리에 복원되지 않은 순간에 조회하면 RLS에 막혀
    // title/author 같은 보호된 데이터가 조용히 빠질 수 있으므로,
    // 매 조회 전 세션이 실제로 준비됐는지 먼저 확인한다.
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      // 세션이 아직 안 돌아왔다면 잠깐 기다렸다가 한 번만 재시도
      await new Promise((resolve) => setTimeout(resolve, 300));
      const retry = await supabase.auth.getSession();
      if (!retry.data.session) {
        // 그래도 세션이 없으면 로그인 만료 등 실제 문제이므로 조용히 종료
        return;
      }
    }

    const { data, error } = await supabase
      .from("photo_posts")
      .select(
        "id, title, caption, uploaded_by, created_at, category_id, gallery_categories(id, name), photo_post_media(id, media_url, media_type, poster_url, order_index), author:users!uploaded_by(name, role)"
      )
      .order("created_at", { ascending: false });

    // 이 요청이 시작된 후 더 최신 요청이 시작됐다면, 이 결과는 낡은 것이므로 무시
    if (requestId !== loadRequestIdRef.current) return;

    if (!error) {
      const withSortedMedia = (data || []).map((p) => ({
        ...p,
        photo_post_media: [...(p.photo_post_media || [])].sort(
          (a, b) => a.order_index - b.order_index
        ),
      }));
      setPosts(withSortedMedia);
    } else {
      setErrorMsg(t("gallery.errLoadPrefix") + error.message);
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

      const { data: categoryData } = await supabase
        .from("gallery_categories")
        .select("id, name, sort_order, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      setCategories(categoryData || []);

      await loadPosts();
      setLoading(false);
    }

    load();

    let debounceTimer = null;
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        // visibilitychange와 pageshow가 동시에 발동해도 한 번만 실행되도록 짧게 묶음
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          loadPosts();
        }, 50);
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handleVisibilityChange);
    return () => {
      clearTimeout(debounceTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handleVisibilityChange);
    };
  }, [router]);

  const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024; // Supabase 기본 업로드 제한(50MB) 기준

  async function handleFileChange(e) {
    const rawFiles = Array.from(e.target.files || []);
    if (rawFiles.length === 0) return;

    // 50MB 넘는 파일은 업로드 시도 자체를 하지 않고 바로 제외 (타임아웃까지 기다릴 필요 없이 즉시 안내)
    const oversizedNames = [];
    const sizeOkFiles = [];
    for (const f of rawFiles) {
      if (f.size > MAX_UPLOAD_SIZE_BYTES) {
        oversizedNames.push(`${f.name} (${(f.size / 1024 / 1024).toFixed(1)}MB)`);
      } else {
        sizeOkFiles.push(f);
      }
    }

    setConverting(true);
    setErrorMsg("");

    const converted = [];
    const failedNames = [];
    for (const f of sizeOkFiles) {
      try {
        converted.push(await normalizeImageFile(f));
      } catch (err) {
        // 변환 실패한 파일(주로 HEIC)은 화면에 안 뜨는 깨진 파일로 올라가는 걸
        // 막기 위해 목록에서 제외하고, 사용자에게 알려준다.
        failedNames.push(f.name);
      }
    }

    setConverting(false);
    setSelectedFiles(converted);
    setPreviews(
      converted.map((f) => ({
        url: URL.createObjectURL(f),
        isVideo: f.type.startsWith("video"),
      }))
    );

    const messages = [];
    if (oversizedNames.length > 0) {
      messages.push(
        `다음 파일은 50MB를 초과해 제외되었습니다: ${oversizedNames.join(", ")} (동영상은 압축하거나 짧게 잘라서 다시 시도해주세요)`
      );
    }
    if (failedNames.length > 0) {
      messages.push(
        `다음 파일은 변환에 실패해 제외되었습니다: ${failedNames.join(", ")} (다른 사진으로 다시 시도해주세요)`
      );
    }
    if (messages.length > 0) {
      setErrorMsg(messages.join(" / "));
    }
  }

  // 예전에 올라간, poster_url이 없는 영상들을 찾아서 첫 프레임 썸네일을 소급 생성한다.
  async function handleBackfillPosters() {
    setBackfilling(true);
    setBackfillMsg("");

    const { data: targets, error: fetchError } = await supabase
      .from("photo_post_media")
      .select("id, media_url")
      .eq("media_type", "video")
      .is("poster_url", null);

    if (fetchError) {
      setBackfillMsg("대상 조회 실패: " + fetchError.message);
      setBackfilling(false);
      return;
    }

    if (!targets || targets.length === 0) {
      setBackfillMsg("썸네일이 없는 예전 영상이 없습니다. 이미 다 처리되어 있어요.");
      setBackfilling(false);
      return;
    }

    setBackfillProgress({ current: 0, total: targets.length });
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < targets.length; i++) {
      setBackfillProgress({ current: i + 1, total: targets.length });
      const row = targets[i];
      try {
        const posterBlob = await withTimeout(
          generateVideoPosterFromUrl(row.media_url),
          20000,
          "포스터 생성 시간 초과"
        );
        const posterPath = `backfill-${row.id}-poster.jpg`;
        const { error: uploadErr } = await supabase.storage
          .from("photos")
          .upload(posterPath, posterBlob, { contentType: "image/jpeg", upsert: true });

        if (uploadErr) {
          failCount += 1;
          continue;
        }

        const { data: urlData } = supabase.storage.from("photos").getPublicUrl(posterPath);

        const { error: updateErr } = await supabase
          .from("photo_post_media")
          .update({ poster_url: urlData.publicUrl })
          .eq("id", row.id);

        if (updateErr) {
          failCount += 1;
        } else {
          successCount += 1;
        }
      } catch (err) {
        failCount += 1;
      }
    }

    setBackfilling(false);
    setBackfillMsg(`완료: 성공 ${successCount}건, 실패 ${failCount}건`);
    await loadPosts();
  }

  function resetForm() {
    setSelectedFiles([]);
    setPreviews([]);
    setTitle("");
    setCaption("");
    setUploadCategoryId("");
    setShowForm(false);
    setUploadProgress({ current: 0, total: 0 });
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
      title: title || null,
      caption: caption || null,
      uploaded_by: userId,
      category_id: uploadCategoryId || null,
    });

    if (postError) {
      setUploading(false);
      setErrorMsg("게시물 생성 실패: " + postError.message);
      return;
    }

    const mediaRows = [];
    setUploadProgress({ current: 0, total: selectedFiles.length });

    for (let i = 0; i < selectedFiles.length; i++) {
      setUploadProgress({ current: i + 1, total: selectedFiles.length });
      const file = selectedFiles[i];
      const mediaType = file.type.startsWith("video") ? "video" : "image";

      let fileToUpload = file;
      if (mediaType === "image" && WATERMARK_ENABLED) {
        try {
          fileToUpload = await addWatermark(file);
        } catch (wmError) {
          fileToUpload = file;
        }
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
      const path = `${postId}-${i}-${safeName}`;

      let uploadError = null;
      try {
        const result = await withTimeout(
          supabase.storage.from("photos").upload(path, fileToUpload, {
            contentType: fileToUpload.type || "application/octet-stream",
            upsert: false,
          }),
          30000,
          "업로드 시간 초과 (네트워크가 느리거나 끊겼을 수 있어요)"
        );
        uploadError = result.error;
      } catch (timeoutErr) {
        uploadError = timeoutErr;
      }

      if (uploadError) {
        setErrorMsg(`업로드 실패 (${file.name}): ` + uploadError.message);
        continue;
      }

      const { data: urlData } = supabase.storage.from("photos").getPublicUrl(path);

      let posterUrl = null;
      if (mediaType === "video") {
        try {
          const posterBlob = await generateVideoPoster(file);
          const posterPath = `${postId}-${i}-poster.jpg`;
          const { error: posterUploadError } = await supabase.storage
            .from("photos")
            .upload(posterPath, posterBlob, {
              contentType: "image/jpeg",
              upsert: false,
            });
          if (!posterUploadError) {
            const { data: posterUrlData } = supabase.storage
              .from("photos")
              .getPublicUrl(posterPath);
            posterUrl = posterUrlData.publicUrl;
          }
        } catch (posterError) {
          // 썸네일 생성 실패해도 영상 업로드 자체는 그대로 진행 (기존 <video> 방식으로 대체 표시됨)
          posterUrl = null;
        }
      }

      mediaRows.push({
        post_id: postId,
        media_url: urlData.publicUrl,
        media_type: mediaType,
        poster_url: posterUrl,
        order_index: i,
      });
    }

    if (mediaRows.length === 0) {
      // 파일이 하나도 정상 업로드되지 않았으면, 이미 만들어둔 게시물(photo_posts) 행을
      // 그대로 두면 사진 없는 껍데기 게시물이 갤러리에 남는다. 자동으로 롤백(삭제)한다.
      await supabase.from("photo_posts").delete().eq("id", postId);
      setUploading(false);
      setErrorMsg("사진/영상 업로드에 실패해 게시물이 생성되지 않았습니다. 다시 시도해주세요.");
      return;
    }

    const { error: mediaInsertError } = await supabase
      .from("photo_post_media")
      .insert(mediaRows);

    if (mediaInsertError) {
      // 사진 정보 저장까지 실패하면 스토리지에는 파일이 남아있어도 게시물 자체는
      // 무의미해지므로 마찬가지로 롤백한다.
      await supabase.from("photo_posts").delete().eq("id", postId);
      setUploading(false);
      setErrorMsg("사진 정보 저장 실패: " + mediaInsertError.message);
      return;
    }

    setUploading(false);
    resetForm();
    await loadPosts();
  }

  async function handleDeletePost(id) {
    setDeletingId(id);
    await supabase.from("photo_posts").delete().eq("id", id);
    if (lightbox && lightbox.postId === id) {
      setLightbox(null);
    }
    await loadPosts();
    setDeletingId(null);
  }

  function startEditCaption(post) {
    setEditingPostId(post.id);
    setEditTitleValue(post.title || "");
    setEditCaptionValue(post.caption || "");
    setEditCategoryId(post.category_id || "");
  }

  function cancelEditCaption() {
    setEditingPostId(null);
    setEditTitleValue("");
    setEditCaptionValue("");
    setEditCategoryId("");
  }

  async function saveEditCaption(postId) {
    const { error } = await supabase
      .from("photo_posts")
      .update({
        title: editTitleValue || null,
        caption: editCaptionValue || null,
        category_id: editCategoryId || null,
      })
      .eq("id", postId);

    if (error) {
      setErrorMsg("수정 실패: " + error.message);
      return;
    }

    setEditingPostId(null);
    setEditTitleValue("");
    setEditCaptionValue("");
    await loadPosts();
  }

  if (loading) {
    return (
      <main className="page">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 4 }}>
          <img src="/logo-main.png" alt="" style={{ width: 30, height: "auto" }} />
          <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>
            {t("login.title")}
          </div>
        </div>
        <div style={{ fontSize: 14, color: "#8ea0b8", marginBottom: 28, textAlign: "center" }}>{t("gallery.subtitle")}</div>
        {[1, 2].map((i) => (
          <div
            key={i}
            className="card"
            style={{ marginBottom: 20, padding: 0, overflow: "hidden" }}
          >
            <div
              style={{
                width: "100%",
                height: 260,
                background:
                  "linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%)",
                backgroundSize: "200% 100%",
                animation: "djs-skeleton 1.4s ease-in-out infinite",
              }}
            />
            <div style={{ padding: 16 }}>
              <div
                style={{
                  width: "40%",
                  height: 16,
                  borderRadius: 4,
                  background: "#eee",
                  marginBottom: 8,
                }}
              />
              <div
                style={{
                  width: "70%",
                  height: 12,
                  borderRadius: 4,
                  background: "#f0f0f0",
                }}
              />
            </div>
          </div>
        ))}
        <style>{`
          @keyframes djs-skeleton {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
      </main>
    );
  }

  const lightboxPost = lightbox ? posts.find((p) => p.id === lightbox.postId) : null;
  const lightboxMediaList = lightboxPost ? lightboxPost.photo_post_media || [] : [];
  const lightboxIndex = lightboxPost
    ? Math.min(Math.max(lightbox.index, 0), lightboxMediaList.length - 1)
    : 0;

  return (
    <main className="page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 4 }}>
        <img src="/logo-main.png" alt="" style={{ width: 30, height: "auto" }} />
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>
          {t("login.title")}
        </div>
      </div>
      <div style={{ fontSize: 14, color: "#8ea0b8", marginBottom: 28, textAlign: "center" }}>{t("gallery.subtitle")}</div>

      {isAdmin && (
        <div className="card" style={{ marginBottom: 20, padding: 14 }}>
          <button
            type="button"
            disabled={backfilling}
            onClick={handleBackfillPosters}
            style={{
              width: "100%",
              padding: 12,
              fontSize: 13,
              fontWeight: 700,
              color: "#3B82C4",
              background: "white",
              border: "1px solid #3B82C4",
              borderRadius: 10,
              cursor: backfilling ? "default" : "pointer",
              opacity: backfilling ? 0.6 : 1,
            }}
          >
            {backfilling
              ? `기존 영상 썸네일 생성 중... (${backfillProgress.current}/${backfillProgress.total})`
              : "기존 영상 썸네일 일괄 생성"}
          </button>
          {backfillMsg && (
            <div style={{ fontSize: 12, color: "#4a5c73", marginTop: 8 }}>{backfillMsg}</div>
          )}
        </div>
      )}

      {canUpload && (
        <div className="card" style={{ marginBottom: 20 }}>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              style={{
                width: "100%",
                padding: 16,
                fontSize: 16,
                fontWeight: 700,
                color: "white",
                background: "#3B82C4",
                border: "none",
                borderRadius: 12,
                cursor: "pointer",
              }}
            >
              + 사진/동영상 올리기
            </button>
          ) : (
            <form onSubmit={handleUpload}>
              <label>사진 또는 동영상 (여러 개 선택 가능)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,.heic,.heif"
                multiple
                onChange={handleFileChange}
                style={{ marginTop: 4 }}
              />

              {converting && (
                <p style={{ fontSize: 13, color: "#0b3d2e", marginTop: 8 }}>
                  사진 형식을 변환하는 중입니다...
                </p>
              )}

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

              <label>제목 (선택)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 유아A반 8월 훈련"
              />

              <label>설명 (선택)</label>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="예: 오늘 유아A반 훈련 모습"
              />

              <label>카테고리 (선택)</label>
              <select
                value={uploadCategoryId}
                onChange={(e) => setUploadCategoryId(e.target.value)}
                style={{
                  width: "100%",
                  padding: 14,
                  fontSize: 16,
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  background: "#fafafa",
                }}
              >
                <option value="">-- 선택 안 함 --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {errorMsg && <div className="message error">{errorMsg}</div>}

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button
                  type="submit"
                  disabled={uploading || converting}
                  style={{
                    flex: 1,
                    padding: 14,
                    fontSize: 15,
                    fontWeight: 700,
                    color: "white",
                    background: "#3B82C4",
                    border: "none",
                    borderRadius: 10,
                    cursor: "pointer",
                  }}
                >
                  {uploading
                    ? `업로드 중... (${uploadProgress.current}/${uploadProgress.total})`
                    : "게시하기"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  style={{
                    padding: "14px 20px",
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#5b7699",
                    background: "white",
                    border: "1px solid #e5eaf2",
                    borderRadius: 10,
                    cursor: "pointer",
                  }}
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

      {/* 카테고리 필터 탭 */}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 14,
          overflowX: "auto",
          paddingBottom: 2,
        }}
      >
        {[{ id: "all", name: t("gallery.allCategory") }, ...categories].map((c) => {
          const active = categoryFilter === c.id;
          const dotColor = c.id === "all" ? null : getCategoryColor(c.id, categories);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryFilter(c.id)}
              style={{
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                background: active ? "#3B82C4" : "white",
                color: active ? "white" : "#5b7699",
                boxShadow: active ? "none" : "0 1px 4px rgba(30,60,110,0.08)",
              }}
            >
              {dotColor && (
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: active ? "white" : dotColor,
                    flexShrink: 0,
                  }}
                />
              )}
              {translateCategoryName(c.name, lang)}
            </button>
          );
        })}
      </div>

      {(() => {
        const filteredPosts =
          categoryFilter === "all"
            ? posts
            : posts.filter((p) => p.category_id === categoryFilter);

        const latestPost = posts[0];

        return (
          <>
            {latestPost && (
              <div
                style={{
                  background: "#e9f1fb",
                  borderRadius: 12,
                  padding: "12px 14px",
                  marginBottom: 16,
                  fontSize: 13,
                  color: "#1b3a63",
                  cursor: "pointer",
                }}
                onClick={() => setLightbox({ postId: latestPost.id, index: 0 })}
              >
                <span style={{ fontWeight: 700 }}>{t("gallery.newPhotoBanner")}</span>{" "}
                {latestPost.title
                  ? `${latestPost.title} · ${formatDate(latestPost.created_at)}`
                  : formatDate(latestPost.created_at)}
              </div>
            )}

            {filteredPosts.length === 0 && !errorMsg && (
              <div className="card">
                <p style={{ fontSize: 14, color: "#777", margin: 0 }}>
                  {t("gallery.noPosts")}
                </p>
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              {filteredPosts.map((post) => {
                const mediaList = post.photo_post_media || [];
                const firstMedia = mediaList[0];
                const categoryName = post.gallery_categories?.name;
                const categoryColor = getCategoryColor(post.category_id, categories);

                return (
                  <div
                    key={post.id}
                    onClick={() => setLightbox({ postId: post.id, index: 0 })}
                    style={{
                      position: "relative",
                      borderRadius: 14,
                      overflow: "hidden",
                      boxShadow: "0 2px 10px rgba(30,60,110,0.1)",
                      cursor: "pointer",
                      height: 190,
                      background: "#eee",
                    }}
                  >
                    {firstMedia && <MediaThumb m={firstMedia} />}

                    {/* 하단 가독성용 그라디언트 오버레이 */}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background:
                          "linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.6) 100%)",
                      }}
                    />

                    {categoryName && (
                      <span
                        style={{
                          position: "absolute",
                          top: 8,
                          left: 8,
                          fontSize: 10,
                          fontWeight: 700,
                          color: "white",
                          background: categoryColor + "cc",
                          padding: "3px 9px",
                          borderRadius: 999,
                        }}
                      >
                        {categoryName}
                      </span>
                    )}
                    {mediaList.length > 1 && (
                      <span
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          fontSize: 10,
                          fontWeight: 700,
                          color: "white",
                          background: "rgba(0,0,0,0.55)",
                          padding: "2px 7px",
                          borderRadius: 999,
                        }}
                      >
                        +{mediaList.length - 1}
                      </span>
                    )}

                    <div
                      style={{
                        position: "absolute",
                        left: 12,
                        right: 12,
                        bottom: 10,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "white",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          textShadow: "0 1px 3px rgba(0,0,0,0.4)",
                        }}
                      >
                        {post.title || t("gallery.noTitle")}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "rgba(255,255,255,0.85)",
                          marginTop: 2,
                          textShadow: "0 1px 3px rgba(0,0,0,0.4)",
                        }}
                      >
                        {formatDate(post.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        );
      })()}

      {lightboxPost && (
        <Lightbox
          mediaList={lightboxMediaList}
          index={lightboxIndex}
          t={t}
          title={lightboxPost.title}
          caption={lightboxPost.caption}
          authorLabel={lightboxPost.author?.name || t("gallery.unknownAuthor")}
          roleText={roleLabel(lightboxPost.author?.role, t)}
          dateLabel={formatDate(lightboxPost.created_at)}
          canDelete={isAdmin || lightboxPost.uploaded_by === userId}
          isEditing={editingPostId === lightboxPost.id}
          editTitleValue={editTitleValue}
          editValue={editCaptionValue}
          editCategoryId={editCategoryId}
          categories={categories}
          onChangeEditCategory={setEditCategoryId}
          onChangeEditTitle={setEditTitleValue}
          onChangeEditValue={setEditCaptionValue}
          onStartEdit={() => startEditCaption(lightboxPost)}
          onCancelEdit={cancelEditCaption}
          onSaveEdit={() => saveEditCaption(lightboxPost.id)}
          onDelete={() => handleDeletePost(lightboxPost.id)}
          deleting={deletingId === lightboxPost.id}
          onClose={() => setLightbox(null)}
          onChange={(newIndex) => {
            if (newIndex < 0 || newIndex >= lightboxMediaList.length) return;
            setLightbox({ postId: lightboxPost.id, index: newIndex });
          }}
        />
      )}
    </main>
  );
}
