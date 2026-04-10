import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const db = new Database('rit-ipr.db');

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
function initDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      institution TEXT DEFAULT 'Rajalakshmi Institute of Technology',
      department TEXT,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Patents table
  db.exec(`
    CREATE TABLE IF NOT EXISTS patents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      problem TEXT,
      components TEXT,
      working TEXT,
      industry TEXT,
      unique_features TEXT,
      innovation_score INTEGER,
      novelty_score INTEGER,
      readiness_score INTEGER,
      grant_probability INTEGER,
      status TEXT DEFAULT 'draft',
      analysis_data TEXT,
      applicant_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_patents_user_id ON patents(user_id);
    CREATE INDEX IF NOT EXISTS idx_patents_status ON patents(status);
  `);

  console.log('✅ Database initialized successfully');
}

// User operations
export const userDb = {
  create: (name, email, hashedPassword, institution, department) => {
    const stmt = db.prepare(`
      INSERT INTO users (name, email, password, institution, department)
      VALUES (?, ?, ?, ?, ?)
    `);
    return stmt.run(name, email, hashedPassword, institution || 'Rajalakshmi Institute of Technology', department);
  },

  findByEmail: (email) => {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email);
  },

  findById: (id) => {
    const stmt = db.prepare('SELECT id, name, email, institution, department, role, created_at FROM users WHERE id = ?');
    return stmt.get(id);
  },

  getAll: () => {
    const stmt = db.prepare('SELECT id, name, email, institution, department, role, created_at FROM users ORDER BY created_at DESC');
    return stmt.all();
  },

  getStats: (userId) => {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total_patents,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_patents,
        AVG(innovation_score) as avg_innovation_score,
        AVG(novelty_score) as avg_novelty_score,
        AVG(readiness_score) as avg_readiness_score
      FROM patents 
      WHERE user_id = ?
    `);
    return stmt.get(userId);
  }
};

// Patent operations
export const patentDb = {
  create: (patentData) => {
    const stmt = db.prepare(`
      INSERT INTO patents (
        user_id, title, problem, components, working, industry, unique_features,
        innovation_score, novelty_score, readiness_score, grant_probability,
        status, analysis_data, applicant_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      patentData.user_id,
      patentData.title,
      patentData.problem,
      patentData.components,
      patentData.working,
      patentData.industry,
      patentData.unique_features,
      patentData.innovation_score,
      patentData.novelty_score,
      patentData.readiness_score,
      patentData.grant_probability,
      patentData.status || 'draft',
      JSON.stringify(patentData.analysis_data),
      JSON.stringify(patentData.applicant_data)
    );
  },

  findById: (id, userId) => {
    const stmt = db.prepare('SELECT * FROM patents WHERE id = ? AND user_id = ?');
    const patent = stmt.get(id, userId);
    if (patent) {
      patent.analysis_data = JSON.parse(patent.analysis_data);
      patent.applicant_data = JSON.parse(patent.applicant_data);
    }
    return patent;
  },

  findByUserId: (userId, limit = 20) => {
    const stmt = db.prepare(`
      SELECT * FROM patents 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    const patents = stmt.all(userId, limit);
    return patents.map(p => ({
      ...p,
      analysis_data: JSON.parse(p.analysis_data),
      applicant_data: JSON.parse(p.applicant_data)
    }));
  },

  update: (id, userId, updates) => {
    const stmt = db.prepare(`
      UPDATE patents 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `);
    return stmt.run(updates.status, id, userId);
  },

  delete: (id, userId) => {
    const stmt = db.prepare('DELETE FROM patents WHERE id = ? AND user_id = ?');
    return stmt.run(id, userId);
  },

  getAll: (limit = 100) => {
    const stmt = db.prepare(`
      SELECT p.*, u.name as user_name, u.email as user_email
      FROM patents p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  }
};

// Initialize database
initDatabase();

export default db;
