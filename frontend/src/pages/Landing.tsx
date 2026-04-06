import React from "react";
import Navbar from "../components/Navbar";
import AboutSection from "../components/AboutSection"; // NEW IMPORT
import ContactSection from "../components/ContactSection";
import { useNavigate } from "react-router-dom";

import "../styles/Landing.css";

/* IMPORT HERO IMAGE */
import heroImg from "../assets/wardrobe.webp";

const Landing: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-container">

      {/* NAVBAR */}
      <Navbar />



      {/* HERO SECTION */}

      <div className="hero-container">

        <img
          src={heroImg}
          alt="Wardrobe clothes"
          className="hero-image"
        />

        <div className="hero-content">

          <h1>
            DRESS WITH CONFIDENCE
          </h1>

          <p>
            Your personal wardrobe assistant that helps you
            choose the perfect outfit every day
          </p>

          <button className="get-started-btn" onClick={() => navigate("/signup")}>
            Get Started →
          </button>

        </div>

      </div>



      {/* ABOUT SECTION (appears when scrolling down) */}

      <AboutSection />



      {/* CONTACT SECTION */}

      <ContactSection />


    </div>
  );
};

export default Landing;