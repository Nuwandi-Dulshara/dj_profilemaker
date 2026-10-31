import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import Builder from "./pages/Builder";
import Dashboard from "./pages/Dashboard";
import PublicProfile from "./pages/PublicProfile";
import Auth from "./pages/Auth";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";

function AppRoutes() {
  const { pathname } = useLocation();
  const showSiteFooter = !["/", "/login", "/register"].includes(pathname);

  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/builder"
          element={
            <ProtectedRoute>
              <Builder />
            </ProtectedRoute>
          }
        />
        <Route path="/p/:slug" element={<PublicProfile />} />
        <Route path="/login" element={<Auth mode="login" />} />
        <Route path="/register" element={<Auth mode="register" />} />
        <Route
          path="*"
          element={
            <main className="empty-state container">
              <h1>Page Not Found</h1>
              <p>The page you’re looking for doesn’t exist.</p>
              <Link to="/" className="btn btn-primary">
                Back to Home
              </Link>
            </main>
          }
        />
      </Routes>
      {showSiteFooter && (
        <footer className="site-footer">
          © {new Date().getFullYear()} Profile Studio Pro. Built with React and
          TypeScript.
        </footer>
      )}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
