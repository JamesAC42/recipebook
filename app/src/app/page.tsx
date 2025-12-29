'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
  aisle: string;
}

interface TranscribedRecipe {
  title: string;
  description: string;
  cuisine: string;
  ingredients: Ingredient[];
  instructions: string;
  health_info: Record<string, unknown> | null;
}

export default function Home() {
  const { isAuthenticated, token, isInitialized } = useAuth();
  const router = useRouter();
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [transcribed, setTranscribed] = useState<TranscribedRecipe | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.push('/login');
    }
  }, [isInitialized, isAuthenticated, router]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setImages(prev => [...prev, ...newFiles]);
      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const showNotify = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleTranscribe = async () => {
    if (images.length === 0 || !token) return;
    setLoading(true);
    const formData = new FormData();
    images.forEach(img => formData.append('images', img));

    try {
      const response = await fetch('/recipebook/api/recipes/transcribe', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        setTranscribed(data);
        showNotify('Recipe transcribed successfully!');
      } else {
        showNotify(data.error || 'Failed to transcribe', 'error');
      }
    } catch (err) {
      showNotify('Error transcribing image', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!transcribed || !token) return;
    try {
      const response = await fetch('/recipebook/api/recipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(transcribed),
      });
      if (response.ok) {
        showNotify('Recipe saved to your book!');
        setTimeout(() => {
          setTranscribed(null);
          setImages([]);
          setPreviews([]);
          router.push('/recipes');
        }, 1500);
      } else {
        showNotify('Failed to save recipe', 'error');
      }
    } catch (err) {
      showNotify('Error saving recipe', 'error');
    }
  };

  if (!isInitialized || !isAuthenticated) return null;

  return (
    <main>
      
      {notification && (
        <div className="notification" style={{
          position: 'fixed', top: '2rem', right: '2rem', 
          backgroundColor: notification.type === 'success' ? 'var(--secondary-color)' : '#e74c3c',
          color: 'white', padding: '1rem 2rem', zIndex: 2000,
          border: '2px solid var(--border-color)',
          boxShadow: '4px 4px 0 var(--border-color)',
          animation: 'slideIn 0.3s ease-out'
        }}>
          {notification.message}
        </div>
      )}

      <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '0 1rem' }}>
        <div className="paper">
          <h1>New Recipe Transcription</h1>
          <p>Snap photos of your handwritten or printed recipe. You can upload multiple pages.</p>
          
          <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageChange} 
                id="file-upload" 
                style={{ display: 'none' }}
                multiple
              />
              <label htmlFor="file-upload" className="button" style={{ 
                display: 'inline-block', padding: '1rem 2rem', backgroundColor: 'var(--secondary-color)', color: 'white'
              }}>
                Add Photo(s)
              </label>

              <input 
                type="file" 
                accept="image/*" 
                capture="environment"
                onChange={handleImageChange} 
                id="camera-upload" 
                style={{ display: 'none' }}
              />
              <label htmlFor="camera-upload" className="button" style={{ 
                display: 'inline-block', padding: '1rem 2rem', backgroundColor: 'var(--primary-color)', color: 'white'
              }}>
                Use Camera
              </label>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '1rem' }}>
              {previews.map((prev, idx) => (
                <div key={idx} style={{ position: 'relative', width: '8rem', height: '8rem' }}>
                  <img src={prev} alt={`Preview ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover', border: '2px solid var(--border-color)' }} />
                  <button 
                    onClick={() => removeImage(idx)}
                    style={{ position: 'absolute', top: '-0.5rem', right: '-0.5rem', padding: '0.2rem 0.5rem', borderRadius: '50%', backgroundColor: '#e74c3c', color: 'white', border: 'none', boxShadow: 'none' }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {images.length > 0 && !transcribed && (
              <button 
                onClick={handleTranscribe} 
                disabled={loading}
                style={{ padding: '1rem 2rem', fontSize: '1.1rem', marginTop: '1rem' }}
              >
                {loading ? 'Consulting Gemini...' : `Transcribe ${images.length} Image(s)`}
              </button>
            )}
          </div>
        </div>

        {transcribed && (
          <div className="paper" style={{ animation: 'fadeIn 0.5s', marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h2>Transcribed: {transcribed.title}</h2>
              <button onClick={() => setTranscribed(null)} style={{ backgroundColor: '#f5f5f5' }}>Cancel</button>
            </div>
            
            <div className="recipe-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(20rem, 1fr))', gap: '2rem', marginTop: '1.5rem' }}>
              <div>
                <h3>Ingredients</h3>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {transcribed.ingredients.map((ing, i) => (
                    <li key={i} style={{ borderBottom: '1px dotted #ccc', padding: '0.5rem 0', display: 'flex', justifyContent: 'space-between' }}>
                      <span><strong>{ing.quantity} {ing.unit}</strong> {ing.name}</span>
                      <span style={{ fontSize: '0.7rem', color: '#999' }}>{ing.aisle}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Instructions</h3>
                <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{transcribed.instructions}</p>
                
                {transcribed.health_info && (
                  <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f9f9f9', border: '1px solid #ddd' }}>
                    <h4 style={{ margin: 0, marginBottom: '0.5rem' }}>Health & Nutrition</h4>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                      {Object.entries(transcribed.health_info).map(([key, val]) => (
                        <span key={key}><strong>{key}:</strong> {String(val)}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <button 
              onClick={handleSave} 
              style={{ marginTop: '2rem', width: '100%', padding: '1.5rem', backgroundColor: 'var(--primary-color)', color: 'white', fontSize: '1.2rem' }}
            >
              Save to My Recipe Book
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
