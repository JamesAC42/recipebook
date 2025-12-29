const express = require('express');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'your_gemini_api_key_here');

// Transcribe recipe images using Gemini
router.post('/transcribe', authenticateToken, upload.any(), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    // Fetch existing aisles and ingredients with their common aisles for canonicalization context
    const existingAislesRes = await db.query('SELECT DISTINCT aisle FROM ingredients WHERE aisle IS NOT NULL');
    const ingredientAisleMappingRes = await db.query(`
      SELECT DISTINCT ON (name) name, aisle 
      FROM ingredients 
      WHERE aisle IS NOT NULL 
      ORDER BY name, created_at DESC
    `);
    
    const existingAisles = existingAislesRes.rows.map(r => r.aisle).join(', ');
    const ingredientAisleContext = ingredientAisleMappingRes.rows
      .map(r => `${r.name} (${r.aisle})`)
      .join(', ');

    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const prompt = `
      Transcribe the following recipe images into a single combined JSON object with the following structure:
      {
        "title": "Recipe Name",
        "description": "Short description",
        "cuisine": "Cuisine type",
        "ingredients": [
          { "name": "Ingredient name", "quantity": "amount", "unit": "unit", "aisle": "Grocery store section/aisle" }
        ],
        "instructions": "Step by step instructions",
        "health_info": { "calories": "...", "protein": "...", "carbs": "...", "fat": "..." }
      }
      
      CRITICAL RULES FOR CANONICALIZATION:
      1. AISLES: Use a consistent set of aisles. Prefer these if they match: Produce, Dairy & Eggs, Meat & Seafood, Pantry, Bakery, Frozen, Beverages, Spices, Baking.
         - Always use "Dairy & Eggs" instead of "Dairy/Eggs" or "Dairy and Eggs".
         Existing aisles in database: ${existingAisles || 'None yet'}. Use these if they fit.
      
      2. INGREDIENT NAMES & AISLE MATCHING: Use simple, singular, lowercase names. 
         - Use "all-purpose flour" instead of "all purpose flour".
         - Use "extra-virgin olive oil" instead of "extra virgin olive oil".
         - IMPORTANT: If an ingredient already exists in the database, use its existing aisle to avoid duplicates in different sections.
         
         Existing Ingredient -> Aisle Mapping: ${ingredientAisleContext || 'None yet'}. 
         Match these names and aisles exactly if the ingredient is the same.
      
      The images might be multiple pages of the same recipe. Be as accurate as possible. If some info is missing, use null.
    `;

    const imageParts = req.files.map(file => ({
      inlineData: {
        data: file.buffer.toString('base64'),
        mimeType: file.mimetype,
      },
    }));

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();
    
    // Extract JSON from response (Gemini sometimes wraps it in markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse JSON from Gemini response');
    }
    const transcribedData = JSON.parse(jsonMatch[0]);

    res.json(transcribedData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to transcribe recipe' });
  }
});

// Save recipe
router.post('/', authenticateToken, async (req, res) => {
  const { title, description, cuisine, instructions, image_url, health_info, ingredients } = req.body;
  try {
    await db.query('BEGIN');
    
    const recipeResult = await db.query(
      'INSERT INTO recipes (title, description, cuisine, instructions, image_url, health_info) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [title, description, cuisine, instructions, image_url, health_info]
    );
    const recipeId = recipeResult.rows[0].id;

    for (const ingredient of ingredients) {
      await db.query(
        'INSERT INTO ingredients (recipe_id, name, quantity, unit, aisle) VALUES ($1, $2, $3, $4, $5)',
        [recipeId, ingredient.name, ingredient.quantity, ingredient.unit, ingredient.aisle]
      );
    }

    await db.query('COMMIT');
    res.status(201).json({ id: recipeId, message: 'Recipe saved successfully' });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to save recipe' });
  }
});

// Get all recipes with search and sort
router.get('/', authenticateToken, async (req, res) => {
  const { search, cuisine, sort } = req.query;
  let query = `
    SELECT r.*, 
    json_agg(i.*) as ingredients
    FROM recipes r
    LEFT JOIN ingredients i ON r.id = i.recipe_id
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    query += ` AND (r.title ILIKE $${params.length} OR i.name ILIKE $${params.length})`;
  }

  if (cuisine) {
    params.push(cuisine);
    query += ` AND r.cuisine = $${params.length}`;
  }

  query += ` GROUP BY r.id`;

  if (sort === 'newest') {
    query += ` ORDER BY r.created_at DESC`;
  } else if (sort === 'title') {
    query += ` ORDER BY r.title ASC`;
  }

  try {
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

module.exports = router;

