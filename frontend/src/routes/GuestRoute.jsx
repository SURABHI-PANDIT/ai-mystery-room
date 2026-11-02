import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';

export default function GuestRoute() {
  const { user, loading, sessionError, refreshSession } = useAuth();
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
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
}
