// 客户端 Supabase 配置
// 此文件用于客户端组件

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}

// 配置常量（向后兼容）
export const config = {
  endpoint: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  projectId: process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0] || '',
  databaseId: 'postgres',
  bucketId: process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'videos',
  collectionsId: {
    videos: 'videos',
    reactions: 'reactions',
    activity_logs: 'activity_logs'
  }
};
