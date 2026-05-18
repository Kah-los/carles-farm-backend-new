// Medication Routes
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/medications
router.get('/', async (req, res) => {
  const db = req.app.locals.db;
  try {
    const meds = await db.query('SELECT * FROM medications ORDER BY name');
    for (let med of meds.rows) {
      const dosages = await db.query('SELECT * FROM medication_dosages WHERE medication_id = $1', [med.id]);
      med.dosages = dosages.rows;
    }
    res.json(meds.rows);
  } catch (error) {
    console.error('Get medications error:', error);
    res.status(500).json({ error: 'Failed to fetch medications' });
  }
});

// POST /api/medications
router.post('/', [body('name').trim().notEmpty()], async (req, res) => {
  const { name, type, stock_quantity, unit, cost_per_unit, expiry_date, dosages } = req.body;
  const db = req.app.locals.db;
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    const med = await client.query(`
      INSERT INTO medications (name, type, stock_quantity, unit, cost_per_unit, expiry_date)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [name, type, stock_quantity || 0, unit || 'vial', cost_per_unit, expiry_date]);

    if (dosages && dosages.length > 0) {
      for (const d of dosages) {
        await client.query(`
          INSERT INTO medication_dosages (medication_id, species, dosage, route)
          VALUES ($1, $2, $3, $4)
        `, [med.rows[0].id, d.species, d.dosage, d.route]);
      }
    }

    await client.query('COMMIT');
    res.status(201).json(med.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create medication error:', error);
    res.status(500).json({ error: 'Failed to create medication' });
  } finally {
    client.release();
  }
});

// PUT /api/medications/:id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, type, stock_quantity, unit, cost_per_unit, expiry_date } = req.body;
  const db = req.app.locals.db;

  try {
    const result = await db.query(`
      UPDATE medications SET
        name = COALESCE($1, name),
        type = COALESCE($2, type),
        stock_quantity = COALESCE($3, stock_quantity),
        unit = COALESCE($4, unit),
        cost_per_unit = COALESCE($5, cost_per_unit),
        expiry_date = COALESCE($6, expiry_date),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 RETURNING *
    `, [name, type, stock_quantity, unit, cost_per_unit, expiry_date, id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update medication error:', error);
    res.status(500).json({ error: 'Failed to update medication' });
  }
});

// DELETE /api/medications/:id
router.delete('/:id', async (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = await db.query('DELETE FROM medications WHERE id = $1 RETURNING name', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (error) {
    console.error('Delete medication error:', error);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// GET /api/medications/logs
router.get('/logs', async (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = await db.query(`
      SELECT ml.*, a.tag, a.name as animal_name, m.name as medication_name, u.name as administered_by_name
      FROM medication_logs ml
      JOIN animals a ON ml.animal_id = a.id
      JOIN medications m ON ml.medication_id = m.id
      LEFT JOIN users u ON ml.administered_by = u.id
      ORDER BY ml.administered_at DESC LIMIT 100
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Get medication logs error:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// POST /api/medications/logs
router.post('/logs', [
  body('animal_id').isInt(),
  body('medication_id').isInt(),
  body('dosage').trim().notEmpty(),
  body('administered_at').isISO8601()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { animal_id, medication_id, dosage, administered_at, veterinarian, diagnosis, notes } = req.body;
  const db = req.app.locals.db;

  try {
    const result = await db.query(`
      INSERT INTO medication_logs (animal_id, medication_id, dosage, administered_at, administered_by, veterinarian, diagnosis, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `, [animal_id, medication_id, dosage, administered_at, req.user.id, veterinarian, diagnosis, notes]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create medication log error:', error);
    res.status(500).json({ error: 'Failed to log medication' });
  }
});

module.exports = router;
