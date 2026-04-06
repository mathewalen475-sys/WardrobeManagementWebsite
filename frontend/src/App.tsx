import { Route, Routes, useNavigate } from "react-router-dom";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Home from "./pages/Homepage";
import CalendarPage from "./pages/CalenderPage";
import Scheduler from "./pages/Scheduler";
import Uploader from "./pages/Uploader";

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
      <Route path="/signup" element={<Login />} />
      <Route path="/home" element={<Home />} />
      <Route path="/homepage" element={<Home />} />

      <Route path="/calendar" element={<CalendarPage />} />
      <Route path="/calender" element={<CalendarPage />} />

      <Route path="/scheduler" element={<SchedulerRoute />} />

      <Route path="/uploader" element={<UploaderRoute />} />
      <Route path="/ratings" element={<UploaderRoute />} />

    </Routes>
  );
}
export default App;