import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./components/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

// Layout Imports
import StudentLayout from "./layouts/StudentLayout";
import StaffLayout from "./layouts/StaffLayout"; 
import HeadLayout from "./layouts/HeadLayout";

// --- 1. PUBLIC & THIRD-PARTY (No Login Required) ---
import LandingPage from "./pages/Sharedfiles/General/LandingPage.jsx"; 
import Login from "./pages/Sharedfiles/General/Login.jsx"; 
import PublicVerification from "./pages/PublicVerification"; 

// --- 2. SHARED UTILITIES ---
import NotificationPage from "./pages/Sharedfiles/General/NotificationPage.jsx"; 
import NotificationToast from "./components/Notification.jsx";  
import QrGenerator from "./pages/Sharedfiles/General/QrGenerator.jsx"; 
import Settings from "./pages/Sharedfiles/General/Settings.jsx"; 

// --- 3. STUDENT PAGES ---
import StudentDashboard from "./pages/StudentPage/StudentDashboard"; 
import StudentProfile from "./pages/StudentPage/StudentProfile";
import ApplicationForm from "./pages/StudentPage/ApplicationForm"; 
import ViewCredential from "./pages/StudentPage/ViewCredential.jsx";

// --- 4. STAFF PAGES ---
import StaffDashboard from "./pages/StaffPage/StaffDashboard"; 
import Verify from "./pages/StaffPage/Verify.jsx";
import LookUp from "./pages/StaffPage/LookUp.jsx";
import StaffProfile from "./pages/StaffPage/StaffProfile";
import ActivityHistory from "./pages/Sharedfiles/StaffFiles/ActivityHistory.jsx";
import LogActivity from "./pages/Sharedfiles/StaffFiles/LogActivity.jsx";

// --- 5. HEAD PAGES ---
import HeadDashboard from "./pages/HeadPage/HeadDashboard"; 
import MintingConsole from "./pages/HeadPage/MintingConsole";
import VerificationResult from "./pages/HeadPage/VerificationResult.jsx"; 

// --- 6. ADMIN ---
import AdminDashboard from "./pages/ProfileGenerator/Admin.jsx"; 

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <ScrollToTop />
        <NotificationToast /> 

        <Routes>
          {/* --- PUBLIC GROUP --- */}
          <Route path="/" element={<LandingPage />} /> 
          <Route path="/auth" element={<Login />} /> 
          <Route path="/verify/:id" element={<PublicVerification />} />

          {/* --- STUDENT PORTAL --- */}
          <Route 
            path="/student" 
            element={
              <ProtectedRoute requiredRole="student">
                <StudentLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="upload" element={<ApplicationForm />} /> 
            <Route path="qr-generate/:application_id" element={<QrGenerator />} /> 
            <Route path="profile" element={<StudentProfile />} />
            <Route path="credential/:credentialId" element={<ViewCredential />} />
            {/* Removed ActivityHistory from Student */}
            <Route path="notifications" element={<NotificationPage />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* --- STAFF PORTAL --- */}
          <Route 
            path="/staff" 
            element={
              <ProtectedRoute requiredRole="staff"> 
                <StaffLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<StaffDashboard />} />
            <Route path="verify" element={<Verify />} /> 
            <Route path="lookup" element={<LookUp />} />
            {/* LogActivity removed from Staff */}
            <Route path="history" element={<ActivityHistory />} />
            <Route path="profile" element={<StaffProfile />} /> 
            <Route path="settings" element={<Settings />} />
            <Route path="verify/:docId" element={<VerificationResult />} />
          </Route>

          {/* --- HEAD PORTAL --- */}
          <Route 
            path="/head" 
            element={
              <ProtectedRoute requiredRole="head">
                <HeadLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<HeadDashboard />} />
            <Route path="mint/:docId" element={<MintingConsole />} />
            <Route path="logs" element={<LogActivity />} /> 
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* --- ADMIN PORTAL --- */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <Navigate to="/admin/dashboard" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}