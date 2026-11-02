import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';

export default function ProtectedRoute() {
  const { user, loading, sessionError, refreshSession } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen label="Checking your session" />;
  if (sessionError) {
    return (
      <main className="state-screen">
        <p className="eyebrow">Connection issue</p>
        <h1>We couldn’t reach the investigation room.</h1>
        <p>{sessionError}</p>
        <button className="button button--primary" onClick={refreshSession}>Try again</button>
      </main>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  return <Outlet />;
}
