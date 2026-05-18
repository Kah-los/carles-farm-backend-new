// Finance Routes
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/finance - Get all transactions with filters
router.get('/', async (req, res) => {
  const db = req.app.locals.db;
  const { type, start_date, end_date, category } = req.query;

  try {
    let query = `
      SELECT ft.*, u.name as recorded_by_name
      FROM financial_transactions ft
      LEFT JOIN users u ON ft.recorded_by = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (type) {
      query += ` AND ft.type = $${paramCount++}`;
      params.push(type);
    }
    if (category) {
      query += ` AND ft.category = $${paramCount++}`;
      params.push(category);
    }
    if (start_date) {
      query += ` AND ft.date >= $${paramCount++}`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND ft.date <= $${paramCount++}`;
      params.push(end_date);
    }

    query += ' ORDER BY ft.date DESC, ft.created_at DESC LIMIT 200';

    const result = await db.query(query, params);
    res.json(result.rows);

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// POST /api/finance - Create transaction
router.post('/', [
  body('type').isIn(['Income', 'Expense']),
  body('category').trim().notEmpty(),
  body('amount').isFloat({ min: 0 }),
  body('date').isISO8601()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { type, category, amount, date, description, payment_method } = req.body;
  const db = req.app.locals.db;

  try {
    const result = await db.query(`
      INSERT INTO financial_transactions (type, category, amount, date, description, payment_method, recorded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [type, category, amount, date, description, payment_method, req.user.id]);

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// GET /api/finance/summary - Financial summary with totals
router.get('/summary', async (req, res) => {
  const db = req.app.locals.db;
  const { start_date, end_date } = req.query;

  try {
    let dateFilter = '';
    const params = [];
    
    if (start_date && end_date) {
      dateFilter = 'WHERE date >= $1 AND date <= $2';
      params.push(start_date, end_date);
    }

    const result = await db.query(`
      SELECT 
        type,
        SUM(amount) as total,
        COUNT(*) as count,
        AVG(amount) as average
      FROM financial_transactions
      ${dateFilter}
      GROUP BY type
    `, params);

    const summary = {
      income: 0,
      expense: 0,
      profit: 0,
      transactionCount: 0
    };

    result.rows.forEach(row => {
      if (row.type === 'Income') {
        summary.income = parseFloat(row.total);
      } else {
        summary.expense = parseFloat(row.total);
      }
      summary.transactionCount += parseInt(row.count);
    });

    summary.profit = summary.income - summary.expense;

    res.json(summary);

  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ error: 'Failed to get summary' });
  }
});

// DELETE /api/finance/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const db = req.app.locals.db;

  try {
    const result = await db.query(
      'DELETE FROM financial_transactions WHERE id = $1 RETURNING type, amount',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ message: 'Transaction deleted' });

  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

module.exports = router;
