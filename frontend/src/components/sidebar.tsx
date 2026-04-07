import React, { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import "./sidebar.css";
import { logoutUser } from "../services/auth";

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState("Loading...");
  const [userStatus] = useState("Member");
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(`${baseUrl}/api/user/profile`, {
          credentials: "include",
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        setUserName(data?.name ?? "User");

      } catch (err) {
        setUserName("User");
      }
    };

    fetchUser();
  }, [baseUrl]);

  return (
    <aside className="sidebar">
      
      {/* Brand Header: Centralized */}
      <div className="sidebar-brand-section">
        <h1 className="logo-title">Wadro</h1>
        <p className="logo-subtitle">Curating your style</p>
      </div>

      {/* Navigation - Keeps original spacing/placing */}
      <nav className="sidebar-nav">
        <NavLink
          to="/home"
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <span className="material-symbols-outlined">home</span>
          <span className="nav-text">Home</span>
        </NavLink>

        <NavLink
          to="/calendar"
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <span className="material-symbols-outlined">calendar_month</span>
          <span className="nav-text">Calendar</span>
        </NavLink>

        <NavLink
          to="/grading"
          className={({ isActive }) => `nav-item ${isActive || location.pathname === "/ratings" ? "active" : ""}`}
        >
          <span className="material-symbols-outlined">accessibility_new</span>
          <span className="nav-text">Grading</span>
        </NavLink>
      </nav>

      {/* Bottom Section */}
      <div className="sidebar-bottom">
        {/* Profile Section */}
        <div className="profile-section">
          <div className="profile-avatar">
            <span className="material-symbols-outlined profile-avatar-icon" aria-hidden="true">
              person
            </span>
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