import React, { useEffect, useState } from "react";
import Sidebar from "../components/sidebar";
import artboardImg from "../assets/logo.webp";
import { useNavigate } from "react-router-dom";
import "../styles/Homepage.css";

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("User");
  const [date, setDate] = useState("");
  const [weather, setWeather] = useState<any>(null);
  const [suggestion, setSuggestion] = useState("");
  const [month, setMonth] = useState("");
  const [scheduledDresses, setScheduledDresses] = useState<any[]>([]);

  useEffect(() => {
    const today = new Date();
    setDate(today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" }));
    setMonth(today.toLocaleDateString("en-US", { month: "long" }).toUpperCase());

    const fetchData = async () => {
      const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
      try {
        // Fetch User
        const userRes = await fetch(`${baseUrl}/api/user/profile`, { credentials: "include" });
        if (userRes.ok) {
          const data = await userRes.json();
          setUserName(data?.username ?? data?.name ?? "User");
        }
        
        // Fetch Scheduled Dresses (names/types, not images)
        const scheduleRes = await fetch(`${baseUrl}/api/user/schedule`);
        if (scheduleRes.ok) {
          const sData = await scheduleRes.json();
          setScheduledDresses(sData); // e.g., [{day: 24, item: "Linen Shirt"}]
        }
      } catch (err) {
        console.error("Fetch error:", err);
      }
    };

    fetchData();

    // Weather API
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

  const getWeatherIcon = (condition: string) => {
    switch (condition) {
      case "Clear": return <span className="material-symbols-outlined weather-animate-sun">wb_sunny</span>;
      case "Clouds": return <span className="material-symbols-outlined weather-animate-cloud">cloud</span>;
      case "Rain": return <span className="material-symbols-outlined weather-animate-rain">rainy</span>;
      default: return <span className="material-symbols-outlined">partly_cloudy_day</span>;
    }
  };

  return (
    <div className="homepage-container">
      <Sidebar />
      <main className="main-content">
        <div className="header-top-right">
          <img src={artboardImg} alt="Website Group" className="header-artboard" />
        </div>
        <header className="header">
          <p className="welcome-text">Welcome back, {userName}</p>
          <h2 className="date-text">{date}</h2>
        </header>

        <div className="dashboard-grid">
          {/* Calendar Section */}
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

            {/* Upload Action Card */}
            <div className="action-card" onClick={() => navigate("/ratings")}>
              <div className="action-content">
                <h4>Ready to expand your wardrobe?</h4>
                <p>Upload new outfits to get AI-powered style ratings and improve your daily schedule.</p>
              </div>
              <button className="action-btn">
                <span className="material-symbols-outlined">add_a_photo</span>
              </button>
            </div>
          </section>

          {/* Weather Section */}
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

           
          </section>
        </div>
      </main>
    </div>
  );
};

export default Home;