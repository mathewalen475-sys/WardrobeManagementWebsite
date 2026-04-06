import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Login.css";

import logo from "../assets/logo.webp";
import { isAuthenticated, loginUser } from "../services/auth";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      navigate("/home", { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Username and password are required.");
      return;
    }

    setIsLoading(true);
    try {
      await loginUser({ username: username.trim(), password });

      if (!rememberMe) {
        sessionStorage.setItem("wadro_session_only", "true");
      } else {
        sessionStorage.removeItem("wadro_session_only");
      }

      navigate("/home", { replace: true });
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : "Login failed";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">

      {/* TOP STRIP */}
      <div className="top-strip"></div>


      {/* LOGIN CARD */}

      <form className="login-card" onSubmit={handleSubmit}>

        <img
          src={logo}
          alt="Wadro logo"
          className="login-logo"
        />


        {/* EMAIL */}

        <label className="field-label" htmlFor="username">Username</label>

        <input
          id="username"
          type="text"
          placeholder="Enter your username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
        />


        {/* PASSWORD */}

      <label className="field-label" htmlFor="password">Password</label>

        <input
          id="password"
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />


        {/* OPTIONS */}

        <div className="login-options">

          <label className="remember">

            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />

            Remember me

          </label>

          <span className="forgot" role="button" tabIndex={0}>
            Forgot password?
          </span>

        </div>

        {error ? <p className="auth-error">{error}</p> : null}


        {/* LOGIN BUTTON */}

        <button className="login-btn-outline" type="submit" disabled={isLoading}>

          {isLoading ? "Logging in..." : "Login to Wadro →"}

        </button>
      </form>

    </div>
  );
};

export default Login;