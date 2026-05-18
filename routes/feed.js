// Feed Management Routes
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// ═══════════════════════════════════════════════════════
// FEED INGREDIENTS
// ═══════════════════════════════════════════════════════

// GET /api/feed/ingredients
router.get('/ingredients', async (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = await db.query('SELECT * FROM feed_ingredients ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Get ingredients error:', error);
    res.status(500).json({ error: 'Failed to fetch ingredients' });
  }
});

// POST /api/feed/ingredients
router.post('/ingredients', [
  body('name').trim().notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, stock_quantity, unit, cost_per_unit, supplier } = req.body;
  const db = req.app.locals.db;

  try {
    const result = await db.query(`
      INSERT INTO feed_ingredients (name, stock_quantity, unit, cost_per_unit, supplier)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [name, stock_quantity || 0, unit || 'kg', cost_per_unit, supplier]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create ingredient error:', error);
    res.status(500).json({ error: 'Failed to create ingredient' });
  }
});

// PUT /api/feed/ingredients/:id
router.put('/ingredients/:id', async (req, res) => {
  const { id } = req.params;
  const { name, stock_quantity, unit, cost_per_unit, supplier } = req.body;
  const db = req.app.locals.db;

  try {
    const result = await db.query(`
      UPDATE feed_ingredients 
      SET name = COALESCE($1, name),
          stock_quantity = COALESCE($2, stock_quantity),
          unit = COALESCE($3, unit),
          cost_per_unit = COALESCE($4, cost_per_unit),
          supplier = COALESCE($5, supplier),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `, [name, stock_quantity, unit, cost_per_unit, supplier, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ingredient not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update ingredient error:', error);
    res.status(500).json({ error: 'Failed to update ingredient' });
  }
});

// DELETE /api/feed/ingredients/:id
router.delete('/ingredients/:id', async (req, res) => {
  const { id } = req.params;
  const db = req.app.locals.db;

  try {
    const result = await db.query('DELETE FROM feed_ingredients WHERE id = $1 RETURNING name', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ingredient not found' });
    }
    res.json({ message: 'Ingredient deleted' });
  } catch (error) {
    console.error('Delete ingredient error:', error);
    res.status(500).json({ error: 'Failed to delete ingredient' });
  }
});

// ═══════════════════════════════════════════════════════
// FEED FORMULAS
// ═══════════════════════════════════════════════════════

// GET /api/feed/formulas
router.get('/formulas', async (req, res) => {
  const db = req.app.locals.db;

  try {
    const formulas = await db.query('SELECT * FROM feed_formulas ORDER BY name');
    
    // Get items for each formula
    for (let formula of formulas.rows) {
      const items = await db.query(`
        SELECT fi.*, i.name as ingredient_name
        FROM formula_items fi
        JOIN feed_ingredients i ON fi.ingredient_id = i.id
        WHERE fi.formula_id = $1
      `, [formula.id]);
      formula.items = items.rows;
    }

    res.json(formulas.rows);
  } catch (error) {
    console.error('Get formulas error:', error);
    res.status(500).json({ error: 'Failed to fetch formulas' });
  }
});

// POST /api/feed/formulas
router.post('/formulas', [
  body('name').trim().notEmpty(),
  body('items').isArray({ min: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, species, description, items } = req.body;
  const db = req.app.locals.db;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Create formula
    const formula = await client.query(`
      INSERT INTO feed_formulas (name, species, description)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [name, species, description]);

    const formulaId = formula.rows[0].id;

    // Add items
    for (const item of items) {
      await client.query(`
        INSERT INTO formula_items (formula_id, ingredient_id, quantity, unit)
        VALUES ($1, $2, $3, $4)
      `, [formulaId, item.ingredient_id, item.quantity, item.unit || 'kg']);
    }

    await client.query('COMMIT');
    res.status(201).json(formula.rows[0]);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create formula error:', error);
    res.status(500).json({ error: 'Failed to create formula' });
  } finally {
    client.release();
  }
});

// DELETE /api/feed/formulas/:id
router.delete('/formulas/:id', async (req, res) => {
  const { id } = req.params;
  const db = req.app.locals.db;

  try {
    const result = await db.query('DELETE FROM feed_formulas WHERE id = $1 RETURNING name', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Formula not found' });
    }
    res.json({ message: 'Formula deleted' });
  } catch (error) {
    console.error('Delete formula error:', error);
    res.status(500).json({ error: 'Failed to delete formula' });
  }
});

// ═══════════════════════════════════════════════════════
// FEEDING LOGS
// ═══════════════════════════════════════════════════════

// GET /api/feed/logs
router.get('/logs', async (req, res) => {
  const db = req.app.locals.db;
  const { animal_id, start_date, end_date } = req.query;

  try {
    let query = `
      SELECT fl.*, a.tag, a.name as animal_name, ff.name as formula_name, u.name as fed_by_name
      FROM feeding_logs fl
      JOIN animals a ON fl.animal_id = a.id
      LEFT JOIN feed_formulas ff ON fl.formula_id = ff.id
      LEFT JOIN users u ON fl.fed_by = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (animal_id) {
      query += ` AND fl.animal_id = $${paramCount++}`;
      params.push(animal_id);
    }
    if (start_date) {
      query += ` AND fl.fed_at >= $${paramCount++}`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND fl.fed_at <= $${paramCount++}`;
      params.push(end_date);
    }

    query += ' ORDER BY fl.fed_at DESC LIMIT 100';

    const result = await db.query(query, params);
    res.json(result.rows);

  } catch (error) {
    console.error('Get feeding logs error:', error);
    res.status(500).json({ error: 'Failed to fetch feeding logs' });
  }
});

// POST /api/feed/logs
router.post('/logs', [
  body('animal_id').isInt(),
  body('quantity').isFloat({ min: 0 }),
  body('fed_at').isISO8601()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { animal_id, formula_id, quantity, unit, fed_at, notes } = req.body;
  const db = req.app.locals.db;

  try {
    const result = await db.query(`
      INSERT INTO feeding_logs (animal_id, formula_id, quantity, unit, fed_at, fed_by, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [animal_id, formula_id, quantity, unit || 'kg', fed_at, req.user.id, notes]);

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error('Create feeding log error:', error);
    res.status(500).json({ error: 'Failed to log feeding' });
  }
});

module.exports = router;
