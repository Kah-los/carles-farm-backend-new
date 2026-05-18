// Breeding Routes
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/breeding
router.get('/', async (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = await db.query(`
      SELECT br.*, 
        m.tag as mother_tag, m.name as mother_name,
        f.tag as father_tag, f.name as father_name
      FROM breeding_records br
      JOIN animals m ON br.mother_id = m.id
      LEFT JOIN animals f ON br.father_id = f.id
      ORDER BY br.mating_date DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Get breeding records error:', error);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

// POST /api/breeding
router.post('/', [
  body('mother_id').isInt(),
  body('mating_date').isISO8601()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { mother_id, father_id, mating_date, expected_delivery, notes } = req.body;
  const db = req.app.locals.db;

  try {
    const result = await db.query(`
      INSERT INTO breeding_records (mother_id, father_id, mating_date, expected_delivery, notes)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [mother_id, father_id, mating_date, expected_delivery, notes]);

    // Update mother status to pregnant
    await db.query('UPDATE animals SET status = $1 WHERE id = $2', ['pregnant', mother_id]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create breeding record error:', error);
    res.status(500).json({ error: 'Failed to create record' });
  }
});

// PUT /api/breeding/:id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { actual_delivery, status, notes } = req.body;
  const db = req.app.locals.db;

  try {
    const result = await db.query(`
      UPDATE breeding_records SET
        actual_delivery = COALESCE($1, actual_delivery),
        status = COALESCE($2, status),
        notes = COALESCE($3, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 RETURNING *
    `, [actual_delivery, status, notes, id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update breeding record error:', error);
    res.status(500).json({ error: 'Failed to update' });
  }
});

module.exports = router;
