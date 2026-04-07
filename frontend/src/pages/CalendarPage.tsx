import { useEffect, useMemo, useState } from "react";
import "../styles/Calender.css";
import Uploader from "./Uploader";
import Sidebar from "../components/sidebar";

type CalendarDay = {
  date: Date;
  currentMonth: boolean;
  eventDotColor?: string;
};

type ScheduledOutfit = {
  id: string;
  scheduled_date: string;
  shirt_image_url: string | null;
  shirt_name: string | null;
  shirt_color: string | null;
  shirt_color_hex: string | null;
  pants_image_url: string | null;
  pants_name: string | null;
  score: number | null;
  reason: string | null;
};

type EventDetails = {
  headline: string;
  subheadline: string;
  topImage: string;
  bottomImage: string;
  outfit: Array<{ label: string; value: string }>;
};

const now = new Date();
const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80";

function getBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
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

function buildMonthGrid(date: Date, scheduleMap: Map<string, ScheduledOutfit>): CalendarDay[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const days: CalendarDay[] = [];

  const previousMonthLastDay = new Date(year, month, 0).getDate();
  for (let index = startDay - 1; index >= 0; index -= 1) {
    const fillerDate = new Date(year, month - 1, previousMonthLastDay - index);
    const key = formatDateKey(fillerDate);
    const scheduled = scheduleMap.get(key);

    days.push({
      date: fillerDate,
      currentMonth: false,
      eventDotColor: scheduled?.shirt_color_hex || undefined,
    });
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const currentMonthDate = new Date(year, month, day);
    const key = formatDateKey(currentMonthDate);
    const scheduled = scheduleMap.get(key);

    days.push({
      date: currentMonthDate,
      currentMonth: true,
      eventDotColor: scheduled?.shirt_color_hex || undefined,
    });
  }

  while (days.length < 42) {
    const nextMonthDate = new Date(year, month + 1, days.length - totalDays + 1);
    const key = formatDateKey(nextMonthDate);
    const scheduled = scheduleMap.get(key);

    days.push({
      date: nextMonthDate,
      currentMonth: false,
      eventDotColor: scheduled?.shirt_color_hex || undefined,
    });
  }

  return days;
}

function ordinalSuffix(day: number) {
  const remainder = day % 10;
  const teen = day % 100;

  if (teen >= 11 && teen <= 13) {
    return "th";
  }

  if (remainder === 1) return "st";
  if (remainder === 2) return "nd";
  if (remainder === 3) return "rd";
  return "th";
}

