import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase configuration missing. Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('✅ Supabase client initialized successfully');

// User operations
export const userDb = {
  create: async (name, email, hashedPassword, institution, department, role = 'faculty') => {
    try {
      // Generate UUID for the user
      const userId = uuidv4();
      
      // Create profile directly (no auth.users integration for now)
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          name,
          email,
          password: hashedPassword, // Store hashed password in profiles
          institution: institution || 'Rajalakshmi Institute of Technology',
          department,
          role
        })
        .select()
        .single();

      if (error) throw error;

      return { lastInsertRowid: data.id };
    } catch (error) {
      console.error('Create user error:', error);
      throw error;
    }
  },

  findByEmail: async (email) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
      return data;
    } catch (error) {
      console.error('Find user by email error:', error);
      return null;
    }
  },

  findById: async (id) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      console.error('Find user by ID error:', error);
      return null;
    }
  },

  getAll: async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Get all users error:', error);
      return [];
    }
  },

  getStats: async (userId) => {
    try {
      const { data: patents, error } = await supabase
        .from('patents')
        .select('innovation_score, novelty_score, readiness_score, status')
        .eq('user_id', userId);

      if (error) throw error;

      const patentCount = patents?.length || 0;
      const completedCount = patents?.filter(p => p.status === 'completed').length || 0;

      const avgScore = (field) => {
        if (patentCount === 0) return 0;
        const sum = patents.reduce((acc, p) => acc + (p[field] || 0), 0);
        return Math.round(sum / patentCount);
      };

      return {
        total_patents: patentCount,
        completed_patents: completedCount,
        avg_innovation_score: avgScore('innovation_score'),
        avg_novelty_score: avgScore('novelty_score'),
        avg_readiness_score: avgScore('readiness_score')
      };
    } catch (error) {
      console.error('Get user stats error:', error);
      return {
        total_patents: 0,
        completed_patents: 0,
        avg_innovation_score: 0,
        avg_novelty_score: 0,
        avg_readiness_score: 0
      };
    }
  }
};

