import { createSessionClient, createAdminClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * 统一的会话 cookie 设置选项
 */
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 60 * 60 * 24 * 30, // 30 days
  path: '/',
};

export interface User {
  id: string;
  name?: string;
  email?: string;
  email_verified?: boolean;
  created_at?: string;
  updated_at?: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
      // 向后兼容字段名
  $id?: string;
}

/**
 * 创建用户账户
 */
export async function createAccount(email: string, password: string, name: string): Promise<User> {
  'use server';
  
  try {
    const supabase = await createAdminClient();
    
    // 使用 Admin Client 创建用户
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // 自动确认邮箱
      user_metadata: {
        name: name
      }
    });

    if (error) throw error;

    return {
      id: data.user.id,
      email: data.user.email,
      name: data.user.user_metadata?.name || name,
      email_verified: data.user.email_confirmed_at !== null,
      created_at: data.user.created_at,
      updated_at: data.user.updated_at,
      user_metadata: data.user.user_metadata,
      app_metadata: data.user.app_metadata,
      // 向后兼容字段名
      $id: data.user.id
    };
  } catch (error: any) {
    console.error('Create account error:', error);
    throw new Error(error.message || 'Failed to create account');
  }
}

/**
 * 用户登录并创建会话
 */
export async function login(email: string, password: string) {
  'use server';
  
  try {
    const supabase = await createSessionClient();
    
    // 登录并创建会话
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    // Supabase SSR 会自动处理 cookie
    return data;
  } catch (error: any) {
    console.error('Login error:', error);
    throw new Error(error.message || 'Invalid email or password');
  }
}

/**
 * 用户登出
 */
export async function logout() {
  'use server';
  
  try {
    const supabase = await createSessionClient();
    
    // 登出
    await supabase.auth.signOut();
  } catch (error: any) {
    console.error('Logout error:', error);
  }
}

/**
 * 获取当前用户
 */
export async function getCurrentUser(): Promise<User | null> {
  'use server';
  
  try {
    const supabase = await createSessionClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email?.split('@')[0],
      email_verified: !!user.email_confirmed_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
      user_metadata: user.user_metadata,
      app_metadata: user.app_metadata,
      // 向后兼容字段名
      $id: user.id
    };
  } catch (error) {
    return null;
  }
}

/**
 * 更新用户密码
 */
export async function updatePassword(oldPassword: string, newPassword: string) {
  'use server';
  
  try {
    const supabase = await createSessionClient();
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;
  } catch (error: any) {
    console.error('Update password error:', error);
    throw new Error(error.message || 'Failed to update password');
  }
}

/**
 * 更新用户偏好设置
 */
export async function updatePreferences(prefs: Record<string, any>) {
  'use server';
  
  try {
    const supabase = await createSessionClient();
    const { data, error } = await supabase.auth.updateUser({
      data: prefs
    });

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('Update preferences error:', error);
    throw new Error(error.message || 'Failed to update preferences');
  }
}

/**
 * 创建 OAuth2 会话
 */
export async function createOAuth2Session(provider: string, success?: string, failure?: string): Promise<string> {
  'use server';
  
  try {
    const supabase = await createSessionClient();
    
    // 构建回调 URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const redirectTo = success || `${baseUrl}/oauth-complete`;
    const redirectToError = failure || `${baseUrl}/?error=oauth_failed`;
    
    // 根据 provider 选择 OAuth 提供商
    let oauthProvider: 'github' | 'google';
    switch (provider.toLowerCase()) {
      case 'github':
        oauthProvider = 'github';
        break;
      case 'google':
        oauthProvider = 'google';
        break;
      default:
        throw new Error(`Unsupported OAuth provider: ${provider}`);
    }
    
    console.log('Creating OAuth2 session for provider:', provider, {
      redirectTo,
      redirectToError
    });
    
    // 创建 OAuth URL
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: oauthProvider,
      options: {
        redirectTo: redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    });

    if (error) throw error;
    
    if (!data.url) {
      throw new Error('Failed to generate OAuth URL');
    }

    console.log('OAuth2 URL created successfully');
    return data.url;
  } catch (error: any) {
    console.error('OAuth2 session error:', error);
    throw new Error(error.message || 'Failed to create OAuth2 session');
  }
}

/**
 * 处理 OAuth 回调并建立会话
 */
export async function handleOAuthCallback(userId?: string, secret?: string): Promise<{ success: boolean; error?: string; user?: User }> {
  'use server';
  
  try {
    console.log('OAuth callback handler called');
    
    const supabase = await createSessionClient();
    
    // Supabase 会自动从 URL 参数中提取 code 并交换 token
    // 我们只需要验证用户是否已登录
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      console.error('OAuth callback: Failed to get user', error);
      return { success: false, error: 'Failed to establish session' };
    }

    console.log('OAuth callback success: Session established for user:', user.id);
    
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email?.split('@')[0],
        email_verified: !!user.email_confirmed_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
        user_metadata: user.user_metadata,
        app_metadata: user.app_metadata
      }
    };
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    return { success: false, error: error.message || 'OAuth callback failed' };
  }
}

/**
 * 从 URL 搜索参数中提取 OAuth 回调数据
 */
export async function extractOAuthCallbackData(searchParams: URLSearchParams): Promise<{ userId?: string; secret?: string; error?: string }> {
  'use server';
  
  // Supabase OAuth 使用 code 参数而不是 userId/secret
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  
  console.log('Extracted OAuth callback data:', {
    hasCode: !!code,
    error
  });
  
  return { 
    userId: code || undefined, // 使用 code 作为临时标识
    secret: code || undefined,
    error: error || undefined 
  };
}

/**
 * 验证用户会话
 */
export async function verifySession(): Promise<boolean> {
  'use server';
  
  try {
    const user = await getCurrentUser();
    return user !== null;
  } catch (error) {
    return false;
  }
}
