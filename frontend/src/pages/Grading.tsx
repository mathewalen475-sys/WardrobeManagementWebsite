import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "../components/sidebar";
import "../styles/Grading.css";

type ClassifiedImage = {
  filename: string;
  url: string;
  category: "shirt" | "pants" | "other";
  label: string;
};

type ClassificationResponse = {
  shirts?: ClassifiedImage[];
  pants?: ClassifiedImage[];
  other?: ClassifiedImage[];
};

type WardrobeItem = {
  id: string;
  name: string;
  image: string;
  filename: string;
};

type GradedPair = {
  id: string;
  top: {
    id: string;
    name: string;
    imageUrl: string | null;
    filename: string | null;
  };
  bottom: {
    id: string;
    name: string;
    imageUrl: string | null;
    filename: string | null;
  };
  score: number;
  reason: string;
  rank: number;
};

type GradeSelectionResponse = {
  mode: "one" | "many";
  result?: GradedPair;
  rankings?: GradedPair[];
  error?: string;
};

type RankingCard = {
  id: string;
  title: string;
  subtitle: string;
  scoreText: string;
  previewImage: string;
  reason: string;
};

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80";

function getBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
}

function toAbsoluteImageUrl(url?: string | null) {
  if (!url) {
    return PLACEHOLDER_IMAGE;
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (url.startsWith("/")) {
    return `${getBaseUrl()}${url}`;
  }

  return `${getBaseUrl()}/${url}`;
}

function Grading() {
  const location = useLocation();
  const [mode, setMode] = useState<"one" | "many">("one");
  const [tops, setTops] = useState<WardrobeItem[]>([]);
  const [bottoms, setBottoms] = useState<WardrobeItem[]>([]);
  const [selectedTopIds, setSelectedTopIds] = useState<string[]>([]);
  const [selectedBottomIds, setSelectedBottomIds] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isGrading, setIsGrading] = useState(false);
  const [gradingError, setGradingError] = useState("");

  const [manyResults, setManyResults] = useState<GradedPair[]>([]);
  const [activeRankingId, setActiveRankingId] = useState("");
  const [resultModal, setResultModal] = useState<GradedPair | null>(null);
  const [selectedOutfitId, setSelectedOutfitId] = useState("");

  useEffect(() => {
    setIsLoading(true);
    setError("");

    const state = location.state as { classification?: ClassificationResponse } | null;
    const classification = state?.classification;

    if (!classification) {
      setError("No classified wardrobe data found. Please upload from the uploader page first.");
      setIsLoading(false);
      return;
    }

    const shirts = Array.isArray(classification.shirts) ? classification.shirts : [];
    const pants = Array.isArray(classification.pants) ? classification.pants : [];

    const mappedTops: WardrobeItem[] = shirts.map((item, index) => ({
      id: item.filename || `shirt-${index}`,
      name: item.label || item.filename || "Shirt",
      image: toAbsoluteImageUrl(item.url),
      filename: item.filename,
    }));

    const mappedBottoms: WardrobeItem[] = pants.map((item, index) => ({
      id: item.filename || `pants-${index}`,
      name: item.label || item.filename || "Pants",
      image: toAbsoluteImageUrl(item.url),
      filename: item.filename,
    }));

    setTops(mappedTops);
    setBottoms(mappedBottoms);
    setSelectedTopIds(mappedTops[0] ? [mappedTops[0].id] : []);
    setSelectedBottomIds(mappedBottoms[0] ? [mappedBottoms[0].id] : []);
    setIsLoading(false);
  }, [location.state]);

  useEffect(() => {
    setManyResults([]);
    setActiveRankingId("");
    setResultModal(null);
    setGradingError("");

    if (mode === "one") {
      setSelectedTopIds((prev) => (prev[0] ? [prev[0]] : tops[0] ? [tops[0].id] : []));
      setSelectedBottomIds((prev) => (prev[0] ? [prev[0]] : bottoms[0] ? [bottoms[0].id] : []));
    }
  }, [mode, tops, bottoms]);

  const selectedTopItems = useMemo(
    () => tops.filter((item) => selectedTopIds.includes(item.id)),
    [tops, selectedTopIds],
  );

  const selectedBottomItems = useMemo(
    () => bottoms.filter((item) => selectedBottomIds.includes(item.id)),
    [bottoms, selectedBottomIds],
  );

  const oneValid = selectedTopIds.length === 1 && selectedBottomIds.length === 1;
  const manyValid =
    selectedTopIds.length > 0 &&
    selectedBottomIds.length > 0 &&
    selectedTopIds.length <= 4 &&
    selectedBottomIds.length <= 4;

  const canConfirm = mode === "one" ? oneValid : manyValid;

  const rankings: RankingCard[] = manyResults.map((pair) => ({
    id: pair.id,
    title: `#${pair.rank} Ranked Fit`,
    subtitle: `${pair.top.name} + ${pair.bottom.name}`,
    scoreText: (pair.score / 10).toFixed(1),
    previewImage: pair.top.imageUrl || pair.bottom.imageUrl || PLACEHOLDER_IMAGE,
    reason: pair.reason,
  }));

  const topRanking = rankings[0];

  const toggleSelection = (type: "top" | "bottom", id: string) => {
    if (type === "top") {
      if (mode === "one") {
        setSelectedTopIds([id]);
        return;
      }

      setSelectedTopIds((prev) => {
        if (prev.includes(id)) {
          return prev.filter((entry) => entry !== id);
        }

        if (prev.length >= 4) {
          return prev;
        }

        return [...prev, id];
      });
      return;
    }

    if (mode === "one") {
      setSelectedBottomIds([id]);
      return;
    }

    setSelectedBottomIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((entry) => entry !== id);
      }

      if (prev.length >= 4) {
        return prev;
      }

      return [...prev, id];
    });
  };

  const handleConfirm = async () => {
    if (!canConfirm || isGrading) {
      return;
    }

    setIsGrading(true);
    setGradingError("");

    try {
      const response = await fetch(`${getBaseUrl()}/api/wardrobe/grade-selection`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode,
          tops: selectedTopItems.map((item) => ({
            id: item.id,
            name: item.name,
            imageUrl: item.image,
            filename: item.filename,
          })),
          pants: selectedBottomItems.map((item) => ({
            id: item.id,
            name: item.name,
            imageUrl: item.image,
            filename: item.filename,
          })),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as GradeSelectionResponse;
      if (!response.ok) {
        throw new Error(payload.error || "Failed to grade selected outfits.");
      }

      if (mode === "one") {
        if (!payload.result) {
          throw new Error("No grade was returned for one mode.");
        }

        setManyResults([]);
        setResultModal(payload.result);
        setSelectedOutfitId("");
        return;
      }

      const ranked = Array.isArray(payload.rankings) ? payload.rankings : [];
      setManyResults(ranked);
      setActiveRankingId(ranked[0]?.id || "");
      setResultModal(ranked[0] || null);
      setSelectedOutfitId("");
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Failed to grade selected outfits.";
      setGradingError(message);
    } finally {
      setIsGrading(false);
    }
  };

  const openRankingPopup = (rankingId: string) => {
    setActiveRankingId(rankingId);
    const pair = manyResults.find((item) => item.id === rankingId);
    if (pair) {
      setResultModal(pair);
    }
  };

  return (
    <div className="grading-page">
      <Sidebar />

      <main className="grading-layout">
        <section className="grading-left-panel">
          <header className="grading-header">
            <div>
              <h1>Your Wardrobe</h1>
              <p>Select items and run grading</p>
            </div>
          </header>

          <div className="grading-mode-switch" role="tablist" aria-label="Result mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "one"}
              className={mode === "one" ? "is-active" : ""}
              onClick={() => setMode("one")}
            >
              ONE
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "many"}
              className={mode === "many" ? "is-active" : ""}
              onClick={() => setMode("many")}
            >
              MANY
            </button>
          </div>

          <p className="grading-selection-info">
            {mode === "one"
              ? "Select exactly one top and one bottom, then confirm."
              : "Select up to 4 tops and up to 4 bottoms, then confirm for ranking."}
          </p>

          <div className="grading-sections-wrap">
            {isLoading ? <p>Loading your uploaded wardrobe...</p> : null}
            {error ? <p>{error}</p> : null}
            {gradingError ? <p>{gradingError}</p> : null}

            {!isLoading && !error && tops.length === 0 && bottoms.length === 0 ? (
              <p>No shirts/pants available from classification. Upload and classify again.</p>
            ) : null}

            {tops.length > 0 ? (
              <section className="grading-section">
                <h3 className="grading-section-title">
                  <span>Tops</span>
                  <span className="grading-section-line" />
                </h3>

                <div className="grading-items-grid">
                  {tops.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`grading-item-card ${selectedTopIds.includes(item.id) ? "is-selected" : ""}`}
                      onClick={() => toggleSelection("top", item.id)}
                    >
                      <img src={item.image} alt={item.name} />
                      <div className="grading-item-overlay">
                        <p>{item.name}</p>
                      </div>
                      {selectedTopIds.includes(item.id) ? (
                        <div className="grading-check-badge" aria-hidden="true">
                          <span className="material-symbols-outlined">check</span>
                        </div>
                      ) : null}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {bottoms.length > 0 ? (
              <section className="grading-section">
                <h3 className="grading-section-title">
                  <span>Bottoms</span>
                  <span className="grading-section-line" />
                </h3>

                <div className="grading-items-grid">
                  {bottoms.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`grading-item-card ${selectedBottomIds.includes(item.id) ? "is-selected" : ""}`}
                      onClick={() => toggleSelection("bottom", item.id)}
                    >
                      <img src={item.image} alt={item.name} />
                      <div className="grading-item-overlay">
                        <p>{item.name}</p>
                      </div>
                      {selectedBottomIds.includes(item.id) ? (
                        <div className="grading-check-badge" aria-hidden="true">
                          <span className="material-symbols-outlined">check</span>
                        </div>
                      ) : null}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="grading-confirm-row">
              <p>
                Selected: {selectedTopIds.length} top(s), {selectedBottomIds.length} bottom(s)
              </p>
              <button
                type="button"
                className="grading-confirm-btn"
                disabled={!canConfirm || isGrading || isLoading || Boolean(error)}
                onClick={handleConfirm}
              >
                {isGrading ? "Grading..." : "Confirm & Start Grading"}
              </button>
            </div>
          </div>
        </section>

        <aside className="grading-right-panel">
          {mode === "one" ? (
            <article className="style-card">
              <h2>One Mode</h2>
              <p>Run grading to see the selected top + bottom score popup.</p>
            </article>
          ) : null}

          <section className="ranking-section">
            <h3>Rankings</h3>
            <div className="ranking-list">
              {rankings.map((item) => {
                const isSelected = item.id === activeRankingId;

                return (
                  <article
                    key={item.id}
                    className={`ranking-item ${isSelected ? "is-selected" : ""}`}
                    onClick={() => openRankingPopup(item.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openRankingPopup(item.id);
                      }
                    }}
                  >
                    <div className="ranking-item-image">
                      <img src={item.previewImage} alt={item.title} />
                    </div>

                    <div className="ranking-item-content">
                      <div className="ranking-item-header">
                        <span>{item.title}</span>
                        <span>{item.scoreText} SCORE</span>
                      </div>
                      <p>{item.subtitle}</p>
                    </div>

                    <button type="button" aria-label={`View ${item.title}`}>
                      <span className="material-symbols-outlined">visibility</span>
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          {mode === "many" && topRanking ? (
            <article className="grade-card">
              <div className="grade-card-header">
                <h4>{topRanking.title}</h4>
                <span>{topRanking.scoreText} / 10</span>
              </div>
              <p>{topRanking.subtitle}</p>
              <p>{topRanking.reason}</p>
            </article>
          ) : null}

          <button type="button" className="grading-finalize-btn">
            Finalize Outfit
          </button>
        </aside>
      </main>

      {resultModal ? (
        <div className="grading-modal-overlay" role="dialog" aria-modal="true">
          <div className="grading-modal">
            <button type="button" className="grading-modal-close" onClick={() => setResultModal(null)}>
              <span className="material-symbols-outlined">close</span>
            </button>

            <h3>Grade Result</h3>
            <div className="grading-modal-images">
              <img src={resultModal.top.imageUrl || PLACEHOLDER_IMAGE} alt={resultModal.top.name} />
              <img src={resultModal.bottom.imageUrl || PLACEHOLDER_IMAGE} alt={resultModal.bottom.name} />
            </div>
            <p className="grading-modal-grade">Score: {(resultModal.score / 10).toFixed(1)} / 10</p>
            <p className="grading-modal-reason">{resultModal.reason}</p>
            <button
              type="button"
              className="grading-modal-select"
              onClick={() => {
                setSelectedOutfitId(resultModal.id);
                setResultModal(null);
              }}
            >
              Select This Outfit
            </button>
          </div>
        </div>
      ) : null}

      {selectedOutfitId ? <div className="grading-selected-tag">Selected outfit: {selectedOutfitId}</div> : null}
    </div>
  );
}

export default Grading;
