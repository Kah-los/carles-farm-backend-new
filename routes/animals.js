// Animal Management Routes
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// ═══════════════════════════════════════════════════════
// GET /api/animals - List all animals with filters
// ═══════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  const db = req.app.locals.db;
  const { species, status, pen } = req.query;

  try {
    let query = 'SELECT * FROM animals WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (species) {
      query += ` AND species = $${paramCount++}`;
      params.push(species);
    }
    if (status) {
      query += ` AND status = $${paramCount++}`;
      params.push(status);
    }
    if (pen) {
      query += ` AND pen = $${paramCount++}`;
      params.push(pen);
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);

  } catch (error) {
    console.error('Get animals error:', error);
    res.status(500).json({ error: 'Failed to fetch animals' });
  }
});

// ═══════════════════════════════════════════════════════
// GET /api/animals/:id - Get single animal with details
// ═══════════════════════════════════════════════════════
router.get('/:id', async (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;

  try {
    const animal = await db.query('SELECT * FROM animals WHERE id = $1', [id]);
    
    if (animal.rows.length === 0) {
      return res.status(404).json({ error: 'Animal not found' });
    }

    // Get related data
    const [feeding, medications, weights, breeding] = await Promise.all([
      db.query('SELECT * FROM feeding_logs WHERE animal_id = $1 ORDER BY fed_at DESC LIMIT 10', [id]),
      db.query('SELECT * FROM medication_logs WHERE animal_id = $1 ORDER BY administered_at DESC LIMIT 10', [id]),
      db.query('SELECT * FROM weight_records WHERE animal_id = $1 ORDER BY measured_at DESC LIMIT 10', [id]),
      db.query('SELECT * FROM breeding_records WHERE mother_id = $1 OR father_id = $1 ORDER BY created_at DESC LIMIT 5', [id])
    ]);

    res.json({
      ...animal.rows[0],
      feedingHistory: feeding.rows,
      medicationHistory: medications.rows,
      weightHistory: weights.rows,
      breedingHistory: breeding.rows
    });

  } catch (error) {
    console.error('Get animal error:', error);
    res.status(500).json({ error: 'Failed to fetch animal' });
  }
});

// ═══════════════════════════════════════════════════════
// POST /api/animals - Create new animal
// ═══════════════════════════════════════════════════════
router.post('/', [
  body('tag').trim().notEmpty().withMessage('Tag is required'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('species').trim().notEmpty().withMessage('Species is required'),
  body('sex').optional().isIn(['Male', 'Female'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { tag, name, species, breed, date_of_birth, sex, weight, pen, source, notes } = req.body;
  const db = req.app.locals.db;

  try {
    // Check if tag already exists
    const existing = await db.query('SELECT id FROM animals WHERE tag = $1', [tag]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Tag already exists' });
    }

    const result = await db.query(`
      INSERT INTO animals (tag, name, species, breed, date_of_birth, sex, weight, pen, source, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [tag, name, species, breed, date_of_birth, sex, weight, pen, source, notes]);

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error('Create animal error:', error);
    res.status(500).json({ error: 'Failed to create animal' });
  }
});

// ═══════════════════════════════════════════════════════
// PUT /api/animals/:id - Update animal
// ═══════════════════════════════════════════════════════
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, breed, weight, pen, status, notes } = req.body;
  const db = req.app.locals.db;

  try {
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name) { updates.push(`name = $${paramCount++}`); values.push(name); }
    if (breed) { updates.push(`breed = $${paramCount++}`); values.push(breed); }
    if (weight) { updates.push(`weight = $${paramCount++}`); values.push(weight); }
    if (pen) { updates.push(`pen = $${paramCount++}`); values.push(pen); }
    if (status) { updates.push(`status = $${paramCount++}`); values.push(status); }
    if (notes !== undefined) { updates.push(`notes = $${paramCount++}`); values.push(notes); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await db.query(`
      UPDATE animals SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Animal not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Update animal error:', error);
    res.status(500).json({ error: 'Failed to update animal' });
  }
});

// ═══════════════════════════════════════════════════════
// DELETE /api/animals/:id - Delete animal
// ═══════════════════════════════════════════════════════
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const db = req.app.locals.db;

  try {
    const result = await db.query(
      'DELETE FROM animals WHERE id = $1 RETURNING tag, name',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Animal not found' });
    }

    res.json({ message: 'Animal deleted successfully', animal: result.rows[0] });

  } catch (error) {
    console.error('Delete animal error:', error);
    res.status(500).json({ error: 'Failed to delete animal' });
  }
});

// ═══════════════════════════════════════════════════════
// POST /api/animals/:id/weight - Record weight
// ═══════════════════════════════════════════════════════
router.post('/:id/weight', [
  body('weight').isFloat({ min: 0 }).withMessage('Valid weight required'),
  body('measured_at').isISO8601().withMessage('Valid date required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { weight, measured_at, notes } = req.body;
  const db = req.app.locals.db;

  try {
    // Update animal's current weight
    await db.query('UPDATE animals SET weight = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [weight, id]);

    // Record weight history
    const result = await db.query(`
      INSERT INTO weight_records (animal_id, weight, measured_at, measured_by, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [id, weight, measured_at, req.user.id, notes]);

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error('Record weight error:', error);
    res.status(500).json({ error: 'Failed to record weight' });
  }
});

// ═══════════════════════════════════════════════════════
// GET /api/animals/stats/summary - Get dashboard stats
// ═══════════════════════════════════════════════════════
router.get('/stats/summary', async (req, res) => {
  const db = req.app.locals.db;

  try {
    const [total, bySpecies, byStatus] = await Promise.all([
      db.query('SELECT COUNT(*) as total FROM animals'),
      db.query('SELECT species, COUNT(*) as count FROM animals GROUP BY species'),
      db.query('SELECT status, COUNT(*) as count FROM animals GROUP BY status')
    ]);

    res.json({
      total: parseInt(total.rows[0].total),
      bySpecies: bySpecies.rows,
      byStatus: byStatus.rows
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;
