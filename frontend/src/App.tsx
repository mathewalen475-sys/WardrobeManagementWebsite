import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import type { ReactElement } from "react";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Home from "./pages/Homepage";
import CalendarPage from "./pages/CalenderPage";
import Scheduler from "./pages/Scheduler";
import Uploader from "./pages/Uploader";
import TryOn from "./pages/TryOn";
import { isAuthenticated } from "./services/auth";

function ProtectedRoute({ children }: { children: ReactElement }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function SchedulerRoute() {
  const navigate = useNavigate();

  return (
    <Scheduler
      isOpen={true}
      onClose={() => navigate(-1)}
    />
  );
}

function UploaderRoute() {
  const navigate = useNavigate();

  return (
    <Uploader
      isOpen={true}
      onClose={() => navigate(-1)}
    />
  );
}


function App() {
  return (
    <Routes>

      <Route path="/" element={<Landing />} />

      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/home"
        element={(
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/homepage"
        element={(
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        )}
      />

      <Route
        path="/calendar"
        element={(
          <ProtectedRoute>
            <CalendarPage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/calender"
        element={(
          <ProtectedRoute>
            <CalendarPage />
          </ProtectedRoute>
        )}
      />

      <Route
        path="/scheduler"
        element={(
          <ProtectedRoute>
            <SchedulerRoute />
          </ProtectedRoute>
        )}
      />

      <Route
        path="/uploader"
        element={(
          <ProtectedRoute>
            <UploaderRoute />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/ratings"
        element={(
          <ProtectedRoute>
            <UploaderRoute />
          </ProtectedRoute>
        )}
      />

      <Route
        path="/try-on"
        element={(
          <ProtectedRoute>
            <TryOn />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/mannequin"
        element={(
          <ProtectedRoute>
            <TryOn />
          </ProtectedRoute>
        )}
      />

    </Routes>
  );
}
export default App;