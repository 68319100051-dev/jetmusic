'use client';
import { Search, User, Bell } from 'lucide-react';
import Image from 'next/image';
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
                <Image 
                  src="/icon.png" 
                  alt="Jet Music Logo" 
                  width={32} 
                  height={32} 
                  className="logo-img"
                /> 
                Jet Music
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
                <Image 
                  src="/icon.png" 
                  alt="Jet Music Logo" 
                  width={28} 
                  height={28} 
                  className="logo-img"
                  style={{ width: 28, height: 28 }}
                /> 
                Jet Search
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
