// Authentication routes for Carles Meatland & Farms
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Login endpoint
router.post('/login', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { username, pin } = req.body;

    // Validation
    if (!username || !pin) {
      return res.status(400).json({ error: 'Username and PIN are required' });
    }

    // Find user
    const result = await client.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Check if account is locked
    if (user.is_locked) {
      return res.status(403).json({ 
        error: 'Account is locked. Please contact an administrator.' 
      });
    }

    // Verify PIN
    const validPin = await bcrypt.compare(pin, user.pin_hash);

    if (!validPin) {
      // Increment failed attempts
      const newFailedAttempts = user.failed_attempts + 1;
      const shouldLock = newFailedAttempts >= 3;

      await client.query(
        'UPDATE users SET failed_attempts = $1, is_locked = $2 WHERE id = $3',
        [newFailedAttempts, shouldLock, user.id]
      );

      if (shouldLock) {
        return res.status(403).json({ 
          error: 'Account locked after 3 failed attempts. Contact administrator.' 
        });
      }

      return res.status(401).json({ 
        error: `Invalid PIN. ${3 - newFailedAttempts} attempt(s) remaining.` 
      });
    }

    // Successful login - reset failed attempts and update last login
    await client.query(
      'UPDATE users SET failed_attempts = 0, last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username, 
        role: user.role 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Return user info (without sensitive data)
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.full_name
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  } finally {
    client.release();
  }
});

// Change PIN endpoint
router.post('/change-pin', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { currentPin, newPin } = req.body;
    const userId = req.user.userId;

    // Validation
    if (!currentPin || !newPin) {
      return res.status(400).json({ error: 'Current PIN and new PIN are required' });
    }

    if (newPin.length < 4) {
      return res.status(400).json({ error: 'New PIN must be at least 4 digits' });
    }

    // Get user
    const result = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Verify current PIN
    const validPin = await bcrypt.compare(currentPin, user.pin_hash);

    if (!validPin) {
      return res.status(401).json({ error: 'Current PIN is incorrect' });
    }

    // Hash new PIN
    const newPinHash = await bcrypt.hash(newPin, 10);

    // Update PIN
    await client.query(
      'UPDATE users SET pin_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPinHash, userId]
    );

    res.json({ message: 'PIN changed successfully' });

  } catch (error) {
    console.error('Change PIN error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
