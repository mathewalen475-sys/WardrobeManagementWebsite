import React from "react";
import "./Login.css";

import logo from "../assets/logo.webp";

const Login: React.FC = () => {
  return (
    <div className="login-page">

      {/* TOP STRIP */}
      <div className="top-strip"></div>


      {/* LOGIN CARD */}

      <div className="login-card">

        <img
          src={logo}
          alt="Wadro logo"
          className="login-logo"
        />


        {/* EMAIL */}

        <label className="field-label">Email Address</label>

        <input
          type="email"
          placeholder="Enter your email address"
        />


        {/* PASSWORD */}

      <label className="field-label">Password</label>

        <input
          type="password"
          placeholder="Enter password"
        />


        {/* OPTIONS */}

        <div className="login-options">

          <label className="remember">

            <input type="checkbox" />

            Remember me

          </label>

          <span className="forgot">
            Forgot password?
          </span>

        </div>


        {/* LOGIN BUTTON */}

        <button className="login-btn-outline">

          Login to Wadro →

        </button>


        {/* CREATE ACCOUNT */}

        <div className="create-account">

          <span>Don't have an account?</span>

          <button>Create an account</button>

        </div>

      </div>

    </div>
  );
};

export default Login;