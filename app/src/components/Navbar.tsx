'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function Navbar() {
  const { isAuthenticated, logout, username } = useAuth();

  if (!isAuthenticated) return null;

  return (
    <nav style={{ 
      padding: '1rem 2rem', 
      borderBottom: '0.125rem solid var(--border-color)', 
      marginBottom: '2rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: '#fff'
    }}>
      <div style={{ display: 'flex', gap: '2rem' }}>
        <Link href="/" style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>Recipe Book</Link>
        <Link href="/recipes">All Recipes</Link>
      </div>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <span>Chef {username}</span>
        <button onClick={logout} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>Leave Kitchen</button>
      </div>
    </nav>
  );
}

