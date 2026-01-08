import { createAdminClient, config } from '@/lib/supabase-server';

export enum ActivityType {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
  SHARE_CREATED = 'SHARE_CREATED',
  SHARE_ACCESSED = 'SHARE_ACCESSED',
  SHARE_UPDATED = 'SHARE_UPDATED',
  SHARE_DELETED = 'SHARE_DELETED',
}

export interface ActivityLog {
  id: string;
  user_id: string; // Supabase user ID
  action: ActivityType;
  timestamp: string;
  ip_address: string;
  metadata?: string;
  user_name?: string;
  created_at: string;
  updated_at: string;
}

export interface NewActivityLog {
  user_id: string;
  action: ActivityType;
  ip_address?: string;
  metadata?: string;
}

class ActivityService {
  private readonly collectionId = config.collectionsId.activity_logs;

  async logActivity(data: NewActivityLog): Promise<ActivityLog> {
    try {
      const activityData = {
        user_id: data.user_id,
        action: data.action,
        ip_address: data.ip_address || '',
        metadata: data.metadata || null,
        timestamp: new Date().toISOString()
      };

      const supabase = await createAdminClient();
      const { data: result, error } = await supabase
        .from(this.collectionId)
        .insert(activityData)
        .select()
        .single();

      if (error) throw error;

      return result as ActivityLog;
    } catch (error) {
      console.error('Failed to log activity:', error);
      throw error;
    }
  }

  async getUserActivityLogs(userId: string, limit: number = 10): Promise<ActivityLog[]> {
    try {
      const supabase = await createAdminClient();
      const { data, error } = await supabase
        .from(this.collectionId)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []) as ActivityLog[];
    } catch (error) {
      console.error('Failed to fetch activity logs:', error);
      throw error;
    }
  }

  async getAllActivityLogs(limit: number = 50): Promise<ActivityLog[]> {
    try {
      const supabase = await createAdminClient();
      const { data, error } = await supabase
        .from(this.collectionId)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []) as ActivityLog[];
    } catch (error) {
      console.error('Failed to fetch all activity logs:', error);
      throw error;
    }
  }
}

export const activityService = new ActivityService();
