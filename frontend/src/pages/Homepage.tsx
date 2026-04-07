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
  const [scheduledDresses, setScheduledDresses] = useState<any[]>([]);
  const [showpieceImages, setShowpieceImages] = useState<ShowpieceImage[]>(fallbackShowpieceImages);
  const [activeShowpieceImage, setActiveShowpieceImage] = useState(fallbackShowpieceImages[0].src);

  useEffect(() => {
    const today = new Date();
    setDate(today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" }));
    setMonth(today.toLocaleDateString("en-US", { month: "long" }).toUpperCase());

    const fetchData = async () => {
      const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
      try {
        const userRes = await fetch(`${baseUrl}/api/user/profile`, { credentials: "include" });
        if (userRes.ok) {
          const data = await userRes.json();
          setUserName(data?.name ?? "User");
        }

        const scheduleRes = await fetch(`${baseUrl}/api/user/schedule`, { credentials: "include" });
        if (scheduleRes.ok) {
          const sData = await scheduleRes.json();
          setScheduledDresses(sData);
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

    fetch(`https://api.openweathermap.org/data/2.5/weather?q=Kottayam&units=metric&appid=29c2a11f21b2372fe5eb4aca0a93bfd8`)
      .then((res) => res.json())
      .then((data) => {
        if (!data || !data.main) return;
        setWeather(data);
        const temp = data.main.temp;
        const condition = data.weather[0].main;

        if (temp > 30 || condition === "Clear") {
          setSuggestion("It's quite warm today! We recommend opting for breathable cotton fabrics and light colors to stay cool and catch the breeze.");
        } else if (condition === "Rain") {
          setSuggestion("It looks like rain is on the way. You might want to choose quick-dry fabrics and avoid heavy layers to stay comfortable throughout the day.");
        } else {
          setSuggestion("The weather is a bit brisk. Try wearing layered outfits; it might be the best way to adapt to the shifting temperatures today.");
        }
      });
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
      case "Clear": return <span className="material-symbols-outlined weather-animate-sun">wb_sunny</span>;
      case "Clouds": return <span className="material-symbols-outlined weather-animate-cloud">cloud</span>;
      case "Rain": return <span className="material-symbols-outlined weather-animate-rain">rainy</span>;
      default: return <span className="material-symbols-outlined">partly_cloudy_day</span>;
    }
  };

  const activeShowpiece = showpieceImages.find((item) => item.src === activeShowpieceImage) ?? fallbackShowpieceImages[0];

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
                {["M", "T", "W", "T", "F", "S", "S"].map((label, i) => {
                  const dayNum = 24 + i;
                  const isScheduled = scheduledDresses.some(d => d.day === dayNum);
                  return (
                    <div key={i} className="calendar-col">
                      <span className="day-label">{label}</span>
                      <div className={`day-number ${dayNum === 24 ? 'active' : ''}`}>{dayNum}</div>
                      {isScheduled && <div className="schedule-dot"></div>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="action-card" onClick={() => navigate("/ratings")}>
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
                {weather && getWeatherIcon(weather.weather[0].main)}
                <div className="weather-temp">
                  {weather ? `${Math.round(weather.main.temp)}°C` : "--"}
                </div>
              </div>
              <h3 className="card-title">Forecast Suggestion</h3>
              <p className="suggestion-text">{suggestion}</p>
            </div>

            <div className="rhs-image-card" onClick={() => navigate("/mannequin")} role="button" tabIndex={0}>
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
