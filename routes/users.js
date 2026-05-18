// User Management Routes (Admin Portal)
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// ═══════════════════════════════════════════════════════
// GET /api/users - List all users (Admin only)
// ═══════════════════════════════════════════════════════
router.get('/', requireAdmin, async (req, res) => {
  const db = req.app.locals.db;

  try {
    const result = await db.query(`
      SELECT id, username, name, role, locked, failed_attempts, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ═══════════════════════════════════════════════════════
// POST /api/users - Create new user (Admin only)
// ═══════════════════════════════════════════════════════
router.post('/', requireAdmin, [
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('pin').isLength({ min: 4, max: 4 }).withMessage('PIN must be 4 digits'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('role').isIn(['admin', 'manager', 'worker', 'veterinarian']).withMessage('Invalid role')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, pin, name, role } = req.body;
  const db = req.app.locals.db;

  try {
    // Check if username already exists
    const existing = await db.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash PIN
    const pinHash = await bcrypt.hash(pin, 10);

    // Create user
    const result = await db.query(`
      INSERT INTO users (username, pin_hash, name, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, username, name, role, created_at
    `, [username, pinHash, name, role]);

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// ═══════════════════════════════════════════════════════
// PUT /api/users/:id - Update user (Admin only)
// ═══════════════════════════════════════════════════════
router.put('/:id', requireAdmin, [
  body('name').optional().trim().notEmpty(),
  body('role').optional().isIn(['admin', 'manager', 'worker', 'veterinarian'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { name, role } = req.body;
  const db = req.app.locals.db;

  try {
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (role) {
      updates.push(`role = $${paramCount++}`);
      values.push(role);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await db.query(`
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, username, name, role, updated_at
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ═══════════════════════════════════════════════════════
// POST /api/users/:id/reset-pin - Reset user PIN (Admin only)
// ═══════════════════════════════════════════════════════
router.post('/:id/reset-pin', requireAdmin, [
  body('newPin').isLength({ min: 4, max: 4 }).withMessage('PIN must be 4 digits')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { newPin } = req.body;
  const db = req.app.locals.db;

  try {
    const pinHash = await bcrypt.hash(newPin, 10);

    const result = await db.query(`
      UPDATE users 
      SET pin_hash = $1, locked = FALSE, failed_attempts = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, username, name
    `, [pinHash, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      message: 'PIN reset successfully',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Reset PIN error:', error);
    res.status(500).json({ error: 'Failed to reset PIN' });
  }
});

// ═══════════════════════════════════════════════════════
// POST /api/users/:id/unlock - Unlock user account (Admin only)
// ═══════════════════════════════════════════════════════
router.post('/:id/unlock', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const db = req.app.locals.db;

  try {
    const result = await db.query(`
      UPDATE users 
      SET locked = FALSE, failed_attempts = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, username, name
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      message: 'Account unlocked successfully',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Unlock account error:', error);
    res.status(500).json({ error: 'Failed to unlock account' });
  }
});

// ═══════════════════════════════════════════════════════
// DELETE /api/users/:id - Delete user (Admin only)
// ═══════════════════════════════════════════════════════
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const db = req.app.locals.db;

  try {
    // Prevent deleting yourself
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const result = await db.query(
      'DELETE FROM users WHERE id = $1 RETURNING username',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully', username: result.rows[0].username });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
