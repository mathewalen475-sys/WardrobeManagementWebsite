import React from "react";
import "../styles/Signup.css";

const Signup: React.FC = () => {
  return (
    <div className="signup-page">

      <div className="signup-card">

        <h1 className="signup-logo">
          Wadro
        </h1>


        {/* NAME ROW */}

        <div className="name-row">

          <div className="input-group half">

            <label>First Name</label>

            <input
              type="text"
              placeholder="Jane"
            />

          </div>


          <div className="input-group half">

            <label>Last Name</label>

            <input
              type="text"
              placeholder="Doe"
            />

          </div>

        </div>


        {/* EMAIL */}

        <div className="input-group">

          <label>Email Address</label>

          <input
            type="email"
            placeholder="hello@example.com"
          />

        </div>


        {/* PASSWORD */}

        <div className="input-group">

          <label>Password</label>

          <input
            type="password"
            placeholder="At least 8 characters"
          />

        </div>


        {/* CONFIRM PASSWORD */}

        <div className="input-group">

          <label>Confirm Password</label>

          <input
            type="password"
            placeholder="Repeat your password"
          />

        </div>


        {/* BUTTON */}

        <button className="signup-submit">

          Create my Wadro account →

        </button>

      </div>

    </div>
  );
};

export default Signup;