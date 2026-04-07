import React, { useEffect, useState } from "react";
import Sidebar from "../components/sidebar";
import artboardImg from "../assets/logo.webp";
import wardrobeImg from "../assets/wardrobe.webp";
import heroImg from "../assets/hero.webp";
import { useNavigate } from "react-router-dom";
import "../styles/Homepage.css";

type ShowpieceImage = {
  src: string;
  title: string;
  caption: string;
};

type WeekDay = {
  label: string;
  dayNumber: number;
  isoDate: string;
  isToday: boolean;
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

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80";

function toIsoDateLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toAbsoluteImageUrl(baseUrl: string, url?: string | null) {
  if (!url) {
    return PLACEHOLDER_IMAGE;
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (url.startsWith("/")) {
    return `${baseUrl}${url}`;
  }

  return `${baseUrl}/${url}`;
}

function getStartOfWeek(date: Date) {
  const start = new Date(date);
  const weekday = start.getDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  start.setDate(start.getDate() - daysFromMonday);
  start.setHours(0, 0, 0, 0);
  return start;
}

function buildWeekDays(referenceDate: Date) {
  const weekStart = getStartOfWeek(referenceDate);
  const todayIso = toIsoDateLocal(referenceDate);

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(weekStart);
    current.setDate(weekStart.getDate() + index);

    return {
      label: current.toLocaleDateString("en-US", { weekday: "short" }).charAt(0),
      dayNumber: current.getDate(),
      isoDate: toIsoDateLocal(current),
      isToday: toIsoDateLocal(current) === todayIso,
    };
  });
}

