import React from "react";
import "./Navbar.css";

import icon from "../assets/icon.webp";
import logo from "../assets/logo.webp";

/* ADD THIS */
import { useNavigate } from "react-router-dom";

const Navbar: React.FC = () => {

  const navigate = useNavigate();

  return (
    <>
      {/* TOP BROWN STRIP */}

      <div className="top-strip"></div>


      <nav className="navbar">

        {/* LOGO SECTION */}

        <div
          className="logo-section"
          onClick={() => navigate("/")}
          style={{ cursor: "pointer" }}
        >

          <img src={icon} className="logo-icon" />

          <img src={logo} className="logo-text-image" />

        </div>



        {/* NAV LINKS */}

        <div className="nav-links">

          <a onClick={() => navigate("/")}>
            Home
          </a>

          <a href="#about">
            About us
          </a>

          <a>
            Contact us
          </a>

        </div>



        {/* NAV BUTTONS */}

        <div className="nav-buttons">

          <button
            className="login-btn"
            onClick={() => navigate("/login")}
          >
            Login
          </button>


          <button
            className="signup-btn"
            onClick={() => navigate("/signup")}
          >
            Sign up
          </button>

        </div>

      </nav>
    </>
  );
};

export default Navbar;