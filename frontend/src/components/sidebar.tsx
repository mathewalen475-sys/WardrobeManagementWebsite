import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./sidebar.css";
import { logoutUser } from "../services/auth";

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("Loading...");
  const [userStatus] = useState("Member");

  useEffect(() => {
    // Backend fetch logic
    const fetchUser = async () => {
      try {
        // const response = await fetch("YOUR_BACKEND_URL/profile");
        // const data = await response.json();
        setUserName("Akhil Nair"); 

      } catch (err) {
        setUserName("User");
      }
    };
    fetchUser();
  }, []);

  return (
    <aside className="sidebar">
      
      {/* Brand Header: Centralized */}
      <div className="sidebar-brand-section">
        <h1 className="logo-title">Wadro</h1>
        <p className="logo-subtitle">Curating your style</p>
      </div>

      {/* Navigation - Keeps original spacing/placing */}
      <nav className="sidebar-nav">
        <a className="nav-item active">
          <span className="material-symbols-outlined">home</span>
          <span className="nav-text">Home</span>
        </a>

        <Link className="nav-item" to="/calendar">
          <span className="material-symbols-outlined">calendar_month</span>
          <span className="nav-text">Calendar</span>
        </Link>

        <a className="nav-item">
          <span className="material-symbols-outlined">accessibility_new</span>
          <span className="nav-text">Mannequin</span>
        </a>
      </nav>

      {/* Bottom Section */}
      <div className="sidebar-bottom">
        {/* Profile Section */}
        <div className="profile-section">
          <div className="profile-avatar">
            <img src="https://via.placeholder.com/100" alt="User" />
          </div>
          <div className="profile-info">
            <span className="profile-name">{userName}</span>
            <span className="profile-status">{userStatus}</span>
          </div>
        </div>

        {/* Logout Option */}
        <button
          className="logout-btn"
          onClick={async () => {
            await logoutUser();
            navigate("/login");
          }}
        >
          <span className="material-symbols-outlined">logout</span>
          <span className="nav-text">Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;