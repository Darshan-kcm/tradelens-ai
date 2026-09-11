import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import AppLayout from "@/components/layout/AppLayout";
import Analytics from "@/pages/Analytics";
import Backtesting from "@/pages/Backtesting";
import Dashboard from "@/pages/Dashboard";
import Fundamentals from "@/pages/Fundamentals";
import Login from "@/pages/Login";
import Markets from "@/pages/Markets";
import News from "@/pages/News";
import Screener from "@/pages/Screener";
import Settings from "@/pages/Settings";
import VolumeAnalysis from "@/pages/VolumeAnalysis";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/screener" element={<Screener />} />
          <Route path="/news" element={<News />} />
          <Route path="/fundamentals" element={<Fundamentals />} />
          <Route path="/volume" element={<VolumeAnalysis />} />
          <Route path="/backtesting" element={<Backtesting />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <Toaster position="top-right" richColors />
    </>
  );
}
