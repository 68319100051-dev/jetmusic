'use client';
import { useState, useEffect } from 'react';
import { Lock, Users, Music, PlaySquare, ChevronRight, Activity, X } from 'lucide-react';

export default function AdminDashboard() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password) { setError('กรุณาใส่รหัสผ่าน'); return; }
    
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json.error || 'ล้อกอินไม่สำเร็จ');
      }
      
      setData(json);
      setIsAuthenticated(true);
      sessionStorage.setItem('jet_admin_key', password);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const saved = sessionStorage.getItem('jet_admin_key');
    if (saved) {
       setPassword(saved);
       // Note: We don't auto-login here to avoid unhandled promise rejections on load if it changed, 
       // but user can just click instead.
    }
  }, []);

  if (!isAuthenticated) {
     return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: 'white', padding: 20 }}>
          <form onSubmit={handleLogin} style={{ background: '#111', padding: 40, borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', width: '100%', maxWidth: 400 }}>
             <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
               <Lock size={48} color="#818cf8" />
             </div>
             <h1 style={{ textAlign: 'center', marginBottom: 30, fontSize: '1.5rem', fontWeight: 800 }}>Admin Login</h1>
             
             {error && <div style={{ background: 'rgba(255,77,77,0.1)', color: '#ff4d4d', padding: 12, borderRadius: 8, marginBottom: 20, fontSize: '0.9rem', textAlign: 'center' }}>{error}</div>}
             
             <input 
               type="password" 
               placeholder="รหัสผ่านผู้ดูแลระบบ"
               value={password}
               onChange={(e) => setPassword(e.target.value)}
               readOnly={loading}
               style={{ width: '100%', padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', marginBottom: 20, outline: 'none' }}
             />
             <button disabled={loading} type="submit" style={{ width: '100%', padding: 14, borderRadius: 12, background: '#818cf8', color: 'black', fontWeight: 'bold', fontSize: '1rem', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
               {loading ? 'Authenticating...' : 'Access Dashboard'}
             </button>
          </form>
        </div>
     );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: 'white', padding: '40px 20px', fontFamily: 'sans-serif' }}>
       <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
             <h1 style={{ fontSize: '2rem', fontWeight: 800, background: 'linear-gradient(90deg, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
               Jet Music Admin
             </h1>
             <button onClick={() => { setIsAuthenticated(false); setPassword(''); sessionStorage.removeItem('jet_admin_key'); }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', padding: '8px 16px', borderRadius: 20, color: 'white', cursor: 'pointer', outline: 'none' }}>
               Logout
             </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20, marginBottom: 40 }}>
            <div style={{ background: 'linear-gradient(135deg, rgba(129, 140, 248, 0.1), rgba(129, 140, 248, 0.05))', border: '1px solid rgba(129, 140, 248, 0.2)', padding: 24, borderRadius: 20 }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, color: 'rgba(255,255,255,0.6)' }}>
                 <Users size={20} />
                 <span>Total Users</span>
               </div>
               <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>{data?.stats?.totalUsers || 0}</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, rgba(192, 132, 252, 0.1), rgba(192, 132, 252, 0.05))', border: '1px solid rgba(192, 132, 252, 0.2)', padding: 24, borderRadius: 20 }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, color: 'rgba(255,255,255,0.6)' }}>
                 <PlaySquare size={20} />
                 <span>Total Songs Played</span>
               </div>
               <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>{data?.stats?.totalSongsPlayed || 0}</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.1), rgba(52, 211, 153, 0.05))', border: '1px solid rgba(52, 211, 153, 0.2)', padding: 24, borderRadius: 20 }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, color: 'rgba(255,255,255,0.6)' }}>
                 <Music size={20} />
                 <span>Total Playlists</span>
               </div>
               <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>{data?.stats?.totalPlaylists || 0}</div>
            </div>
          </div>

          <h2 style={{ fontSize: '1.5rem', marginBottom: 20, fontWeight: 700 }}>Registered Users</h2>
          <div style={{ overflowX: 'auto', background: '#111', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 600 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
                  <th style={{ padding: '16px 24px', fontWeight: 600 }}>Email</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600 }}>Songs Played</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600 }}>Liked Tracks</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600 }}>Playlists</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600 }}>History</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {data?.users?.map((u: any, i: number) => (
                   <tr key={i} style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }} onClick={() => setSelectedUser(u)}>
                     <td style={{ padding: '16px 24px', fontWeight: 500, color: 'white' }}>{u.email}</td>
                     <td style={{ padding: '16px 24px', color: '#818cf8', fontWeight: 'bold' }}>{u.stats?.songsPlayed || 0}</td>
                     <td style={{ padding: '16px 24px', color: 'rgba(255,255,255,0.7)' }}>{u.likedTracks?.length || 0}</td>
                     <td style={{ padding: '16px 24px', color: 'rgba(255,255,255,0.7)' }}>{u.playlists?.length || 0}</td>
                     <td style={{ padding: '16px 24px', color: 'rgba(255,255,255,0.7)' }}>{u.history?.length || 0}</td>
                     <td style={{ padding: '16px 24px' }}><ChevronRight size={18} color="rgba(255,255,255,0.4)" /></td>
                   </tr>
                ))}
              </tbody>
            </table>
          </div>
       </div>

       {selectedUser && (
         <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20 }} onClick={() => setSelectedUser(null)}>
            <div style={{ width: '100%', maxWidth: 600, background: '#111', maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: 24, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
               <div style={{ padding: 24, borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                 <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>{selectedUser.email}</h2>
                 <button onClick={() => setSelectedUser(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 4 }}><X size={24} /></button>
               </div>

               <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 32 }}>
                   <div>
                      <h3 style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.6)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Music size={18} /> Playlists ({selectedUser.playlists?.length || 0})</h3>
                      {selectedUser.playlists?.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                          {selectedUser.playlists.map((p: any) => (
                             <div key={p.id} style={{ background: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 4 }}>{p.title}</div>
                                <div style={{ fontSize: '0.8rem', color: '#818cf8', fontWeight: 500 }}>{p.items?.length || 0} tracks</div>
                             </div>
                          ))}
                        </div>
                      ) : <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem', padding: '10px 0' }}>No playlists created</div>}
                   </div>

                   <div>
                      <h3 style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.6)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={18} /> Recent History (Last 50)</h3>
                      {selectedUser.history?.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {selectedUser.history.slice(0, 50).map((t: any, idx: number) => (
                             <div key={`${t.id}-${idx}`} style={{ display: 'flex', gap: 12, background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 12, alignItems: 'center', border: '1px solid rgba(255,255,255,0.02)' }}>
                                <img src={t.coverUrl} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />
                                <div>
                                  <div style={{ fontSize: '0.95rem', fontWeight: 600, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.title}</div>
                                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{t.artist}</div>
                                </div>
                             </div>
                          ))}
                        </div>
                      ) : <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem', padding: '10px 0' }}>No history available</div>}
                   </div>
               </div>
            </div>
         </div>
       )}
    </div>
  );
}
