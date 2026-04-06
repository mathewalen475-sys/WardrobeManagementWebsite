import { useMemo, useState } from "react";
import "../styles/Calender.css";
import Scheduler from "./Scheduler";

type CalendarDay = {
  date: Date;
  currentMonth: boolean;
  eventDot?: boolean;
  previewImage?: string;
};

type EventDetails = {
  headline: string;
  subheadline: string;
  image: string;
  outfit: Array<{ label: string; value: string }>;
};

type SpotlightCard = {
  label: string;
  icon: string;
  title: string;
  subtitle: string;
  image: string;
};

const now = new Date();
const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const sidebarLinks = [
  { label: "Home", icon: "home", active: false },
  { label: "Calendar", icon: "calendar_month", active: true },
  { label: "Mannequin", icon: "accessibility_new", active: false },
  { label: "Settings", icon: "settings", active: false },
  { label: "Support", icon: "help", active: false },
];

const specialDayIds = new Set([
  "2024-11-03",
  "2024-11-06",
  "2024-11-09",
  "2024-11-14",
  "2024-11-19",
  "2024-11-26",
]);

const selectedEvents: Record<string, EventDetails> = {
  "2024-11-14": {
    headline: "Thursday",
    subheadline: "Autumn Gala Dinner",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDwxQOyrxSMiQ6xJ9aEZ1absUFV2lm9qtUNxMcetGvqWOdh635Q-s8j5HZF43fIy0QjQUH1lpyM-LhTsOCO27HY_dgQzixFbH8yD7cSOuOPFt6mEBnEcON4c940dLu2xbGt2f4xTMt6MUjdHNg4U6so7ICHHYZOikQOfvsSQRuxRhMEzmEoDDuPFkS1Ck9eUsirnywCfaaf2rLKqAPcnvtAYIDbtXo1oDjDVQoN-r9G77lGKgz48MoDnGcfswm3S3JAL1InmfRJG3Q2",
    outfit: [
      { label: "Tops", value: "Silk Camisole" },
      { label: "Outerwear", value: "Wool Trench" },
      { label: "Accessories", value: "Gold Hoops" },
    ],
  },
};

