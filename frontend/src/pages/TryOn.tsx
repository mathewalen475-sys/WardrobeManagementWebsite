import React, { useState, useRef, useCallback, useEffect } from "react";
import Sidebar from "../components/sidebar";
import { removeBackground } from "../utils/removeBg";
import "../styles/TryOn.css";

type InputMode = "upload" | "camera" | "url";
type GarmentSlot = "top" | "bottom";

interface TryOnScores {
  style: number | null;
  versatility: number | null;
  trendiness: number | null;
  overall: number | null;
}

interface TryOnResult {
  resultImageUrl: string | null;
  outfitImageUrl: string | null;
  topImageUrl: string | null;
  bottomImageUrl: string | null;
  analysis: string;
  scores: TryOnScores;
  garmentType: string | null;
  primaryColor: string | null;
  mannequinLabel: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
const DEFAULT_MANNEQUIN_ID = "male-1";
const DEFAULT_MANNEQUIN_LABEL = "Auto Mannequin";
const MANNEQUIN_IMAGE_CANDIDATES = [
  "/mannequin-base.png",
  "/mannequin-base.jpg",
  "/mannequin-base.jpeg",
  "/mannequin-base.webp",
  "/mannequin.png",
  "/mannequin.jpg",
  "/mannequin.jpeg",
  "/mannequin.webp",
];

function parseAnalysisSections(text: string) {
  const sections: { title: string; content: string }[] = [];
  const lines = text.split("\n");
  let currentTitle = "";
  let currentContent: string[] = [];
  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)/);
    if (headingMatch) {
      if (currentTitle) sections.push({ title: currentTitle, content: currentContent.join("\n").trim() });
      currentTitle = headingMatch[1].replace(/_/g, " ");
      currentContent = [];
    } else if (!line.includes("TRYON_SCORE")) {
      currentContent.push(line);
    }
  }
  if (currentTitle) sections.push({ title: currentTitle, content: currentContent.join("\n").trim() });
  return sections;
}

