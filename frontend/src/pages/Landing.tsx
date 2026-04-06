import React from "react";
import Navbar from "../components/Navbar";
import AboutSection from "../components/AboutSection"; // NEW IMPORT

import "./Landing.css";

/* IMPORT HERO IMAGE */
import heroImg from "../assets/wardrobe.webp";

const Landing: React.FC = () => {
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

          <button className="get-started-btn">
            Get Started →
          </button>

        </div>

      </div>



      {/* ABOUT SECTION (appears when scrolling down) */}

      <AboutSection />


    </div>
  );
};

export default Landing;