// Patent operations
export const patentDb = {
  create: async (patentData) => {
    try {
      const patentId = uuidv4();
      
      const { data, error } = await supabase
        .from('patents')
        .insert({
          id: patentId,
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
          analysis_data: patentData.analysis_data || {},
          applicant_data: patentData.applicant_data || {}
        })
        .select()
        .single();

      if (error) throw error;
      return { lastInsertRowid: data.id };
    } catch (error) {
      console.error('Create patent error:', error);
      throw error;
    }
  },

  findById: async (id, userId) => {
    try {
      const { data, error } = await supabase
        .from('patents')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      console.error('Find patent by ID error:', error);
      return null;
    }
  },

  findByUserId: async (userId, limit = 20) => {
    try {
      const { data, error } = await supabase
        .from('patents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Find patents by user ID error:', error);
      return [];
    }
  },

  update: async (id, userId, updates) => {
    try {
      const { data, error } = await supabase
        .from('patents')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      return { changes: data ? 1 : 0 };
    } catch (error) {
      console.error('Update patent error:', error);
      return { changes: 0 };
    }
  },

  delete: async (id, userId) => {
    try {
      const { data, error } = await supabase
        .from('patents')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      return { changes: data ? 1 : 0 };
    } catch (error) {
      console.error('Delete patent error:', error);
      return { changes: 0 };
    }
  },

  getAll: async (limit = 100) => {
    try {
      const { data, error } = await supabase
        .from('patents')
        .select(`
          *,
          profiles!patents_user_id_fkey (
            name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Transform to match expected format
      return data?.map(patent => ({
        ...patent,
        user_name: patent.profiles?.name,
        user_email: patent.profiles?.email
      })) || [];
    } catch (error) {
      console.error('Get all patents error:', error);
      return [];
    }
  }
};

export default { userDb, patentDb };

// Submission Details operations
export const submissionDetailsDb = {
  create: async (submissionId, formsData, pdfMetadata = {}) => {
    try {
      const { data, error } = await supabase
        .from('submission_details')
        .insert({
          submission_id: submissionId,
          forms_generated: formsData.selectedForms || [],
          complete_forms_data: formsData,
          pdf_metadata: pdfMetadata
        })
        .select()
        .single();

      if (error) throw error;
      return { lastInsertRowid: data.id };
    } catch (error) {
      console.error('Create submission details error:', error);
      throw error;
    }
  },

  findBySubmission: async (submissionId) => {
    try {
      const { data, error } = await supabase
        .from('submission_details')
        .select('*')
        .eq('submission_id', submissionId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      console.error('Find submission details error:', error);
      return null;
    }
  },

  update: async (submissionId, updates) => {
    try {
      const { data, error } = await supabase
        .from('submission_details')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('submission_id', submissionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Update submission details error:', error);
      throw error;
    }
  }
};

// Admin Actions operations
export const adminActionsDb = {
  log: async (adminId, actionType, submissionId, actionData = {}, ipAddress = null, userAgent = null) => {
    try {
      const { data, error } = await supabase
        .from('admin_actions')
        .insert({
          admin_id: adminId,
          action_type: actionType,
          submission_id: submissionId,
          action_data: actionData,
          ip_address: ipAddress,
          user_agent: userAgent
        })
        .select()
        .single();

      if (error) throw error;
      return { lastInsertRowid: data.id };
    } catch (error) {
      console.error('Log admin action error:', error);
      throw error;
    }
  },

  getByAdmin: async (adminId, limit = 50) => {
    try {
      const { data, error } = await supabase
        .from('admin_actions')
        .select(`
          *,
          patent_submissions (
            id,
            forms_data,
            profiles!patent_submissions_faculty_id_fkey (name, email)
          )
        `)
        .eq('admin_id', adminId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Get admin actions error:', error);
      return [];
    }
  },

  getBySubmission: async (submissionId) => {
    try {
      const { data, error } = await supabase
        .from('admin_actions')
        .select(`
          *,
          profiles (name, email)
        `)
        .eq('submission_id', submissionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Get submission actions error:', error);
      return [];
    }
  },

  getStats: async (adminId) => {
    try {
      const { data, error } = await supabase
        .from('admin_actions')
        .select('action_type, created_at')
        .eq('admin_id', adminId);

      if (error) throw error;

      const stats = {
        total_actions: data?.length || 0,
        approvals: data?.filter(a => a.action_type === 'approve').length || 0,
        rejections: data?.filter(a => a.action_type === 'reject').length || 0,
        views: data?.filter(a => a.action_type === 'view').length || 0,
        downloads: data?.filter(a => a.action_type === 'download').length || 0
      };

      return stats;
    } catch (error) {
      console.error('Get admin stats error:', error);
      return {
        total_actions: 0,
        approvals: 0,
        rejections: 0,
        views: 0,
        downloads: 0
      };
    }
  }
};

// Patent Submission operations
export const submissionDb = {
  create: async (patentId, facultyId, formsData) => {
    try {
      const { data, error } = await supabase
        .from('patent_submissions')
        .insert({
          patent_id: patentId,
          faculty_id: facultyId,
          forms_data: formsData,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;
      return { lastInsertRowid: data.id };
    } catch (error) {
      console.error('Create submission error:', error);
      throw error;
    }
  },

  findPending: async () => {
    try {
      const { data, error } = await supabase
        .from('patent_submissions')
        .select(`
          *,
          patents (*),
          profiles!patent_submissions_faculty_id_fkey (name, email, department)
        `)
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Find pending submissions error:', error);
      return [];
    }
  },

  findByFaculty: async (facultyId) => {
    try {
      const { data, error } = await supabase
        .from('patent_submissions')
        .select(`
          *,
          patents (*),
          profiles!patent_submissions_admin_id_fkey (name)
        `)
        .eq('faculty_id', facultyId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Find faculty submissions error:', error);
      return [];
    }
  },

  updateStatus: async (submissionId, status, adminId, rejectionReason = null) => {
    try {
      const { data, error } = await supabase
        .from('patent_submissions')
        .update({
          status,
          admin_id: adminId,
          rejection_reason: rejectionReason,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', submissionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Update submission status error:', error);
      throw error;
    }
  }
};

// Notification operations
export const notificationDb = {
  create: async (userId, title, message, type = 'info') => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title,
          message,
          type
        })
        .select()
        .single();

      if (error) throw error;
      return { lastInsertRowid: data.id };
    } catch (error) {
      console.error('Create notification error:', error);
      throw error;
    }
  },

  findByUser: async (userId, limit = 20) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Find user notifications error:', error);
      return [];
    }
  },

  markAsRead: async (notificationId) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;
      return { changes: data ? 1 : 0 };
    } catch (error) {
      console.error('Mark notification as read error:', error);
      return { changes: 0 };
    }
  },

  getUnreadCount: async (userId) => {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Get unread count error:', error);
      return 0;
    }
  }
};