import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Signup.css";
import { registerUser } from "../services/auth";

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const trimmedFirstName = firstName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedFirstName || !trimmedEmail || !password) {
      setError("First name, email, and password are required.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      await registerUser({
        username: trimmedEmail,
        password,
        name: trimmedFirstName,
      });
      navigate("/home", { replace: true });
    } catch (registerError) {
      const message = registerError instanceof Error ? registerError.message : "Signup failed";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signup-page">

      <form className="signup-card" onSubmit={handleSubmit}>

        <h1 className="signup-logo">
          Wadro
        </h1>

        {/* NAME ROW */}

        <div className="name-row">

          <div className="input-group half">

            <label htmlFor="firstName">First Name</label>

            <input
              id="firstName"
              type="text"
              placeholder="Jane"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              autoComplete="given-name"
            />

          </div>


          <div className="input-group half">

            <label htmlFor="lastName">Last Name</label>

            <input
              id="lastName"
              type="text"
              placeholder="Doe"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              autoComplete="family-name"
            />

          </div>

        </div>


        {/* EMAIL / USERNAME */}

        <div className="input-group">

          <label htmlFor="username">Email Address</label>

          <input
            id="username"
            type="email"
            placeholder="hello@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />

        </div>


        {/* PASSWORD */}

        <div className="input-group">

          <label htmlFor="password">Password</label>

          <input
            id="password"
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />

        </div>


        {/* CONFIRM PASSWORD */}

        <div className="input-group">

          <label htmlFor="confirmPassword">Confirm Password</label>

          <input
            id="confirmPassword"
            type="password"
            placeholder="Repeat your password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
          />

        </div>

        {error ? <p className="auth-error">{error}</p> : null}


        {/* BUTTON */}

        <button className="signup-submit" type="submit" disabled={isLoading}>

          {isLoading ? "Creating account..." : "Create my Wadro account →"}

        </button>

      </form>

    </div>
  );
};

export default Signup;