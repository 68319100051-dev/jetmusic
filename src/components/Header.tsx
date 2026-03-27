'use client';
import { Search, User, Bell, Disc3 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function Header() {
  const { user } = useAuth();
  const pathname = usePathname();
  const isSearchPage = pathname === '/search';

  return (
    <header className="header">
      <div className="header-content">
        {!isSearchPage ? (
          <>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <h1 className="logo">
                <Disc3 className="spin-slow" size={28} color="#818cf8" /> Jet Music
              </h1>
            </Link>
            <div className="header-actions">
              <Link href="/search" className="icon-btn">
                <Search size={22} />
              </Link>
              <button className="icon-btn">
                <Bell size={22} />
              </button>
              <Link href="/profile" className="icon-btn" style={{ 
                padding: 0, 
                overflow: 'hidden',
                border: user ? '2px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.1)'
              }}>
                {user ? (
                   <img src={user.avatarUrl} alt={user.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                   <User size={22} />
                )}
              </Link>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '12px' }}>
             <h1 className="logo" style={{ fontSize: '1.4rem' }}>
                <Disc3 size={24} color="#818cf8" /> Jet Search
             </h1>
             <div style={{ flex: 1 }} />
             <Link href="/profile" className="icon-btn" style={{ padding: 0, overflow: 'hidden' }}>
                {user ? (
                   <img src={user.avatarUrl} alt={user.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                   <User size={22} />
                )}
             </Link>
          </div>
        )}
      </div>
    </header>
  );
}
