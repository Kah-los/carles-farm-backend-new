// Reports & Analytics Routes
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// ═══════════════════════════════════════════════════════
// GET /api/reports/dashboard - Complete dashboard data
// ═══════════════════════════════════════════════════════
router.get('/dashboard', async (req, res) => {
  const db = req.app.locals.db;

  try {
    const [
      animalStats,
      speciesBreakdown,
      statusBreakdown,
      financeSummary,
      recentFeeding,
      recentMedications,
      lowStock
    ] = await Promise.all([
      // Total animals
      db.query('SELECT COUNT(*) as total, AVG(weight) as avg_weight FROM animals'),
      
      // By species
      db.query('SELECT species, COUNT(*) as count FROM animals GROUP BY species'),
      
      // By status
      db.query('SELECT status, COUNT(*) as count FROM animals GROUP BY status'),
      
      // Finance summary (last 30 days)
      db.query(`
        SELECT 
          type,
          SUM(amount) as total
        FROM financial_transactions
        WHERE date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY type
      `),
      
      // Recent feeding
      db.query(`
        SELECT COUNT(*) as count
        FROM feeding_logs
        WHERE fed_at >= CURRENT_DATE - INTERVAL '7 days'
      `),
      
      // Recent medications
      db.query(`
        SELECT COUNT(*) as count
        FROM medication_logs
        WHERE administered_at >= CURRENT_DATE - INTERVAL '7 days'
      `),
      
      // Low stock ingredients
      db.query('SELECT COUNT(*) as count FROM feed_ingredients WHERE stock_quantity < 50')
    ]);

    const finance = { income: 0, expense: 0 };
    financeSummary.rows.forEach(row => {
      if (row.type === 'Income') finance.income = parseFloat(row.total);
      else finance.expense = parseFloat(row.total);
    });

    res.json({
      animals: {
        total: parseInt(animalStats.rows[0].total),
        averageWeight: parseFloat(animalStats.rows[0].avg_weight) || 0,
        bySpecies: speciesBreakdown.rows,
        byStatus: statusBreakdown.rows
      },
      finance: {
        ...finance,
        profit: finance.income - finance.expense
      },
      activity: {
        feedingsLastWeek: parseInt(recentFeeding.rows[0].count),
        medicationsLastWeek: parseInt(recentMedications.rows[0].count),
        lowStockItems: parseInt(lowStock.rows[0].count)
      }
    });

  } catch (error) {
    console.error('Dashboard report error:', error);
    res.status(500).json({ error: 'Failed to generate dashboard' });
  }
});

// ═══════════════════════════════════════════════════════
// GET /api/reports/growth - Growth analytics
// ═══════════════════════════════════════════════════════
router.get('/growth', async (req, res) => {
  const db = req.app.locals.db;
  const { species, start_date, end_date } = req.query;

  try {
    let query = `
      SELECT 
        a.id,
        a.tag,
        a.name,
        a.species,
        wr.measured_at as date,
        wr.weight
      FROM weight_records wr
      JOIN animals a ON wr.animal_id = a.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (species) {
      query += ` AND a.species = $${paramCount++}`;
      params.push(species);
    }
    if (start_date) {
      query += ` AND wr.measured_at >= $${paramCount++}`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND wr.measured_at <= $${paramCount++}`;
      params.push(end_date);
    }

    query += ' ORDER BY a.id, wr.measured_at';

    const result = await db.query(query, params);
    res.json(result.rows);

  } catch (error) {
    console.error('Growth report error:', error);
    res.status(500).json({ error: 'Failed to generate growth report' });
  }
});

// ═══════════════════════════════════════════════════════
// GET /api/reports/feeding - Feed consumption analysis
// ═══════════════════════════════════════════════════════
router.get('/feeding', async (req, res) => {
  const db = req.app.locals.db;
  const { start_date, end_date, species } = req.query;

  try {
    let query = `
      SELECT 
        DATE(fl.fed_at) as date,
        a.species,
        ff.name as formula_name,
        SUM(fl.quantity) as total_quantity,
        COUNT(*) as feeding_count
      FROM feeding_logs fl
      JOIN animals a ON fl.animal_id = a.id
      LEFT JOIN feed_formulas ff ON fl.formula_id = ff.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (start_date) {
      query += ` AND fl.fed_at >= $${paramCount++}`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND fl.fed_at <= $${paramCount++}`;
      params.push(end_date);
    }
    if (species) {
      query += ` AND a.species = $${paramCount++}`;
      params.push(species);
    }

    query += ' GROUP BY DATE(fl.fed_at), a.species, ff.name ORDER BY date DESC';

    const result = await db.query(query, params);
    res.json(result.rows);

  } catch (error) {
    console.error('Feeding report error:', error);
    res.status(500).json({ error: 'Failed to generate feeding report' });
  }
});

