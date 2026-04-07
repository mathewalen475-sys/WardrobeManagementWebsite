import React from "react";
import "./ContactSection.css";

const ContactSection: React.FC = () => {
return ( <section id="contact" className="contact-section">


  <div className="contact-card">

    <div className="contact-header">
      <span className="contact-eyebrow">Contact Us</span>
      <h2>Let’s Talk About Your Wardrobe</h2>
      <p>Send us a message and we’ll help with styling advice, wardrobe support, or anything else you need.</p>
    </div>

    <form className="contact-form">

      <div className="row">

        <div className="input-group">
          <label>NAME</label>
          <input type="text" placeholder="Your full name" />
        </div>

        <div className="input-group">
          <label>EMAIL</label>
          <input type="email" placeholder="hello@example.com" />
        </div>

      </div>


      <div className="input-group">
        <label>SUBJECT</label>
        <select>
          <option>Wardrobe Consultation</option>
          <option>Styling Advice</option>
          <option>Technical Support</option>
        </select>
      </div>


      <div className="input-group">
        <label>MESSAGE</label>
        <textarea placeholder="How can our atelier assist you?" />
      </div>


      <button className="contact-btn">
        SEND MESSAGE
      </button>

    </form>

  </div>

</section>


);
};

export default ContactSection;