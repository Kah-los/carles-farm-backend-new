// Database setup script for Carles Meatland & Farms
// Creates all tables and ensures default admin user exists

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function setupDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Setting up database schema...');
    
    // Create users table
    console.log('📋 Creating users table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        pin_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'worker',
        full_name VARCHAR(100),
        is_locked BOOLEAN DEFAULT FALSE,
        failed_attempts INTEGER DEFAULT 0,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create animals table
    console.log('📋 Creating animals table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS animals (
        id SERIAL PRIMARY KEY,
        tag_number VARCHAR(50) UNIQUE NOT NULL,
        species VARCHAR(50) NOT NULL,
        breed VARCHAR(100),
        gender VARCHAR(10),
        birth_date DATE,
        acquisition_date DATE,
        status VARCHAR(20) DEFAULT 'active',
        parent_dam_id INTEGER REFERENCES animals(id),
        parent_sire_id INTEGER REFERENCES animals(id),
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create feed_ingredients table
    console.log('📋 Creating feed_ingredients table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS feed_ingredients (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        unit VARCHAR(20) DEFAULT 'kg',
        cost_per_unit DECIMAL(10,2) DEFAULT 0,
        stock_quantity DECIMAL(10,2) DEFAULT 0,
        reorder_level DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create feed_formulas table
    console.log('📋 Creating feed_formulas table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS feed_formulas (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        target_species VARCHAR(50),
        description TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create formula_items table
    console.log('📋 Creating formula_items table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS formula_items (
        id SERIAL PRIMARY KEY,
        formula_id INTEGER REFERENCES feed_formulas(id) ON DELETE CASCADE,
        ingredient_id INTEGER REFERENCES feed_ingredients(id),
        percentage DECIMAL(5,2) NOT NULL,
        UNIQUE(formula_id, ingredient_id)
      )
    `);

    // Create feeding_logs table
    console.log('📋 Creating feeding_logs table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS feeding_logs (
        id SERIAL PRIMARY KEY,
        animal_id INTEGER REFERENCES animals(id) ON DELETE CASCADE,
        formula_id INTEGER REFERENCES feed_formulas(id),
        quantity DECIMAL(10,2) NOT NULL,
        fed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        fed_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create medications table
    console.log('📋 Creating medications table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS medications (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        type VARCHAR(50),
        manufacturer VARCHAR(100),
        stock_quantity DECIMAL(10,2) DEFAULT 0,
        unit VARCHAR(20) DEFAULT 'ml',
        expiry_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create medication_dosages table
    console.log('📋 Creating medication_dosages table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS medication_dosages (
        id SERIAL PRIMARY KEY,
        medication_id INTEGER REFERENCES medications(id) ON DELETE CASCADE,
        species VARCHAR(50) NOT NULL,
        dosage_amount DECIMAL(10,2) NOT NULL,
        dosage_unit VARCHAR(20) DEFAULT 'ml',
        notes TEXT
      )
    `);

    // Create medication_logs table
    console.log('📋 Creating medication_logs table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS medication_logs (
        id SERIAL PRIMARY KEY,
        animal_id INTEGER REFERENCES animals(id) ON DELETE CASCADE,
        medication_id INTEGER REFERENCES medications(id),
        dosage DECIMAL(10,2) NOT NULL,
        administered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        next_dose_date DATE,
        reason TEXT,
        administered_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create breeding_records table
    console.log('📋 Creating breeding_records table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS breeding_records (
        id SERIAL PRIMARY KEY,
        dam_id INTEGER REFERENCES animals(id) ON DELETE CASCADE,
        sire_id INTEGER REFERENCES animals(id),
        breeding_date DATE NOT NULL,
        expected_delivery DATE,
        actual_delivery DATE,
        offspring_count INTEGER DEFAULT 0,
        notes TEXT,
        recorded_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create weight_records table
    console.log('📋 Creating weight_records table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS weight_records (
        id SERIAL PRIMARY KEY,
        animal_id INTEGER REFERENCES animals(id) ON DELETE CASCADE,
        weight DECIMAL(10,2) NOT NULL,
        measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        recorded_by INTEGER REFERENCES users(id)
      )
    `);

    // Create financial_transactions table
    console.log('📋 Creating financial_transactions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS financial_transactions (
        id SERIAL PRIMARY KEY,
        type VARCHAR(20) NOT NULL,
        category VARCHAR(50) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        description TEXT,
        transaction_date DATE DEFAULT CURRENT_DATE,
        related_animal_id INTEGER REFERENCES animals(id),
        recorded_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    console.log('📋 Creating indexes...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_animals_species ON animals(species)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_animals_status ON animals(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_feeding_logs_date ON feeding_logs(fed_at)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_medication_logs_date ON medication_logs(administered_at)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_breeding_date ON breeding_records(breeding_date)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_financial_date ON financial_transactions(transaction_date)');

    // Check if any users exist
    const userCheck = await client.query('SELECT COUNT(*) FROM users');
    const userCount = parseInt(userCheck.rows[0].count);

    if (userCount === 0) {
      console.log('👤 No users found. Creating default admin user...');
      
      const defaultPin = process.env.ADMIN_PIN || '1234';
      const defaultUsername = process.env.ADMIN_USERNAME || 'admin';
      const pinHash = await bcrypt.hash(defaultPin, 10);

      await client.query(`
        INSERT INTO users (username, pin_hash, role, full_name)
        VALUES ($1, $2, 'admin', 'Administrator')
      `, [defaultUsername, pinHash]);

      console.log('✅ Default admin user created');
      console.log('🔐 ADMIN CREDENTIALS:');
      console.log(`   Username: ${defaultUsername}`);
      console.log(`   PIN: ${defaultPin}`);
      console.log('');
      console.log('⚠️  IMPORTANT: Change the admin PIN after first login!');
    } else {
      console.log(`ℹ️  ${userCount} user(s) already exist - skipping admin creation`);
    }

    // Insert initial feed ingredients if none exist
    const ingredientCheck = await client.query('SELECT COUNT(*) FROM feed_ingredients');
    const ingredientCount = parseInt(ingredientCheck.rows[0].count);

    if (ingredientCount === 0) {
      console.log('📦 Inserting initial feed ingredients...');
      
      const ingredients = [
        'Maize', 'Rice Bran', 'Wheat Bran', 'PCK', 'Soya Meal',
        'Blood Meal', 'Fish Meal', 'Methionine', 'Lysine', 'Premix',
        'Booster', 'Salt', 'Limestone', 'DCP', 'Azolla', 'Cassava/Cassava Peal'
      ];

      for (const name of ingredients) {
        await client.query(
          'INSERT INTO feed_ingredients (name, unit, cost_per_unit, stock_quantity) VALUES ($1, $2, $3, $4)',
          [name, 'kg', 0, 0]
        );
      }

      console.log('✅ Feed ingredients inserted');
    }

    console.log('✨ Database setup completed successfully!');
    console.log('');

  } catch (error) {
    console.error('❌ Database setup error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run setup
setupDatabase()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
