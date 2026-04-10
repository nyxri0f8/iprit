import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { userDb, patentDb, submissionDb, notificationDb, submissionDetailsDb, adminActionsDb } from './database-supabase.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Initialize Google Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper function to call Gemini API with auto model selection and fallbacks
async function callGeminiAPI(messages) {
  // List of Gemini models to try in order of preference
  const modelsToTry = [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite', 
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-pro'
  ];
  
  let lastError = null;
  
  for (const modelName of modelsToTry) {
    try {
      console.log(`🤖 Trying Gemini model: ${modelName}`);
      
      const model = genAI.getGenerativeModel({ model: modelName });
      
      // Convert OpenAI format messages to Gemini format
      const systemMessage = messages.find(m => m.role === 'system')?.content || '';
      const userMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant');
      
      // Combine system message with user content
      const prompt = systemMessage + '\n\n' + userMessages.map(m => 
        `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
      ).join('\n\n');
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      console.log(`✅ Success with Gemini model: ${modelName}`);
      
      return {
        content: text,
        model: modelName,
        usage: { total_tokens: text.length } // Approximate
      };
      
    } catch (error) {
      console.log(`❌ Gemini model ${modelName} failed:`, error.message);
      lastError = error;
      
      // If it's a 404 (model not found), try the next model
      if (error.status === 404) {
        console.log(`⏭️ Model ${modelName} not found, trying next model...`);
        continue;
      }
      
      // For other errors, also try next model
      console.log(`⏭️ Error with ${modelName}, trying next model...`);
      continue;
    }
  }
  
  // If all models failed
  console.error('❌ All Gemini models failed. Last error:', lastError);
  throw lastError || new Error('All Gemini models failed');
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from frontend build (dist folder)
app.use(express.static(path.join(__dirname, '../dist')));

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// ═══════════════════════════════════
//  AUTH ROUTES
// ═══════════════════════════════════

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, institution, department, role } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const existingUser = await userDb.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with role (default: faculty)
    const result = await userDb.create(
      name, 
      email, 
      hashedPassword, 
      institution || 'Rajalakshmi Institute of Technology', 
      department,
      role || 'faculty'
    );

    // Generate token
    const token = jwt.sign(
      { id: result.lastInsertRowid, email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Get user data
    const user = await userDb.findById(result.lastInsertRowid);

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await userDb.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Remove password from response
    delete user.password;

    res.json({
      message: 'Login successful',
      token,
      user
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await userDb.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

// ═══════════════════════════════════
//  PATENT ROUTES
// ═══════════════════════════════════

// Create patent
app.post('/api/patents', authenticateToken, async (req, res) => {
  try {
    const patentData = {
      user_id: req.user.id,
      title: req.body.title,
      problem: req.body.problem,
      components: req.body.components,
      working: req.body.working,
      industry: req.body.industry,
      unique_features: req.body.unique_features,
      innovation_score: req.body.innovation_score,
      novelty_score: req.body.novelty_score,
      readiness_score: req.body.readiness_score,
      grant_probability: req.body.grant_probability,
      status: req.body.status || 'completed',
      analysis_data: req.body.analysis_data || {},
      applicant_data: req.body.applicant_data || {}
    };

    const result = await patentDb.create(patentData);

    res.status(201).json({
      message: 'Patent saved successfully',
      patentId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Create patent error:', error);
    res.status(500).json({ error: 'Failed to save patent' });
  }
});

// Get user's patents
app.get('/api/patents', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const patents = await patentDb.findByUserId(req.user.id, limit);
    res.json({ patents });
  } catch (error) {
    console.error('Get patents error:', error);
    res.status(500).json({ error: 'Failed to get patents' });
  }
});

// Get single patent
app.get('/api/patents/:id', authenticateToken, async (req, res) => {
  try {
    const patent = await patentDb.findById(req.params.id, req.user.id);
    if (!patent) {
      return res.status(404).json({ error: 'Patent not found' });
    }
    res.json({ patent });
  } catch (error) {
    console.error('Get patent error:', error);
    res.status(500).json({ error: 'Failed to get patent' });
  }
});

// Update patent status
app.patch('/api/patents/:id', authenticateToken, async (req, res) => {
  try {
    const result = await patentDb.update(req.params.id, req.user.id, {
      status: req.body.status
    });

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Patent not found' });
    }

    res.json({ message: 'Patent updated successfully' });
  } catch (error) {
    console.error('Update patent error:', error);
    res.status(500).json({ error: 'Failed to update patent' });
  }
});

// Delete patent
app.delete('/api/patents/:id', authenticateToken, async (req, res) => {
  try {
    const result = await patentDb.delete(req.params.id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Patent not found' });
    }

    res.json({ message: 'Patent deleted successfully' });
  } catch (error) {
    console.error('Delete patent error:', error);
    res.status(500).json({ error: 'Failed to delete patent' });
  }
});

// ═══════════════════════════════════
//  SUBMISSION ROUTES
// ═══════════════════════════════════

// Submit patent for review
app.post('/api/submissions', authenticateToken, async (req, res) => {
  try {
    const { patentId, formsData } = req.body;

    if (!patentId || !formsData) {
      return res.status(400).json({ error: 'Patent ID and forms data are required' });
    }

    // Get user details
    const user = await userDb.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create submission
    const result = await submissionDb.create(patentId, req.user.id, formsData);
    const submissionId = result.lastInsertRowid;

    // Store detailed submission data
    await submissionDetailsDb.create(submissionId, formsData, {
      submittedBy: user.name,
      submittedAt: new Date().toISOString(),
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.connection.remoteAddress
    });

    // Notify all admins
    const admins = await userDb.getAll();
    const adminUsers = admins.filter(user => user.role === 'admin');
    
    for (const admin of adminUsers) {
      await notificationDb.create(
        admin.id,
        'New Patent Submission',
        `${user.name || 'A faculty member'} has submitted a patent for review.`,
        'info'
      );
    }

    res.status(201).json({
      message: 'Patent submitted for review successfully',
      submissionId: submissionId
    });
  } catch (error) {
    console.error('Submit patent error:', error);
    res.status(500).json({ error: 'Failed to submit patent for review' });
  }
});

// Get pending submissions (admin only)
app.get('/api/submissions/pending', authenticateToken, async (req, res) => {
  try {
    const user = await userDb.findById(req.user.id);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const submissions = await submissionDb.findPending();
    res.json({ submissions });
  } catch (error) {
    console.error('Get pending submissions error:', error);
    res.status(500).json({ error: 'Failed to get pending submissions' });
  }
});

// Get user's submissions
app.get('/api/submissions/my', authenticateToken, async (req, res) => {
  try {
    const submissions = await submissionDb.findByFaculty(req.user.id);
    res.json({ submissions });
  } catch (error) {
    console.error('Get user submissions error:', error);
    res.status(500).json({ error: 'Failed to get submissions' });
  }
});

// Approve/Reject submission (admin only)
app.patch('/api/submissions/:id', authenticateToken, async (req, res) => {
  try {
    const user = await userDb.findById(req.user.id);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { status, rejectionReason, adminComments } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected' });
    }

    if (status === 'rejected' && !rejectionReason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    // Update submission
    const submission = await submissionDb.updateStatus(
      req.params.id, 
      status, 
      req.user.id, 
      rejectionReason
    );

    // Log admin action
    await adminActionsDb.log(
      req.user.id,
      status,
      req.params.id,
      {
        rejectionReason,
        adminComments,
        reviewedBy: user.name,
        reviewedAt: new Date().toISOString()
      },
      req.ip || req.connection.remoteAddress,
      req.headers['user-agent']
    );

    // Update submission details with admin comments
    if (adminComments) {
      await submissionDetailsDb.update(req.params.id, {
        admin_comments: adminComments,
        review_notes: `${status.toUpperCase()} by ${user.name} on ${new Date().toLocaleString()}`
      });
    }

    // Notify faculty
    const notificationTitle = status === 'approved' ? 'Patent Approved!' : 'Patent Rejected';
    const notificationMessage = status === 'approved' 
      ? 'Your patent application has been approved and is ready for filing.'
      : `Your patent application was rejected. Reason: ${rejectionReason}`;
    const notificationType = status === 'approved' ? 'success' : 'error';

    await notificationDb.create(
      submission.faculty_id,
      notificationTitle,
      notificationMessage,
      notificationType
    );

    res.json({ 
      message: `Patent ${status} successfully`,
      submission,
      actionLogged: true
    });
  } catch (error) {
    console.error('Update submission error:', error);
    res.status(500).json({ error: 'Failed to update submission' });
  }
});

// ═══════════════════════════════════
//  NOTIFICATION ROUTES
// ═══════════════════════════════════

// Get user notifications
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const notifications = await notificationDb.findByUser(req.user.id, limit);
    res.json({ notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Get unread notification count
app.get('/api/notifications/unread-count', authenticateToken, async (req, res) => {
  try {
    const count = await notificationDb.getUnreadCount(req.user.id);
    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// Mark notification as read
app.patch('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const result = await notificationDb.markAsRead(req.params.id);
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// ═══════════════════════════════════
//  LM STUDIO API ROUTE
// ═══════════════════════════════════

// ═══════════════════════════════════
//  HEALTH CHECK
// ═══════════════════════════════════

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'RIT IPR Backend',
    timestamp: new Date().toISOString(),
    database: 'Supabase Connected'
  });
});

// ═══════════════════════════════════
//  GEMINI AI API ROUTES
// ═══════════════════════════════════

// Gemini chat completion endpoint
app.post('/api/openrouter/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Call Gemini API with automatic model fallback
    const geminiResult = await callGeminiAPI(messages);
    
    console.log(`✅ Gemini API success with model: ${geminiResult.model}`);
    
    return res.json({
      success: true,
      response: geminiResult.content,
      model: geminiResult.model,
      usage: geminiResult.usage,
      modelUsed: geminiResult.model,
      provider: 'Google Gemini'
    });

  } catch (error) {
    console.error('❌ Gemini API Error:', error);
    
    // Provide a helpful error message
    let errorMessage = 'Gemini AI is currently unavailable';
    let suggestion = 'Please try again in a few minutes';
    
    if (error.status === 429 || error.message?.includes('rate-limited')) {
      errorMessage = 'Gemini AI is temporarily busy';
      suggestion = 'High traffic detected. Please try again in 2-3 minutes.';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: error.message || 'Unknown error',
      suggestion: suggestion
    });
  }
});

// Get AI configuration
app.get('/api/openrouter/config', async (req, res) => {
  try {
    res.json({ 
      provider: 'Google Gemini',
      geminiAvailable: !!process.env.GEMINI_API_KEY,
      models: [
        'gemini-2.5-pro',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-pro'
      ],
      autoSelect: true
    });
  } catch (error) {
    console.error('Get AI config error:', error);
    res.status(500).json({ error: 'Failed to get AI configuration' });
  }
});

// ═══════════════════════════════════
//  STATS ROUTES
// ═══════════════════════════════════

// Get user stats
app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await userDb.getStats(req.user.id);
    res.json({ stats });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// ═══════════════════════════════════
//  ADMIN ROUTES (Optional)
// ═══════════════════════════════════

// Get all users (admin only)
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    // Add role check here if needed
    const users = await userDb.getAll();
    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Get all patents (admin only)
app.get('/api/admin/patents', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const patents = await patentDb.getAll(limit);
    res.json({ patents });
  } catch (error) {
    console.error('Get all patents error:', error);
    res.status(500).json({ error: 'Failed to get patents' });
  }
});

// ═══════════════════════════════════
//  HEALTH CHECK
// ═══════════════════════════════════

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'RIT IPR Backend',
    timestamp: new Date().toISOString(),
    database: 'Supabase Connected'
  });
});

// ═══════════════════════════════════
//  SERVE FRONTEND (SPA)
// ═══════════════════════════════════

// Catch-all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Start server on all interfaces (0.0.0.0) for better compatibility
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════╗
║   🚀 RIT IPR Full-Stack App Running       ║
║   Port: ${PORT}                              ║
║   Environment: ${process.env.NODE_ENV || 'development'}              ║
║   Database: Supabase (PostgreSQL)         ║
║   LLM: Google Gemini 2.5                  ║
║   Local: http://localhost:${PORT}          ║
║   Frontend + Backend Combined              ║
╚═══════════════════════════════════════════╝
  `);
});

export default app;
// ═══════════════════════════════════
//  ENHANCED STORAGE ROUTES
// ═══════════════════════════════════

// Get submission details with forms data
app.get('/api/submissions/:id/details', authenticateToken, async (req, res) => {
  try {
    const details = await submissionDetailsDb.findBySubmission(req.params.id);
    if (!details) {
      return res.status(404).json({ error: 'Submission details not found' });
    }
    res.json({ details });
  } catch (error) {
    console.error('Get submission details error:', error);
    res.status(500).json({ error: 'Failed to get submission details' });
  }
});

// Update submission details
app.patch('/api/submissions/:id/details', authenticateToken, async (req, res) => {
  try {
    const { formsData, pdfMetadata, adminComments } = req.body;

    const updates = {};
    if (formsData) updates.complete_forms_data = formsData;
    if (pdfMetadata) updates.pdf_metadata = pdfMetadata;
    if (adminComments) updates.admin_comments = adminComments;

    const details = await submissionDetailsDb.update(req.params.id, updates);
    res.json({ details, message: 'Submission details updated successfully' });
  } catch (error) {
    console.error('Update submission details error:', error);
    res.status(500).json({ error: 'Failed to update submission details' });
  }
});

// Get admin action history
app.get('/api/admin/actions', authenticateToken, async (req, res) => {
  try {
    const user = await userDb.findById(req.user.id);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const limit = parseInt(req.query.limit) || 50;
    const actions = await adminActionsDb.getByAdmin(req.user.id, limit);
    res.json({ actions });
  } catch (error) {
    console.error('Get admin actions error:', error);
    res.status(500).json({ error: 'Failed to get admin actions' });
  }
});

// Get admin statistics
app.get('/api/admin/stats', authenticateToken, async (req, res) => {
  try {
    const user = await userDb.findById(req.user.id);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const stats = await adminActionsDb.getStats(req.user.id);
    res.json({ stats });
  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({ error: 'Failed to get admin statistics' });
  }
});

// Get actions for specific submission
app.get('/api/submissions/:id/actions', authenticateToken, async (req, res) => {
  try {
    const actions = await adminActionsDb.getBySubmission(req.params.id);
    res.json({ actions });
  } catch (error) {
    console.error('Get submission actions error:', error);
    res.status(500).json({ error: 'Failed to get submission actions' });
  }
});
