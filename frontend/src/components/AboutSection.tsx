import React from "react";
import "./AboutSection.css";

import aboutImg from "../assets/hero.webp"; // replace with your image if different

const AboutSection: React.FC = () => {
  return (
    <section id="about" className="about-container">

      {/* ABOUT WADRO */}

      <h2>ABOUT WADRO</h2>

      <p>
        Wadro is your intelligent personal wardrobe assistant designed to simplify
        the way you choose outfits every day.
      </p>

      <p>
        We combine smart technology with personalized fashion support to help users
        organize their wardrobe, discover outfit combinations, and make confident
        styling decisions effortlessly.
      </p>


      {/* OUR MISSION */}

      <h2>OUR MISSION</h2>

      <p>
        Our mission is to empower individuals to make confident outfit choices by
        providing a smart digital wardrobe solution that:
      </p>

      <ul>
        <li>Organizes clothing efficiently</li>
        <li>Suggests outfit combinations intelligently</li>
        <li>Saves time during daily dressing decisions</li>
        <li>Encourages smarter wardrobe usage</li>
        <li>Makes fashion planning simple and enjoyable</li>
      </ul>

      <p>
        We aim to transform the traditional wardrobe into a modern, intelligent
        styling assistant.
      </p>


      {/* IMAGE */}

      <img
        src={aboutImg}
        alt="Wardrobe planning"
        className="about-image"
      />


      {/* OUR VISION */}

      <h2>OUR VISION</h2>

      <p>
        Our vision is to become a trusted AI-powered wardrobe companion that helps
        people worldwide manage their clothing smarter and dress confidently every day.
      </p>

      <p>We aspire to:</p>

      <ul>
        <li>Integrate AI-based outfit recommendations</li>
        <li>Support personalized styling experiences</li>
        <li>Promote sustainable wardrobe usage</li>
        <li>Reduce decision fatigue in daily dressing</li>
        <li>Create a seamless digital fashion assistant for everyone</li>
      </ul>

    </section>
  );
};

export default AboutSection;