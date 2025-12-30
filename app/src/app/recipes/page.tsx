'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { formatVolumeFromMl, formatWeightFromG, getUnitInfo, parseQuantityToNumber } from '@/utils/measurements';

interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
  aisle: string;
}

interface Recipe {
  id: number;
  title: string;
  description: string;
  cuisine: string;
  instructions: string;
  health_info: Record<string, unknown> | null;
  ingredients: Ingredient[];
}

export default function RecipesPage() {
  const { isAuthenticated, token, isInitialized } = useAuth();
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState('');
  const [selectedRecipes, setSelectedRecipes] = useState<number[]>([]);
  const [showGroceryList, setShowGroceryList] = useState(false);
  const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);
  const [showRecipeSources, setShowRecipeSources] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [recipeToDelete, setRecipeToDelete] = useState<Recipe | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const showNotify = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // Handle redirection separately
  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.push('/login');
    }
  }, [isInitialized, isAuthenticated, router]);

  // Handle data fetching
  useEffect(() => {
    if (!isInitialized || !isAuthenticated || !token) return;

    const controller = new AbortController();
    
    const doFetch = async () => {
      try {
        const response = await fetch(`/recipebook/api/recipes?search=${search}`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal
        });
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        setRecipes(data);
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          showNotify('Failed to fetch recipes', 'error');
        }
      }
    };

    doFetch();

    return () => controller.abort();
  }, [isInitialized, isAuthenticated, token, search, showNotify]);

  const handleDelete = async (id: number) => {
    if (!token) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/recipebook/api/recipes/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to delete recipe');

      setRecipes(prev => prev.filter(r => r.id !== id));
      setSelectedRecipes(prev => prev.filter(rid => rid !== id));
      showNotify('Recipe deleted successfully');
      setViewingRecipe(null);
      setRecipeToDelete(null);
    } catch (err) {
      console.error(err);
      showNotify('Failed to delete recipe', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelect = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setSelectedRecipes(prev => 
      prev.includes(id) ? prev.filter(rid => rid !== id) : [...prev, id]
    );
  };

  const normalizeAisle = (aisle: string): string => {
    if (!aisle) return 'Other';
    const normalized = aisle.toLowerCase().trim()
      .replace(/\s+and\s+/g, ' & ')
      .replace(/\//g, ' & ')
      .replace(/dairy\s+&\s+eggs/g, 'Dairy & Eggs')
      .replace(/produce/g, 'Produce')
      .replace(/meat\s+&\s+seafood/g, 'Meat & Seafood')
      .replace(/pantry/g, 'Pantry')
      .replace(/bakery/g, 'Bakery')
      .replace(/frozen/g, 'Frozen')
      .replace(/beverages/g, 'Beverages')
      .replace(/spices/g, 'Spices')
      .replace(/baking/g, 'Baking');
    
    // Capitalize first letter of each word for display
    return normalized.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const normalizeIngredientName = (name: string): string => {
    if (!name) return '';
    return name.toLowerCase().trim()
      .replace(/-/g, ' ') // "all-purpose" -> "all purpose"
      .replace(/\s+/g, ' '); // remove double spaces
  };

  const generateGroceryList = () => {
    type Agg = {
      displayName: string;
      sources: Set<string>;
      countTotal: number;
      volumeMlTotal: number;
      weightGTotal: number;
      preferredVolumeUnits: Set<string>;
      preferredWeightUnits: Set<string>;
      unknownTotals: Map<string, number>;
    };

    const combined: Record<string, Record<string, { quantity: number; unit: string; aisle: string; name: string; sources: string[] }>> = {};
    const selected = recipes.filter(r => selectedRecipes.includes(r.id));

    const aggByAisle: Record<string, Record<string, Agg>> = {};

    selected.forEach(recipe => {
      recipe.ingredients.forEach(ing => {
        const aisle = normalizeAisle(ing.aisle);
        const nameKey = normalizeIngredientName(ing.name);
        if (!nameKey) return;

        const qtyNum = parseQuantityToNumber(ing.quantity);
        const unitInfo = getUnitInfo(ing.unit);

        if (!aggByAisle[aisle]) aggByAisle[aisle] = {};
        if (!aggByAisle[aisle][nameKey]) {
          aggByAisle[aisle][nameKey] = {
            displayName: (ing.name || '').trim(),
            sources: new Set<string>(),
            countTotal: 0,
            volumeMlTotal: 0,
            weightGTotal: 0,
            preferredVolumeUnits: new Set<string>(),
            preferredWeightUnits: new Set<string>(),
            unknownTotals: new Map<string, number>(),
          };
        }

        const agg = aggByAisle[aisle][nameKey];
        agg.sources.add(recipe.title);
        if (!agg.displayName) agg.displayName = (ing.name || '').trim();

        if (unitInfo.kind === 'count') {
          agg.countTotal += qtyNum;
        } else if (unitInfo.kind === 'volume') {
          agg.volumeMlTotal += qtyNum * unitInfo.toBaseFactor;
          agg.preferredVolumeUnits.add(unitInfo.canonicalUnit);
        } else if (unitInfo.kind === 'weight') {
          agg.weightGTotal += qtyNum * unitInfo.toBaseFactor;
          agg.preferredWeightUnits.add(unitInfo.canonicalUnit);
        } else {
          const key = unitInfo.prettyUnit || '';
          const prev = agg.unknownTotals.get(key) || 0;
          agg.unknownTotals.set(key, prev + qtyNum);
        }
      });
    });

    // Convert aggregated totals into display rows (one per compatible measurement type).
    for (const [aisle, byName] of Object.entries(aggByAisle)) {
      if (!combined[aisle]) combined[aisle] = {};

      const nameEntries = Object.entries(byName).sort((a, b) => a[0].localeCompare(b[0]));
      for (const [nameKey, agg] of nameEntries) {
        const sources = Array.from(agg.sources).sort((a, b) => a.localeCompare(b));
        const displayName = agg.displayName || nameKey;

        if (agg.countTotal) {
          combined[aisle][`${nameKey}|count`] = {
            quantity: agg.countTotal,
            unit: '',
            aisle,
            name: displayName,
            sources,
          };
        }

        if (agg.volumeMlTotal) {
          const { quantity, unit } = formatVolumeFromMl(agg.volumeMlTotal, agg.preferredVolumeUnits);
          combined[aisle][`${nameKey}|volume`] = {
            quantity,
            unit,
            aisle,
            name: displayName,
            sources,
          };
        }

        if (agg.weightGTotal) {
          const { quantity, unit } = formatWeightFromG(agg.weightGTotal, agg.preferredWeightUnits);
          combined[aisle][`${nameKey}|weight`] = {
            quantity,
            unit,
            aisle,
            name: displayName,
            sources,
          };
        }

        for (const [rawUnit, qty] of agg.unknownTotals.entries()) {
          const unitLabel = rawUnit;
          combined[aisle][`${nameKey}|unknown|${unitLabel || 'unitless'}`] = {
            quantity: qty,
            unit: unitLabel,
            aisle,
            name: displayName,
            sources,
          };
        }
      }
    }

    return combined;
  };

  const groceryList = generateGroceryList();

  // Group recipes by cuisine
  const recipesByCuisine = recipes.reduce((acc, recipe) => {
    const cuisine = recipe.cuisine || 'Uncategorized';
    if (!acc[cuisine]) acc[cuisine] = [];
    acc[cuisine].push(recipe);
    return acc;
  }, {} as Record<string, Recipe[]>);

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

      <div style={{ maxWidth: '70rem', margin: '0 auto', padding: '0 1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h1>My Recipe Collection</h1>
          <input 
            type="text" 
            placeholder="Search recipes..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', maxWidth: '20rem' }}
          />
        </div>

        {selectedRecipes.length > 0 && (
          <div className="paper" style={{ backgroundColor: '#fffbe6', borderColor: '#ffe58f', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <span><strong>{selectedRecipes.length}</strong> recipes selected for your grocery list</span>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={() => setSelectedRecipes([])} style={{ backgroundColor: '#f5f5f5' }}>Clear</button>
                <button onClick={() => setShowGroceryList(true)}>Generate Grocery List</button>
              </div>
            </div>
          </div>
        )}

        {Object.entries(recipesByCuisine).map(([cuisine, cuisineRecipes]) => (
          <div key={cuisine} style={{ marginBottom: '3rem' }}>
            <h2 style={{ borderBottom: '2px solid var(--primary-color)', paddingBottom: '0.5rem', marginBottom: '1.5rem', textTransform: 'capitalize' }}>
              {cuisine}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))', gap: '2rem' }}>
              {cuisineRecipes.map(recipe => (
                <div 
                  key={recipe.id} 
                  className={`paper skeuomorphic-card recipe-card ${selectedRecipes.includes(recipe.id) ? 'selected' : ''}`} 
                  onClick={() => setViewingRecipe(recipe)}
                  style={{ position: 'relative' }}
                >
                  <div 
                    style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 10 }}
                    onClick={(e) => toggleSelect(e, recipe.id)}
                  >
                    <input 
                      type="checkbox" 
                      checked={selectedRecipes.includes(recipe.id)} 
                      onChange={() => {}} // Handled by div click
                      style={{ transform: 'scale(1.5)', cursor: 'pointer' }}
                    />
                  </div>
                  <h3 style={{ margin: 0, paddingRight: '2rem' }}>{recipe.title}</h3>
                  <p style={{ fontSize: '0.85rem', marginTop: '1rem', lineBreak: 'anywhere' }}>
                    {recipe.description?.substring(0, 80)}...
                  </p>
                  <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#666' }}>{recipe.ingredients.length} ingredients</span>
                    <button style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>View Details</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Recipe Detail Modal */}
        {viewingRecipe && (
          <div className="modal-overlay" onClick={() => setViewingRecipe(null)}>
            <div className="paper modal-content" onClick={e => e.stopPropagation()} style={{ padding: '1rem 2rem 2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0rem' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => setViewingRecipe(null)}>Close</button>
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <h1 style={{ margin: 0 }}>{viewingRecipe.title}</h1>
                  <p style={{ color: '#666', textTransform: 'capitalize' }}>{viewingRecipe.cuisine} cuisine</p>
                </div>
              </div>
              
              <div className="recipe-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(20rem, 1fr))', gap: '2rem', marginTop: '2rem' }}>
                <div>
                  <h3>Ingredients</h3>
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {viewingRecipe.ingredients.map((ing, i) => (
                      <li key={i} style={{ padding: '0.5rem 0', borderBottom: '1px dotted #ccc' }}>
                        <strong>{ing.quantity} {ing.unit}</strong> {ing.name} 
                        {ing.aisle && <span style={{ fontSize: '0.7rem', color: '#999', marginLeft: '0.5rem' }}>({ing.aisle})</span>}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>Instructions</h3>
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{viewingRecipe.instructions}</p>
                  
                  {viewingRecipe.health_info && (
                    <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f9f9f9', border: '1px solid #ddd' }}>
                      <h4 style={{ margin: 0, marginBottom: '0.5rem' }}>Health & Nutrition</h4>
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                        {Object.entries(viewingRecipe.health_info).map(([key, val]) => (
                          <span key={key}><strong>{key}:</strong> {String(val)}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div style={{ marginTop: '3rem', borderTop: '0.0625rem solid #eee', paddingTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  onClick={() => setRecipeToDelete(viewingRecipe)} 
                  style={{ backgroundColor: '#fff', color: '#e74c3c', borderColor: '#e74c3c' }}
                >
                  Delete Recipe
                </button>
              </div>
            </div>
          </div>
        )}

        {recipeToDelete && (
          <div className="modal-overlay" onClick={() => setRecipeToDelete(null)} style={{ zIndex: 1100 }}>
            <div className="paper modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '30rem', padding: '2rem', textAlign: 'center' }}>
              <h2>Confirm Deletion</h2>
              <p>Are you sure you want to delete <strong>{recipeToDelete.title}</strong>? This will also remove all its ingredients from your database. This action cannot be undone.</p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
                <button onClick={() => setRecipeToDelete(null)} disabled={isDeleting} style={{ backgroundColor: '#f5f5f5' }}>Cancel</button>
                <button 
                  onClick={() => handleDelete(recipeToDelete.id)} 
                  disabled={isDeleting}
                  style={{ backgroundColor: '#e74c3c', color: 'white' }}
                >
                  {isDeleting ? 'Deleting...' : 'Yes, Delete Recipe'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showGroceryList && (
          <div className="modal-overlay" onClick={() => setShowGroceryList(false)}>
            <div className="paper modal-content" onClick={e => e.stopPropagation()} style={{ padding: '1rem 2rem 2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0rem' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button onClick={() => window.print()} style={{ backgroundColor: 'var(--secondary-color)', color: 'white' }}>Print</button>
                  <button onClick={() => setShowGroceryList(false)}>Close</button>
                </div>
                <h2 style={{ marginTop: '1rem' }}>My Grocery List</h2>
              </div>

              <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                <input 
                  type="checkbox" 
                  id="toggle-sources" 
                  checked={showRecipeSources} 
                  onChange={(e) => setShowRecipeSources(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="toggle-sources" style={{ cursor: 'pointer' }}>Show recipe sources</label>
              </div>
              
              {Object.keys(groceryList).length === 0 ? (
                <p>No ingredients found for selected recipes.</p>
              ) : (
                Object.entries(groceryList).map(([aisle, itemsMap]) => (
                  <div key={aisle} style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ borderBottom: '2px solid var(--secondary-color)', paddingBottom: '0.25rem', color: 'var(--secondary-color)' }}>{aisle}</h3>
                    <ul style={{ listStyle: 'none', marginTop: '0.5rem', padding: 0 }}>
                      {Object.entries(itemsMap).map(([itemKey, data]) => {
                        const item = data as { quantity: number; unit: string; aisle: string; name: string; sources: string[] };
                        const safeId = `item-${aisle}-${itemKey}`.replace(/[^a-zA-Z0-9_-]/g, '_');
                        return (
                        <li key={itemKey} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.5rem 0' }}>
                          <input type="checkbox" id={safeId} style={{ transform: 'scale(1.2)', marginTop: '0.2rem' }} />
                          <label htmlFor={safeId} style={{ textTransform: 'capitalize', cursor: 'pointer' }}>
                            <strong>{item.quantity > 0 ? Number(item.quantity.toFixed(2)) : ''} {item.unit}</strong> {item.name}
                            {showRecipeSources && (
                              <span style={{ fontSize: '0.8rem', color: '#888', fontStyle: 'italic', marginLeft: '0.5rem' }}>
                                ({item.sources.join(', ')})
                              </span>
                            )}
                          </label>
                        </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