function buildPersonalizedSummary(result: TryOnResult, sections: { title: string; content: string }[]) {
  const garmentType = (result.garmentType || "outfit").toLowerCase();
  const colorText = result.primaryColor ? ` in ${result.primaryColor}` : "";
  const overallText = result.scores.overall !== null ? `${result.scores.overall}/10` : "N/A";
  const styleText = result.scores.style !== null ? `${result.scores.style}/10` : "N/A";
  const versatilityText = result.scores.versatility !== null ? `${result.scores.versatility}/10` : "N/A";

  const occasionSection = sections.find((section) => section.title.toLowerCase().includes("occasion"));
  const firstOccasion = occasionSection?.content
    ?.split(/[.\n]/)
    ?.map((line) => line.trim())
    ?.find(Boolean);

  const fitSection = sections.find((section) => section.title.toLowerCase().includes("fit"));
  const fitHint = fitSection?.content
    ?.split(/[.\n]/)
    ?.map((line) => line.trim())
    ?.find(Boolean);

  return [
    `For you, this ${garmentType}${colorText} gives a clean and balanced look on the mannequin.`,
    `Overall style score is ${overallText} (style ${styleText}, versatility ${versatilityText}).`,
    firstOccasion ? `Best suited for: ${firstOccasion}.` : null,
    fitHint ? `Fit note: ${fitHint}.` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

/* ═══════════════════════════════════════════════════
   Process a garment image: remove background
   ═══════════════════════════════════════════════════ */
async function processGarmentImage(
  source: File | Blob | string
): Promise<{ file: File; previewUrl: string }> {
  const result = await removeBackground(source, {
    tolerance: 60,
    featherRadius: 2,
    maxDimension: 600,
  });
  const file = new File([result.blob], "garment-nobg.png", { type: "image/png" });
  return { file, previewUrl: result.url };
}

/* ═══════════════════════════════════════════════════
   Mannequin Canvas
   ═══════════════════════════════════════════════════ */
function MannequinCanvas({
  mannequinLabel,
  selectedMannequinLabel,
  mannequinImageUrl,
  topPreview,
  bottomPreview,
  loading,
}: {
  mannequinLabel: string;
  selectedMannequinLabel: string;
  mannequinImageUrl: string | null;
  topPreview: string | null;
  bottomPreview: string | null;
  loading: boolean;
}) {
  return (
    <div className="mannequin-stage">
      <div className="mannequin-stage-header">
        <div>
          <span className="mannequin-stage-kicker">Preview</span>
          <h3>{mannequinLabel}</h3>
        </div>
        <span className="mannequin-stage-chip">{selectedMannequinLabel}</span>
      </div>

      <div className={`mannequin-figure ${loading ? "loading" : ""}`}>
        <div className="mannequin-halo" />
        <div className="mannequin-head-overlay" />
        <div className="mannequin-hand-overlay mannequin-hand-left" />
        <div className="mannequin-hand-overlay mannequin-hand-right" />

        {mannequinImageUrl ? (
          <img className="mannequin-photo" src={mannequinImageUrl} alt="Base mannequin" />
        ) : (
          <div className="mannequin-fallback-shell" />
        )}

        {/* Top clothing slot */}
        <div className={`mannequin-clothing-slot mannequin-slot-top ${topPreview ? "has-image" : ""}`}>
          {topPreview ? (
            <img src={topPreview} alt="Top garment" />
          ) : (
            <>
              <span className="material-symbols-outlined">checkroom</span>
              <strong>Top</strong>
              <span>Upload a shirt, jacket, or blouse</span>
            </>
          )}
        </div>

        {/* Bottom clothing slot */}
        <div className={`mannequin-clothing-slot mannequin-slot-bottom ${bottomPreview ? "has-image" : ""}`}>
          {bottomPreview ? (
            <img src={bottomPreview} alt="Bottom garment" />
          ) : (
            <>
              <span className="material-symbols-outlined">checkroom</span>
              <strong>Bottom</strong>
              <span>Upload pants, skirt, or shorts</span>
            </>
          )}
        </div>

        {loading && (
          <div className="tryon-loading-overlay">
            <div className="tryon-spinner" />
            <p>Processing AI Try-On...</p>
            <span className="loading-hint">This usually takes 15–20 seconds</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Main TryOn Page
   ═══════════════════════════════════════════════════ */
const TryOn: React.FC = () => {
  const [inputMode, setInputMode] = useState<InputMode>("upload");
  const [activeSlot, setActiveSlot] = useState<GarmentSlot>("top");

  // Top garment
  const [topFile, setTopFile] = useState<File | null>(null);
  const [topPreview, setTopPreview] = useState<string | null>(null);

  // Bottom garment
  const [bottomFile, setBottomFile] = useState<File | null>(null);
  const [bottomPreview, setBottomPreview] = useState<string | null>(null);

  // Processing state for bg removal
  const [processing, setProcessing] = useState(false);
  const [mannequinCutoutUrl, setMannequinCutoutUrl] = useState<string | null>(null);

  const [garmentUrl, setGarmentUrl] = useState("");
  const [result, setResult] = useState<TryOnResult | null>(null);
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentPreview = activeSlot === "top" ? topPreview : bottomPreview;

  useEffect(() => {
    return () => { stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      for (const candidate of MANNEQUIN_IMAGE_CANDIDATES) {
        try {
          const cutout = await removeBackground(candidate, {
            tolerance: 40,
            featherRadius: 1,
            maxDimension: 900,
          });

          if (!cancelled) {
            setMannequinCutoutUrl(cutout.url);
          }
          return;
        } catch {
          // Try next candidate file path.
        }
      }

      if (!cancelled) {
        setMannequinCutoutUrl(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ─── Camera ────────────────────────────────────── */
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);
    } catch {
      setCameraError("Camera access denied or unavailable.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);
    stopCamera();

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      setProcessing(true);
      try {
        const { file, previewUrl } = await processGarmentImage(blob);
        if (activeSlot === "top") { setTopFile(file); setTopPreview(previewUrl); }
        else { setBottomFile(file); setBottomPreview(previewUrl); }
      } catch {
        // Fallback: use original without bg removal
        const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
        const previewUrl = URL.createObjectURL(blob);
        if (activeSlot === "top") { setTopFile(file); setTopPreview(previewUrl); }
        else { setBottomFile(file); setBottomPreview(previewUrl); }
      } finally {
        setProcessing(false);
      }
    }, "image/jpeg", 0.92);
  }, [stopCamera, activeSlot]);

  /* ─── File handling (with BG removal) ──────────── */
  const handleFile = useCallback(async (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) { setError("Please select a valid image file."); return; }
    if (file.size > MAX_FILE_SIZE) { setError("File is too large (max 5 MB)."); return; }

    setProcessing(true);
    try {
      const { file: processedFile, previewUrl } = await processGarmentImage(file);
      if (activeSlot === "top") { setTopFile(processedFile); setTopPreview(previewUrl); }
      else { setBottomFile(processedFile); setBottomPreview(previewUrl); }
    } catch {
      // Fallback: use original image without bg removal
      const previewUrl = URL.createObjectURL(file);
      if (activeSlot === "top") { setTopFile(file); setTopPreview(previewUrl); }
      else { setBottomFile(file); setBottomPreview(previewUrl); }
    } finally {
      setProcessing(false);
    }
  }, [activeSlot]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  /* ─── URL fetch ─────────────────────────────────── */
  const fetchFromUrl = useCallback(async () => {
    if (!garmentUrl.trim()) return;
    setError(null);
    setProcessing(true);
    try {
      const res = await fetch(garmentUrl);
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      if (!blob.type.startsWith("image/")) { setError("URL is not an image."); setProcessing(false); return; }
      const { file, previewUrl } = await processGarmentImage(blob);
      if (activeSlot === "top") { setTopFile(file); setTopPreview(previewUrl); }
      else { setBottomFile(file); setBottomPreview(previewUrl); }
      setGarmentUrl("");
    } catch {
      setError("Could not load image from URL.");
    } finally {
      setProcessing(false);
    }
  }, [garmentUrl, activeSlot]);

  /* ─── Clear ─────────────────────────────────────── */
  const clearSlot = useCallback((slot: GarmentSlot) => {
    if (slot === "top") { setTopFile(null); setTopPreview(null); }
    else { setBottomFile(null); setBottomPreview(null); }
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const clearAll = useCallback(() => {
    setTopFile(null); setTopPreview(null);
    setBottomFile(null); setBottomPreview(null);
    setGarmentUrl(""); setResult(null);
    setShowDetailedAnalysis(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const switchMode = useCallback((mode: InputMode) => {
    if (mode !== "camera") stopCamera();
    setInputMode(mode);
    setError(null);
    setCameraError(null);
  }, [stopCamera]);

  /* ─── Generate ──────────────────────────────────── */
  const hasAnyGarment = !!(topFile || topPreview || bottomFile || bottomPreview);
  const canGenerate = hasAnyGarment && !loading && !processing;

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setShowDetailedAnalysis(false);

    try {
      const formData = new FormData();
      if (topFile) formData.append("topGarment", topFile);
      if (bottomFile) formData.append("bottomGarment", bottomFile);
      formData.append("mannequinId", DEFAULT_MANNEQUIN_ID);

      const res = await fetch(`${BASE_URL}/api/try-on`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Try-on generation failed.");
      }

      const data = await res.json();
      setResult({
        resultImageUrl: data.resultImageUrl || null,
        outfitImageUrl: data.outfitImageUrl || data.resultImageUrl || null,
        topImageUrl: data.topImageUrl || null,
        bottomImageUrl: data.bottomImageUrl || null,
        analysis: data.analysis || "",
        scores: data.scores || { style: null, versatility: null, trendiness: null, overall: null },
        garmentType: data.garmentType || null,
        primaryColor: data.primaryColor || null,
        mannequinLabel: data.mannequin?.label || "Mannequin",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [canGenerate, topFile, bottomFile]);

  const analysisSections = result?.analysis ? parseAnalysisSections(result.analysis) : [];
  const personalizedSummary = result ? buildPersonalizedSummary(result, analysisSections) : "";
  const selectedMannequinLabel = DEFAULT_MANNEQUIN_LABEL;

  function renderScoreBar(label: string, value: number | null) {
    if (value === null) return null;
    const pct = Math.max(0, Math.min(100, value * 10));
    return (
      <div className="score-row">
        <span className="score-label">{label}</span>
        <div className="score-bar-track">
          <div className="score-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="score-value">{value}/10</span>
      </div>
    );
  }

  /* ─── Render ────────────────────────────────────── */
  return (
    <div className="tryon-page">
      <Sidebar />
      <main className="tryon-main">
        <div className="tryon-header">
          <h1>Virtual Try-On</h1>
          <p>Upload your top & bottom garments and see them on a mannequin</p>
        </div>

        {error && (
          <div className="tryon-error">
            <span className="material-symbols-outlined">error</span>
            {error}
            <button onClick={() => setError(null)}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        )}

        <div className="tryon-grid">
          {/* ═══ LEFT: Input Panel ═══ */}
          <div className="tryon-panel">
            <h2>Select Garments</h2>

            {/* Slot selector */}
            <div className="slot-selector">
              <button className={`slot-btn ${activeSlot === "top" ? "active" : ""}`} onClick={() => setActiveSlot("top")}>
                <span className="material-symbols-outlined">styler</span>
                Top {topPreview && <span className="slot-check">✓</span>}
              </button>
              <button className={`slot-btn ${activeSlot === "bottom" ? "active" : ""}`} onClick={() => setActiveSlot("bottom")}>
                <span className="material-symbols-outlined">straighten</span>
                Bottom {bottomPreview && <span className="slot-check">✓</span>}
              </button>
            </div>

            {/* Input mode tabs */}
            <div className="tryon-tabs">
              <button className={`tryon-tab ${inputMode === "upload" ? "active" : ""}`} onClick={() => switchMode("upload")}>
                <span className="material-symbols-outlined">upload_file</span> Upload
              </button>
              <button className={`tryon-tab ${inputMode === "camera" ? "active" : ""}`} onClick={() => switchMode("camera")}>
                <span className="material-symbols-outlined">photo_camera</span> Camera
              </button>
              <button className={`tryon-tab ${inputMode === "url" ? "active" : ""}`} onClick={() => switchMode("url")}>
                <span className="material-symbols-outlined">link</span> URL
              </button>
            </div>

            {/* Processing indicator */}
            {processing && (
              <div className="processing-indicator">
                <div className="tryon-spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
                <span>Removing background...</span>
              </div>
            )}

            {/* Upload dropzone */}
            {inputMode === "upload" && !currentPreview && !processing && (
              <div
                className={`tryon-dropzone ${dragOver ? "dragover" : ""}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                <span className="material-symbols-outlined">cloud_upload</span>
                <p>Drag & drop your <strong>{activeSlot}</strong> garment here</p>
                <p className="hint">or click to browse • JPG, PNG • Max 5 MB</p>
                <p className="hint">Background will be auto-removed ✨</p>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange} style={{ display: "none" }} />
              </div>
            )}

            {/* Camera */}
            {inputMode === "camera" && !currentPreview && !processing && (
              <div className="tryon-camera-area">
                {cameraError && (
                  <div className="camera-permission-msg">
                    <span className="material-symbols-outlined">videocam_off</span>
                    <p>{cameraError}</p>
                  </div>
                )}
                {!cameraActive && !cameraError && (
                  <div className="camera-permission-msg">
                    <span className="material-symbols-outlined">photo_camera</span>
                    <p>Capture your {activeSlot} garment</p>
                    <button className="tryon-generate-btn" style={{ width: "auto", marginTop: "1rem" }} onClick={startCamera}>
                      <span className="material-symbols-outlined">videocam</span> Start Camera
                    </button>
                  </div>
                )}
                {cameraActive && (
                  <>
                    <video ref={videoRef} autoPlay playsInline muted />
                    <div className="camera-controls">
                      <button className="camera-btn capture" onClick={capturePhoto}>
                        <span className="material-symbols-outlined">camera</span>
                      </button>
                      <button className="camera-btn" onClick={stopCamera}>
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* URL */}
            {inputMode === "url" && !currentPreview && !processing && (
              <div className="tryon-url-row">
                <input className="tryon-url-input" type="text" placeholder={`Paste ${activeSlot} garment URL...`} value={garmentUrl} onChange={(e) => setGarmentUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") fetchFromUrl(); }} />
                <button className="tryon-tab active" onClick={fetchFromUrl} disabled={!garmentUrl.trim()}>Fetch</button>
              </div>
            )}

            {/* Current slot preview */}
            {currentPreview && (
              <div className="tryon-preview tryon-preview-transparent">
                <div className="preview-slot-label">{activeSlot === "top" ? "Top Garment" : "Bottom Garment"}</div>
                <img src={currentPreview} alt={`${activeSlot} garment`} />
                <button className="preview-remove" onClick={() => clearSlot(activeSlot)}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            )}

            {/* Both garment thumbnails */}
            {(topPreview || bottomPreview) && (
              <div className="garment-thumbs">
                <div className={`garment-thumb ${activeSlot === "top" ? "active" : ""} ${topPreview ? "filled" : ""}`} onClick={() => setActiveSlot("top")}>
                  {topPreview ? <img src={topPreview} alt="Top" /> : <span className="material-symbols-outlined">add</span>}
                  <span className="thumb-label">Top</span>
                </div>
                <div className={`garment-thumb ${activeSlot === "bottom" ? "active" : ""} ${bottomPreview ? "filled" : ""}`} onClick={() => setActiveSlot("bottom")}>
                  {bottomPreview ? <img src={bottomPreview} alt="Bottom" /> : <span className="material-symbols-outlined">add</span>}
                  <span className="thumb-label">Bottom</span>
                </div>
              </div>
            )}

            <button className="tryon-generate-btn" disabled={!canGenerate} onClick={handleGenerate}>
              <span className="material-symbols-outlined">auto_awesome</span>
              {loading ? "Generating..." : processing ? "Processing image..." : "Try it On"}
            </button>
          </div>

          {/* ═══ RIGHT: Output Panel ═══ */}
          <div className="tryon-panel">
            <h2>Preview</h2>
            <div className="tryon-output">
              <MannequinCanvas
                mannequinLabel={result?.mannequinLabel || "Virtual Mannequin"}
                selectedMannequinLabel={selectedMannequinLabel}
                mannequinImageUrl={mannequinCutoutUrl}
                topPreview={result?.topImageUrl || topPreview}
                bottomPreview={result?.bottomImageUrl || bottomPreview}
                loading={loading}
              />

              {result && !loading && (
                <div className="tryon-result-card">
                  {result.garmentType && (
                    <div className="garment-badge result-badge-inline">
                      <span className="material-symbols-outlined">checkroom</span>
                      {result.garmentType}
                      {result.primaryColor && ` • ${result.primaryColor}`}
                    </div>
                  )}

                  {result.scores.overall !== null && (
                    <div className="result-scores">
                      <h3>Style Scores</h3>
                      {renderScoreBar("Style", result.scores.style)}
                      {renderScoreBar("Versatility", result.scores.versatility)}
                      {renderScoreBar("Trendiness", result.scores.trendiness)}
                      {renderScoreBar("Overall", result.scores.overall)}
                    </div>
                  )}

                  {analysisSections.length > 0 && (
                    <div className="result-analysis">
                      <div className="analysis-section personalized">
                        <h4>Your Style Snapshot</h4>
                        <p>{personalizedSummary}</p>
                      </div>

                      <button
                        type="button"
                        className="analysis-toggle"
                        onClick={() => setShowDetailedAnalysis((prev) => !prev)}
                      >
                        {showDetailedAnalysis ? "Hide AI details" : "Show AI details"}
                      </button>

                      {showDetailedAnalysis && analysisSections.slice(0, 2).map((section, index) => (
                        <div key={`${section.title}-${index}`} className="analysis-section compact">
                          <h4>{section.title}</h4>
                          <p>{section.content}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="result-actions">
                    <button className="result-btn primary" onClick={clearAll}>
                      <span className="material-symbols-outlined">refresh</span>
                      Try Another
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TryOn;