const fallbackShowpieceImages: ShowpieceImage[] = [
  {
    src: wardrobeImg,
    title: "Wardrobe Harmony",
    caption: "Balanced layers and polished neutrals",
  },
  {
    src: heroImg,
    title: "Modern Contrast",
    caption: "Dynamic styling with clean visual punch",
  },
  {
    src: wardrobeImg,
    title: "Mannequin Ready",
    caption: "Previewed and tuned for try-on",
  },
  {
    src: heroImg,
    title: "Fashion Pulse",
    caption: "Energy, motion, and wardrobe confidence",
  },
];

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("User");
  const [date, setDate] = useState("");
  const [weather, setWeather] = useState<any>(null);
  const [suggestion, setSuggestion] = useState("");
  const [month, setMonth] = useState("");
  const [weekDays, setWeekDays] = useState<WeekDay[]>([]);
  const [scheduledDresses, setScheduledDresses] = useState<ScheduledOutfit[]>([]);
  const [selectedWeekDate, setSelectedWeekDate] = useState("");
  const [showpieceImages, setShowpieceImages] = useState<ShowpieceImage[]>(fallbackShowpieceImages);
  const [activeShowpieceImage, setActiveShowpieceImage] = useState(fallbackShowpieceImages[0].src);
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

  useEffect(() => {
    const updateWeeklyCalendar = () => {
      const now = new Date();
      setDate(now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" }));

      const week = buildWeekDays(now);
      setWeekDays(week);

      const weekStartDate = new Date(`${week[0].isoDate}T00:00:00`);
      const weekEndDate = new Date(`${week[6].isoDate}T00:00:00`);
      const startMonth = weekStartDate.toLocaleDateString("en-US", { month: "long" }).toUpperCase();
      const endMonth = weekEndDate.toLocaleDateString("en-US", { month: "long" }).toUpperCase();
      if (startMonth === endMonth) {
        setMonth(startMonth);
      } else {
        setMonth(`${startMonth} / ${endMonth}`);
      }
    };

    updateWeeklyCalendar();

    let weeklyIntervalId: number | undefined;
    const now = new Date();
    setSelectedWeekDate(toIsoDateLocal(now));
    const nextWeekStart = getStartOfWeek(now);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    const msUntilNextWeek = Math.max(nextWeekStart.getTime() - now.getTime(), 0);

    const weeklyTimeoutId = window.setTimeout(() => {
      updateWeeklyCalendar();
      weeklyIntervalId = window.setInterval(updateWeeklyCalendar, 7 * 24 * 60 * 60 * 1000);
    }, msUntilNextWeek);

    const fetchData = async () => {
      try {
        const userRes = await fetch(`${baseUrl}/api/user/profile`, { credentials: "include" });
        if (userRes.ok) {
          const data = await userRes.json();
          setUserName(data?.name ?? "User");
        }

        const scheduleRes = await fetch(`${baseUrl}/api/user/schedule`, { credentials: "include" });
        if (scheduleRes.ok) {
          const sData = (await scheduleRes.json().catch(() => [])) as ScheduledOutfit[];
          setScheduledDresses(Array.isArray(sData) ? sData : []);
        }

        const clothesRes = await fetch(`${baseUrl}/api/my-clothes`, {
          credentials: "include",
        });

        if (clothesRes.ok) {
          const clothesData = await clothesRes.json();
          const backendImages: string[] = Array.isArray(clothesData?.sessions)
            ? clothesData.sessions
                .flatMap((session: any) => session?.pairs ?? [])
                .flatMap((pair: any) => [pair?.shirt?.imageUrl, pair?.pants?.imageUrl])
                .filter((value: unknown): value is string => typeof value === "string" && value.length > 0)
            : [];

          const uniqueImages = Array.from(new Set(backendImages));
          if (uniqueImages.length > 0) {
            const backendShowpieces = uniqueImages.slice(0, 6).map((src: string, index: number) => ({
              src,
              title: index % 2 === 0 ? "Mannequin Preview" : "Fashion Combo",
              caption: index % 2 === 0 ? "Backend wardrobe image" : "Live style inspiration",
            }));

            setShowpieceImages(backendShowpieces);
            setActiveShowpieceImage(backendShowpieces[0].src);
          }
        }
      } catch (err) {
        console.error("Fetch error:", err);
        setShowpieceImages(fallbackShowpieceImages);
        setActiveShowpieceImage(fallbackShowpieceImages[0].src);
      }
    };

    fetchData();

    const fetchWeather = async () => {
      try {
        const weatherApiKey = import.meta.env.VITE_WEATHER_API_KEY;
        const weatherCity = import.meta.env.VITE_WEATHER_CITY ?? "Kottayam";

        if (!weatherApiKey) {
          console.error("Weather API key not configured in environment variables");
          setSuggestion("Weather data unavailable. Layer your outfits for comfort and style!");
          return;
        }

        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${weatherCity}&units=metric&appid=${weatherApiKey}`
        );

        if (!response.ok) {
          console.error("Weather API error:", response.statusText);
          setSuggestion("Weather data unavailable. Layer your outfits for comfort and style!");
          return;
        }

        const data = await response.json();

        if (!data || !data.main || !data.weather || !Array.isArray(data.weather)) {
          console.error("Invalid weather data structure");
          setSuggestion("Weather data unavailable. Layer your outfits for comfort and style!");
          return;
        }

        setWeather(data);
        const temp = data.main.temp;
        const humidity = data.main.humidity || 0;
        const condition = data.weather[0]?.main;
        const description = data.weather[0]?.description || "";

        // Temperature-based suggestions
        if (temp >= 29) {
          setSuggestion("It's quite warm today! We recommend opting for breathable cotton fabrics and light colors to stay cool and catch the breeze.");
        }
        // Sunny/Clear weather
        else if (condition === "Clear" || condition === "Sunny") {
          setSuggestion("Beautiful sunny weather! Wear breathable fabrics and don't forget sunscreen-friendly light colors. Sunglasses are a great accessory today!");
        }
        // Rainy conditions
        else if (condition === "Rain" || condition === "Drizzle" || description.includes("rain")) {
          setSuggestion("It looks like rain is on the way. You might want to choose quick-dry fabrics and avoid heavy layers to stay comfortable throughout the day.");
        }
        // Damp/Humid conditions
        else if (humidity >= 75) {
          setSuggestion("It's quite humid and damp today. Choose lightweight, breathable fabrics like linen and cotton to stay comfortable. Avoid heavy or synthetic materials that trap moisture.");
        }
        // Cloudy conditions
        else if (condition === "Clouds" || condition === "Overcast") {
          setSuggestion("It's a bit cloudy today. A light jacket or layered outfit would be perfect for this weather. Consider fabrics that provide gentle warmth without overheating.");
        }
        // Foggy/Misty conditions
        else if (condition === "Mist" || condition === "Fog" || description.includes("mist") || description.includes("fog")) {
          setSuggestion("It's foggy and misty outside. Layer up with a light jacket and wear darker colors for better visibility. Consider semi-fitted outfits for comfort.");
        }
        // Thunderstorm conditions
        else if (condition === "Thunderstorm" || description.includes("thunderstorm")) {
          setSuggestion("Thunderstorm warning! Wear quick-dry fabrics and neutral colors. Consider staying indoors or wearing a waterproof jacket if you must go out.");
        }
        // Snow conditions
        else if (condition === "Snow" || description.includes("snow")) {
          setSuggestion("It's snowy today! Bundle up with thermal layers, a warm coat, and don't forget accessories like scarves, gloves, and a warm hat for protection.");
        }
        // Windy conditions
        else if (condition === "Wind" || description.includes("wind") || description.includes("windy")) {
          setSuggestion("It's quite windy today. Wear fitted clothes that won't be blown around, and consider a light windproof jacket. Secure any loose accessories!");
        }
        // Cold weather
        else if (temp < 10) {
          setSuggestion("It's very chilly! Wear thermal underwear, multiple layers, and warm outerwear. Don't forget a warm hat and gloves!");
        }
        else if (temp < 15) {
          setSuggestion("It's quite cool today. Consider wearing warm layers and insulated fabrics to stay cozy and comfortable.");
        }
        // Moderate/Neutral conditions
        else {
          setSuggestion("The weather is pleasant and mild. A simple layered outfit would be perfect—try a comfortable casual look with a light cardigan or jacket!");
        }
      } catch (err) {
        console.error("Weather fetch failed:", err);
        setSuggestion("Weather data unavailable. Layer your outfits for comfort and style!");
      }
    };

    fetchWeather();

    return () => {
      window.clearTimeout(weeklyTimeoutId);
      if (weeklyIntervalId !== undefined) {
        window.clearInterval(weeklyIntervalId);
      }
    };
  }, []);

  useEffect(() => {
    if (showpieceImages.length === 0) {
      return undefined;
    }

    let index = 0;
    const interval = window.setInterval(() => {
      index = (index + 1) % showpieceImages.length;
      setActiveShowpieceImage(showpieceImages[index].src);
    }, 2800);

    return () => window.clearInterval(interval);
  }, [showpieceImages]);

  const getWeatherIcon = (condition: string) => {
    switch (condition) {
      case "Clear":
      case "Sunny":
        return <span className="material-symbols-outlined weather-animate-sun">wb_sunny</span>;
      case "Clouds":
      case "Overcast":
        return <span className="material-symbols-outlined weather-animate-cloud">cloud</span>;
      case "Rain":
      case "Drizzle":
        return <span className="material-symbols-outlined weather-animate-rain">rainy</span>;
      case "Thunderstorm":
        return <span className="material-symbols-outlined weather-animate-storm">thunderstorm</span>;
      case "Snow":
        return <span className="material-symbols-outlined">ac_unit</span>;
      case "Mist":
      case "Fog":
        return <span className="material-symbols-outlined">foggy</span>;
      case "Wind":
        return <span className="material-symbols-outlined">air</span>;
      default:
        return <span className="material-symbols-outlined">partly_cloudy_day</span>;
    }
  };

  const activeShowpiece = showpieceImages.find((item) => item.src === activeShowpieceImage) ?? fallbackShowpieceImages[0];
  
  const scheduleByDate = new Map<string, ScheduledOutfit>();
  for (const outfit of scheduledDresses) {
    if (typeof outfit.scheduled_date === "string" && outfit.scheduled_date.length > 0) {
      scheduleByDate.set(outfit.scheduled_date, outfit);
    }
  }

  const selectedOutfit = scheduleByDate.get(selectedWeekDate);

  return (
    <div className="homepage-container">
      <Sidebar />
      <main className="main-content">
        <div className="header-top-right">
          <img src={artboardImg} alt="Website Group" className="header-artboard" />
        </div>
        <header className="header">
          <p className="welcome-text">Welcome {userName},</p>
          <h2 className="date-text">{date}</h2>
        </header>

        <div className="dashboard-grid">
          <section className="calendar-container-wrapper">
            <div className="calendar-widget">
              <div className="calendar-header">
                <h4 className="calendar-title">This Week</h4>
                <span className="calendar-month">{month}</span>
              </div>
              <div className="calendar-days-grid">
                {weekDays.map((day) => {
                  const outfit = scheduleByDate.get(day.isoDate);
                  return (
                    <div
                      key={day.isoDate}
                      className="calendar-col"
                      onClick={() => setSelectedWeekDate(day.isoDate)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setSelectedWeekDate(day.isoDate);
                        }
                      }}
                    >
                      <span className="day-label">{day.label}</span>
                      <div className={`day-number ${day.isToday ? "active" : ""}`}>{day.dayNumber}</div>
                      {outfit && (
                        <div
                          className="schedule-dot"
                          style={{ backgroundColor: outfit.shirt_color_hex || "#432412" }}
                          title={outfit.shirt_name || "Scheduled outfit"}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Weekly Outfit Preview */}
            {selectedOutfit && (
              <div className="outfit-detail-card">
                <div className="outfit-detail-header">
                  <h4>Scheduled Outfit</h4>
                  <p className="outfit-date">
                    {new Date(`${selectedWeekDate}T00:00:00`).toLocaleDateString("default", { weekday: "long", month: "short", day: "numeric" })}
                  </p>
                </div>
                <div className="outfit-preview-grid">
                  <div className="outfit-preview">
                    <img
                      alt={selectedOutfit.shirt_name || "Scheduled top"}
                      src={toAbsoluteImageUrl(baseUrl, selectedOutfit.shirt_image_url)}
                    />
                  </div>
                  <div className="outfit-preview">
                    <img
                      alt={selectedOutfit.pants_name || "Scheduled bottom"}
                      src={toAbsoluteImageUrl(baseUrl, selectedOutfit.pants_image_url)}
                    />
                  </div>
                </div>
                <div className="outfit-meta-list">
                  <div className="outfit-meta-row">
                    <span>Top</span>
                    <strong>{selectedOutfit.shirt_name || "Selected top"}</strong>
                  </div>
                  <div className="outfit-meta-row">
                    <span>Bottom</span>
                    <strong>{selectedOutfit.pants_name || "Selected bottom"}</strong>
                  </div>
                  <div className="outfit-meta-row">
                    <span>Score</span>
                    <strong>
                      {typeof selectedOutfit.score === "number"
                        ? `${(selectedOutfit.score / 10).toFixed(1)} / 10`
                        : "-"}
                    </strong>
                  </div>
                  {selectedOutfit.reason && (
                    <div className="outfit-meta-row">
                      <span>Note</span>
                      <strong>{selectedOutfit.reason}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Upload Action Card */}
            <div className="action-card" onClick={() => navigate("/uploader")}>
              <div className="action-content">
                <h4>Ready to expand your wardrobe?</h4>
                <p>Upload new outfits to get AI-powered style ratings and improve your daily schedule.</p>
              </div>
              <button className="action-btn">
                <span className="material-symbols-outlined">add_a_photo</span>
              </button>
            </div>

            <div className="action-card mannequin-card" onClick={() => navigate("/mannequin")}>
              <div className="action-content">
                <h4>Try it on a mannequin</h4>
                <p>Preview your outfit ideas on a mannequin before you wear them out.</p>
              </div>
              <button className="action-btn" aria-label="Open mannequin preview">
                <span className="material-symbols-outlined">accessibility_new</span>
              </button>
            </div>
          </section>

          <section className="weather-side-column">
            <div className="card weather-card">
              <div className="weather-visual">
                {weather?.weather?.[0]?.main && getWeatherIcon(weather.weather[0].main)}
                <div className="weather-temp">
                  {weather?.main?.temp ? `${Math.round(weather.main.temp)}°C` : "--"}
                </div>
              </div>
              <h3 className="card-title">Forecast Suggestion</h3>
              <p className="suggestion-text">{suggestion || "Loading weather data..."}</p>
            </div>

            <div className="rhs-image-card">
              <img src={activeShowpieceImage} alt="Dynamic outfit showcase" className="rhs-image-card-img" />
              <div className="rhs-image-overlay">
                <span>Try on inspiration</span>
                <strong>{activeShowpiece.title}</strong>
                <p>{activeShowpiece.caption}</p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Home;
