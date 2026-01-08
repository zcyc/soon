// 服务端 Supabase 配置
// 注意：此文件不使用 'use server'，因为它导出配置对象
// 只有纯 Server Actions 文件才需要 'use server'

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// 服务端配置
export const config = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  secretKey: process.env.SUPABASE_SECRET_KEY || '',
  bucketId: process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'videos',
  collectionsId: {
    videos: 'videos',
    reactions: 'reactions',
    activity_logs: 'activity_logs'
  }
};

/**
 * 创建服务端 Supabase 客户端（用于管理员操作）
 * 使用 Secret Key 进行管理员级别的操作
 */
export async function createAdminClient() {
  const { createClient } = await import('@supabase/supabase-js');
  
  if (!config.secretKey) {
    throw new Error('SUPABASE_SECRET_KEY is required for admin operations');
  }

  return createClient(config.url, config.secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * 创建会话客户端（使用用户 session 进行用户级别的操作）
 */
export async function createSessionClient() {
  const cookieStore = await cookies();

  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch (error) {
          // 在服务器组件中，setAll 可能是只读的
          // 这通常发生在中间件之外的地方
        }
      }
    }
  });
}

// 导出配置常量
export const COLLECTIONS = config.collectionsId;
export const BUCKET_ID = config.bucketId;