const spotlightCards: SpotlightCard[] = [
  {
    label: "MORNING",
    icon: "light_mode",
    title: "Structured Navy Blazer",
    subtitle: "Business Meeting @ 09:00",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDb68WJu8jHuQlisnXGYLkuEUFKwjy82ULB2CLv5rZoKrETws6VyVQmmBk9HQ3VLPp3kM9wxefAnPpeCfSmJUuVWi5oXw8jhaRqEdnXEUNC2kJB2B2PTvxVsMKistl-zbTuYKr8Ioh2rg6GFkA_YlDK8dOFX6vZeCWDx8jxQiDGCowJdONhfijdFNO5lOPQiAJqzbhhqYP-sZJDwVZzOSYsBW9rZ8_Ll2Z6PHjXsBfpoG7lTkR9E-ASlstNymvJQtKRCVuGT79zLLCi",
  },
  {
    label: "EVENING",
    icon: "dark_mode",
    title: "Stiletto Heels",
    subtitle: "Dinner with Friends @ 20:30",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAwdJf-N1Z5ZIugBuClt3YvXk2PGKpfVGy9ZxK_g3cWhSOYPFwpSrgVNWIB9cW-ORgv198FvjymtMcA3Ilp3tALrvqn02xvBzsCFEwGNYCWMUJHwMYOXjAu-T9yn3_PwiCTXqfQNL2eSBe7dqPwu8puhgxexCqWKaq5DUUlTJ10NzOy87hvH1V-67X97wnE4DKPhjtW5E8drMYO98NY7gHiyjnnA-Hdk3Zrkwa42mAna1mdQos_L6Z0Z_mjxUJdT01HlD06-5MdPvWU",
  },
];

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function buildMonthGrid(date: Date): CalendarDay[] {
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
    days.push({
      date: fillerDate,
      currentMonth: false,
      eventDot: specialDayIds.has(formatDateKey(fillerDate)),
    });
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const currentMonthDate = new Date(year, month, day);
    const key = formatDateKey(currentMonthDate);
    days.push({
      date: currentMonthDate,
      currentMonth: true,
      eventDot: specialDayIds.has(key),
      previewImage:
        key === "2024-11-06"
          ? "https://lh3.googleusercontent.com/aida-public/AB6AXuBAW9O7FEHdcFJoPYQ27d-7t9SBzTphsS8mO7uuxnrsV1f0_2Ekjkqevcx6dJXbBm-6YsFs7rqQ8g-CP4dRrFTovROnPtjnjF4JRsMI9PO_wDkyEnnfpuhllDhrmN54vqblBZgaIRAznHb_2QFOFeZq0mOMZfbGIIbIoB_I-AQLH6Djd6lgoDkOQYS-Fp1OHYcwrT_0i4nXISaRjmLTCNoa1Q0Y3MwPnWXkPDwVXHfSP2hRPMcTzK6vFCgtP5LHMObHNMmTeCQ5r3BQ"
          : undefined,
    });
  }

  while (days.length < 42) {
    const nextMonthDate = new Date(year, month + 1, days.length - totalDays + 1);
    days.push({
      date: nextMonthDate,
      currentMonth: false,
      eventDot: specialDayIds.has(formatDateKey(nextMonthDate)),
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
  const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);

  const monthGrid = useMemo(() => buildMonthGrid(currentDate), [currentDate]);
  const currentMonthLabel = currentDate.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const selectedKey = formatDateKey(selectedDate);
  const selectedDetails = selectedEvents[selectedKey] ?? {
    headline: selectedDate.toLocaleDateString("default", { weekday: "long" }),
    subheadline: "No outfit scheduled",
    image:
      "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80",
    outfit: [
      { label: "Tops", value: "Add a scheduled outfit" },
      { label: "Outerwear", value: "Select a layer" },
      { label: "Accessories", value: "Choose accessories" },
    ],
  };

  const isToday = (date: Date) => formatDateKey(date) === formatDateKey(new Date());
  const isSelected = (date: Date) => formatDateKey(date) === selectedKey;

  const changeMonth = (offset: number) => {
    setCurrentDate((previousDate) =>
      new Date(previousDate.getFullYear(), previousDate.getMonth() + offset, 1)
    );
  };

  const resetToToday = () => {
    const today = new Date();
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  };

  return (
    <div className="atelier-shell">
      <aside className="atelier-sidebar">
        <div>
          <div className="brand-block">
            <h1>The Atelier</h1>
            <p>Curating your style</p>
          </div>

          <nav className="sidebar-nav" aria-label="Primary">
            {sidebarLinks.map((link) => (
              <a
                key={link.label}
                className={`sidebar-link ${link.active ? "is-active" : ""}`}
                href="#"
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  {link.icon}
                </span>
                <span>{link.label}</span>
              </a>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <button className="upload-button" type="button">
            <span className="material-symbols-outlined" aria-hidden="true">
              add
            </span>
            Upload New
          </button>

          <div className="sidebar-link muted-link" role="link" tabIndex={0}>
            <span className="material-symbols-outlined" aria-hidden="true">
              settings
            </span>
            <span>Settings</span>
          </div>

          <div className="sidebar-link muted-link" role="link" tabIndex={0}>
            <span className="material-symbols-outlined" aria-hidden="true">
              help
            </span>
            <span>Support</span>
          </div>

          <div className="profile-card">
            <img
              alt="User profile"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuD8wzv-XgB2CFPLmg-ViRoltUNoFqYLHepMnU1YuTUugUANOFQYhvmKtyM9SHKtneIXrtwVbILHvAsYDc65z6Qv9jDwMJyTTF_jGB7sjLn7rP8yRtZxE4CcBXPszk9-NpgHIezoXHigbC8qgDm5uXe90NcQgBzNl32lGLcfMTtwxmIqbS-SI2ac6aj187uzYbwkIifMQQ0Cp_2yBlmfhnc0U_Xa3KlcWreClzNLA1zw32skq7ozocR4jtDkXcZGTO8FaUy2gCtA5_BA"
            />
            <div>
              <strong>Elena Rossi</strong>
              <span>Premium Member</span>
            </div>
          </div>
        </div>
      </aside>

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

              <div className="outfit-preview">
                <img alt="Scheduled outfit" src={selectedDetails.image} />
                <div className="outfit-overlay">
                  <p>View Breakdown</p>
                </div>
              </div>

              <button
                type="button"
                className="confirm-button"
                onClick={() => setIsSchedulerOpen(true)}
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

                    {day.eventDot ? <span className="event-dot" aria-hidden="true" /> : null}

                    {day.previewImage ? (
                      <div className="hover-preview">
                        <img alt="Outfit preview" src={day.previewImage} />
                      </div>
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

      <Scheduler
        isOpen={isSchedulerOpen}
        initialDate={selectedDate}
        onClose={() => setIsSchedulerOpen(false)}
        onSchedule={(scheduledDate) => setSelectedDate(scheduledDate)}
      />
    </div>
  );
}

export default CalendarPage;