function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(() => currentMonthStart);
  const [selectedDate, setSelectedDate] = useState(() => now);
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);
  const [scheduledOutfits, setScheduledOutfits] = useState<ScheduledOutfit[]>([]);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const response = await fetch(`${getBaseUrl()}/api/user/schedule`, {
          credentials: "include",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json().catch(() => [])) as ScheduledOutfit[];
        setScheduledOutfits(Array.isArray(payload) ? payload : []);
      } catch {
        setScheduledOutfits([]);
      }
    };

    fetchSchedule();
  }, []);

  const scheduleByDate = useMemo(() => {
    const map = new Map<string, ScheduledOutfit>();
    for (const item of scheduledOutfits) {
      if (typeof item.scheduled_date === "string" && item.scheduled_date.length > 0) {
        map.set(item.scheduled_date, item);
      }
    }
    return map;
  }, [scheduledOutfits]);

  const monthGrid = useMemo(() => buildMonthGrid(currentDate, scheduleByDate), [currentDate, scheduleByDate]);
  const currentMonthLabel = currentDate.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const selectedKey = formatDateKey(selectedDate);
  const scheduledForSelected = scheduleByDate.get(selectedKey);

  const selectedDetails: EventDetails = scheduledForSelected
    ? {
        headline: selectedDate.toLocaleDateString("default", { weekday: "long" }),
        subheadline: scheduledForSelected.reason || "Scheduled outfit",
        topImage: toAbsoluteImageUrl(scheduledForSelected.shirt_image_url),
        bottomImage: toAbsoluteImageUrl(scheduledForSelected.pants_image_url),
        outfit: [
          { label: "Top", value: scheduledForSelected.shirt_name || "Selected top" },
          { label: "Bottom", value: scheduledForSelected.pants_name || "Selected bottom" },
          {
            label: "Score",
            value: typeof scheduledForSelected.score === "number" ? `${(scheduledForSelected.score / 10).toFixed(1)} / 10` : "-",
          },
        ],
      }
    : {
        headline: selectedDate.toLocaleDateString("default", { weekday: "long" }),
        subheadline: "No outfit scheduled",
        topImage: PLACEHOLDER_IMAGE,
        bottomImage: PLACEHOLDER_IMAGE,
        outfit: [
          { label: "Top", value: "No outfit yet" },
          { label: "Bottom", value: "No outfit yet" },
          { label: "Score", value: "-" },
        ],
      };

  const isToday = (date: Date) => formatDateKey(date) === formatDateKey(new Date());
  const isSelected = (date: Date) => formatDateKey(date) === selectedKey;

  const changeMonth = (offset: number) => {
    setCurrentDate((previousDate) =>
      new Date(previousDate.getFullYear(), previousDate.getMonth() + offset, 1),
    );
  };

  const resetToToday = () => {
    const today = new Date();
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  };

  return (
    <div className="atelier-shell">
      <Sidebar />

      <main className="atelier-main">
        <header className="atelier-header">
          <div>
            <span className="eyebrow">{currentMonthLabel}</span>
            <h2>Your Style Timeline</h2>
          </div>

          <div className="header-controls">
            <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month">
              <span className="material-symbols-outlined" aria-hidden="true">
                chevron_left
              </span>
            </button>
            <button type="button" className="today-pill" onClick={resetToToday}>
              {currentMonthLabel.split(" ")[0]}
            </button>
            <button type="button" onClick={() => changeMonth(1)} aria-label="Next month">
              <span className="material-symbols-outlined" aria-hidden="true">
                chevron_right
              </span>
            </button>
          </div>
        </header>

        <div className="content-grid">
          <section className="detail-panel" aria-label="Selected day details">
            <div className="detail-card">
              <div className="detail-heading-row">
                <div>
                  <h3>
                    {selectedDetails.headline}
                    <br />
                    {selectedDate.getDate()}
                    {ordinalSuffix(selectedDate.getDate())}
                  </h3>
                  <p>{selectedDetails.subheadline}</p>
                </div>

                <button type="button" className="icon-button" aria-label="Edit selected day">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    edit
                  </span>
                </button>
              </div>

              <div className="outfit-preview-grid">
                <div className="outfit-preview">
                  <img alt="Scheduled top" src={selectedDetails.topImage} />
                </div>
                <div className="outfit-preview">
                  <img alt="Scheduled bottom" src={selectedDetails.bottomImage} />
                </div>
              </div>

              <div className="scheduled-meta-list">
                {selectedDetails.outfit.map((entry) => (
                  <div key={entry.label} className="scheduled-meta-row">
                    <span>{entry.label}</span>
                    <strong>{entry.value}</strong>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="confirm-button"
              >
                Change Drip
              </button>
            </div>
          </section>

          <section className="calendar-panel" aria-label="Calendar">
            <div className="weekday-row">
              {weekdayLabels.map((label) => (
                <div key={label}>{label}</div>
              ))}
            </div>

            <div className="calendar-grid">
              {monthGrid.map((day) => {
                const key = formatDateKey(day.date);
                const selected = isSelected(day.date);
                const today = isToday(day.date);

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedDate(day.date);
                      if (day.currentMonth) {
                        setCurrentDate(new Date(day.date.getFullYear(), day.date.getMonth(), 1));
                      }
                    }}
                    className={`calendar-cell ${day.currentMonth ? "" : "is-muted"} ${
                      selected ? "is-selected" : ""
                    } ${today ? "is-today" : ""}`}
                  >
                    <span className="calendar-day-number">{day.date.getDate()}</span>

                    {day.eventDotColor ? (
                      <span className="event-dot" aria-hidden="true" style={{ background: day.eventDotColor }} />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <button type="button" className="fab-button" aria-label="Create new item">
          <span className="material-symbols-outlined" aria-hidden="true">
            auto_fix_high
          </span>
        </button>
      </main>

      <Uploader
        isOpen={isUploaderOpen}
        onClose={() => setIsUploaderOpen(false)}
      />
    </div>
  );
}

export default CalendarPage;
