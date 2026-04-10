import fs from 'fs';
import path from 'path';

const DB_FILE = 'rit-ipr-data.json';

// Initialize database
function initDatabase() {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      users: [],
      patents: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    console.log('✅ JSON Database initialized successfully');
  } else {
    console.log('✅ JSON Database loaded successfully');
  }
}

// Read database
function readDB() {
  const data = fs.readFileSync(DB_FILE, 'utf8');
  return JSON.parse(data);
}

// Write database
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// User operations
export const userDb = {
  create: (name, email, hashedPassword, institution, department) => {
    const db = readDB();
    const newUser = {
      id: db.users.length + 1,
      name,
      email,
      password: hashedPassword,
      institution: institution || 'Rajalakshmi Institute of Technology',
      department,
      role: 'user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.users.push(newUser);
    writeDB(db);
    return { lastInsertRowid: newUser.id };
  },

  findByEmail: (email) => {
    const db = readDB();
    return db.users.find(u => u.email === email);
  },

  findById: (id) => {
    const db = readDB();
    const user = db.users.find(u => u.id === parseInt(id));
    if (user) {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    }
    return null;
  },

  getAll: () => {
    const db = readDB();
    return db.users.map(({ password, ...user }) => user);
  },

  getStats: (userId) => {
    const db = readDB();
    const userPatents = db.patents.filter(p => p.user_id === parseInt(userId));
    
    return {
      total_patents: userPatents.length,
      completed_patents: userPatents.filter(p => p.status === 'completed').length,
      avg_innovation_score: userPatents.length > 0 
        ? Math.round(userPatents.reduce((sum, p) => sum + (p.innovation_score || 0), 0) / userPatents.length)
        : 0,
      avg_novelty_score: userPatents.length > 0
        ? Math.round(userPatents.reduce((sum, p) => sum + (p.novelty_score || 0), 0) / userPatents.length)
        : 0,
      avg_readiness_score: userPatents.length > 0
        ? Math.round(userPatents.reduce((sum, p) => sum + (p.readiness_score || 0), 0) / userPatents.length)
        : 0
    };
  }
};

// Patent operations
export const patentDb = {
  create: (patentData) => {
    const db = readDB();
    const newPatent = {
      id: db.patents.length + 1,
      user_id: patentData.user_id,
      title: patentData.title,
      problem: patentData.problem,
      components: patentData.components,
      working: patentData.working,
      industry: patentData.industry,
      unique_features: patentData.unique_features,
      innovation_score: patentData.innovation_score,
      novelty_score: patentData.novelty_score,
      readiness_score: patentData.readiness_score,
      grant_probability: patentData.grant_probability,
      status: patentData.status || 'draft',
      analysis_data: patentData.analysis_data,
      applicant_data: patentData.applicant_data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.patents.push(newPatent);
    writeDB(db);
    return { lastInsertRowid: newPatent.id };
  },

  findById: (id, userId) => {
    const db = readDB();
    return db.patents.find(p => p.id === parseInt(id) && p.user_id === parseInt(userId));
  },

  findByUserId: (userId, limit = 20) => {
    const db = readDB();
    return db.patents
      .filter(p => p.user_id === parseInt(userId))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);
  },

  update: (id, userId, updates) => {
    const db = readDB();
    const index = db.patents.findIndex(p => p.id === parseInt(id) && p.user_id === parseInt(userId));
    if (index !== -1) {
      db.patents[index] = {
        ...db.patents[index],
        ...updates,
        updated_at: new Date().toISOString()
      };
      writeDB(db);
      return { changes: 1 };
    }
    return { changes: 0 };
  },

  delete: (id, userId) => {
    const db = readDB();
    const initialLength = db.patents.length;
    db.patents = db.patents.filter(p => !(p.id === parseInt(id) && p.user_id === parseInt(userId)));
    const changes = initialLength - db.patents.length;
    if (changes > 0) {
      writeDB(db);
    }
    return { changes };
  },

  getAll: (limit = 100) => {
    const db = readDB();
    return db.patents
      .map(p => {
        const user = db.users.find(u => u.id === p.user_id);
        return {
          ...p,
          user_name: user?.name,
          user_email: user?.email
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);
  }
};

// Initialize database
initDatabase();

export default { userDb, patentDb };
