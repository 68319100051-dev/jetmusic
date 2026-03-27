'use client';
import { useAuth } from '@/contexts/AuthContext';
import Dashboard from '@/components/Dashboard';
import LandingPage from '@/components/LandingPage';

export default function ProfilePage() {
  const { user, isLoaded } = useAuth();

  if (!isLoaded) return null;

  // Profile requires a real account
  if (!user) {
    return <LandingPage />;
  }

  return <Dashboard />;
}
