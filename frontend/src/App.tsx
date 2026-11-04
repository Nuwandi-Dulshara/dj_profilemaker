import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import Home from './pages/Home';
import Builder from './pages/Builder';
import Dashboard from './pages/Dashboard';
import PublicProfile from './pages/PublicProfile';
import Auth from './pages/Auth';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Settings from './pages/Settings';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

function AppRoutes() {
  const { pathname } = useLocation();
  const showSiteFooter = !['/', '/login', '/register', '/forgot-password', '/reset-password'].includes(
    pathname
  );

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
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route path="/p/:slug" element={<PublicProfile />} />
        <Route path="/login" element={<Auth mode="login" />} />
        <Route path="/register" element={<Auth mode="register" />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="*"
          element={
            <main className="empty-state container" style={{ padding: '80px 20px', textAlign: 'center' }}>
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
          © {new Date().getFullYear()} Profile Studio Pro.
        </footer>
      )}
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: {
                background: '#1e293b',
                color: '#f8fafc',
                borderRadius: '10px',
                fontSize: '13px',
              },
            }}
          />
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