// ═══════════════════════════════════════════════════════
// GET /api/reports/health - Health & medication analytics
// ═══════════════════════════════════════════════════════
router.get('/health', async (req, res) => {
  const db = req.app.locals.db;
  const { start_date, end_date } = req.query;

  try {
    let dateFilter = '';
    const params = [];
    
    if (start_date && end_date) {
      dateFilter = 'AND administered_at >= $1 AND administered_at <= $2';
      params.push(start_date, end_date);
    }

    const [medicationsByType, medicationsBySpecies, mostCommon] = await Promise.all([
      // By medication type
      db.query(`
        SELECT 
          m.type,
          COUNT(*) as count,
          COUNT(DISTINCT ml.animal_id) as animals_treated
        FROM medication_logs ml
        JOIN medications m ON ml.medication_id = m.id
        WHERE 1=1 ${dateFilter}
        GROUP BY m.type
      `, params),

      // By species
      db.query(`
        SELECT 
          a.species,
          COUNT(*) as count
        FROM medication_logs ml
        JOIN animals a ON ml.animal_id = a.id
        WHERE 1=1 ${dateFilter}
        GROUP BY a.species
      `, params),

      // Most common medications
      db.query(`
        SELECT 
          m.name,
          m.type,
          COUNT(*) as usage_count
        FROM medication_logs ml
        JOIN medications m ON ml.medication_id = m.id
        WHERE 1=1 ${dateFilter}
        GROUP BY m.id, m.name, m.type
        ORDER BY usage_count DESC
        LIMIT 10
      `, params)
    ]);

    res.json({
      byType: medicationsByType.rows,
      bySpecies: medicationsBySpecies.rows,
      mostCommon: mostCommon.rows
    });

  } catch (error) {
    console.error('Health report error:', error);
    res.status(500).json({ error: 'Failed to generate health report' });
  }
});

// ═══════════════════════════════════════════════════════
// GET /api/reports/financial - Detailed financial analysis
// ═══════════════════════════════════════════════════════
router.get('/financial', async (req, res) => {
  const db = req.app.locals.db;
  const { start_date, end_date } = req.query;

  try {
    let dateFilter = '';
    const params = [];
    
    if (start_date && end_date) {
      dateFilter = 'WHERE date >= $1 AND date <= $2';
      params.push(start_date, end_date);
    }

    const [byCategory, byMonth, summary] = await Promise.all([
      // By category
      db.query(`
        SELECT 
          type,
          category,
          SUM(amount) as total,
          COUNT(*) as count
        FROM financial_transactions
        ${dateFilter}
        GROUP BY type, category
        ORDER BY type, total DESC
      `, params),

      // Monthly breakdown
      db.query(`
        SELECT 
          TO_CHAR(date, 'YYYY-MM') as month,
          type,
          SUM(amount) as total
        FROM financial_transactions
        ${dateFilter}
        GROUP BY TO_CHAR(date, 'YYYY-MM'), type
        ORDER BY month DESC
      `, params),

      // Summary
      db.query(`
        SELECT 
          type,
          SUM(amount) as total,
          AVG(amount) as average,
          MAX(amount) as largest,
          COUNT(*) as count
        FROM financial_transactions
        ${dateFilter}
        GROUP BY type
      `, params)
    ]);

    res.json({
      byCategory: byCategory.rows,
      byMonth: byMonth.rows,
      summary: summary.rows
    });

  } catch (error) {
    console.error('Financial report error:', error);
    res.status(500).json({ error: 'Failed to generate financial report' });
  }
});

// ═══════════════════════════════════════════════════════
// GET /api/reports/inventory - Stock levels and usage
// ═══════════════════════════════════════════════════════
router.get('/inventory', async (req, res) => {
  const db = req.app.locals.db;

  try {
    const [feedStock, medStock] = await Promise.all([
      db.query(`
        SELECT 
          name,
          stock_quantity,
          unit,
          CASE 
            WHEN stock_quantity < 50 THEN 'low'
            WHEN stock_quantity < 100 THEN 'medium'
            ELSE 'good'
          END as status
        FROM feed_ingredients
        ORDER BY stock_quantity ASC
      `),

      db.query(`
        SELECT 
          name,
          type,
          stock_quantity,
          unit,
          expiry_date,
          CASE 
            WHEN stock_quantity < 5 THEN 'critical'
            WHEN stock_quantity < 10 THEN 'low'
            WHEN stock_quantity < 20 THEN 'medium'
            ELSE 'good'
          END as status
        FROM medications
        ORDER BY stock_quantity ASC
      `)
    ]);

    res.json({
      feedIngredients: feedStock.rows,
      medications: medStock.rows
    });

  } catch (error) {
    console.error('Inventory report error:', error);
    res.status(500).json({ error: 'Failed to generate inventory report' });
  }
});

module.exports = router;
