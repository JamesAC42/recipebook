'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';

export default function Navbar() {
  const { isAuthenticated, logout, username } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isAuthenticated) return null;

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <>
      <div className="nav-wrapper">
        <nav className="nav-container">
          <div className="nav-links">
            <Link href="/" className="add-recipe-btn">
              <span>Add Recipe</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </Link>
            <Link href="/recipes" style={{ display: 'flex', alignItems: 'center' }}>All Recipes</Link>
          </div>

          <div className="nav-user">
            <span>Chef {username}</span>
            <button onClick={logout} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>Leave Kitchen</button>
          </div>

          <button className="menu-toggle" onClick={toggleSidebar} aria-label="Toggle menu">
            ☰
          </button>
        </nav>
      </div>

      <div className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`} onClick={toggleSidebar} />
      <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            onClick={toggleSidebar} 
            style={{ background: 'none', border: 'none', fontSize: '2rem', boxShadow: 'none', padding: 0, minWidth: 'auto' }}
            aria-label="Close menu"
          >
            ×
          </button>
        </div>
        <Link href="/" onClick={toggleSidebar} className="add-recipe-btn" style={{ justifyContent: 'center' }}>
          <span>Add Recipe</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </Link>
        <Link href="/recipes" onClick={toggleSidebar} style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>All Recipes</Link>
        <div style={{ marginTop: 'auto', borderTop: '0.125rem solid var(--border-color)', paddingTop: '1rem' }}>
          <div style={{ marginBottom: '1rem' }}>Chef {username}</div>
          <button onClick={() => { logout(); toggleSidebar(); }} style={{ width: '100%' }}>Leave Kitchen</button>
        </div>
      </div>
    </>
  );
}
