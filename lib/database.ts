// 数据库类型定义（向后兼容）
// 这些类型用于前端组件，会自动映射到 Supabase 的字段名

export interface VideoRecord {
  // Supabase 字段名（实际使用）
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  file_id: string;
  quality: string;
  user_id: string;
  user_name: string;
  duration: number;
  views: number;
  is_public: boolean;
  is_publish: boolean;
  thumbnail_url: string;
  subtitle_file_id: string | null;
  
  // 向后兼容字段名（用于前端组件）
  $id?: string;
  $createdAt?: string;
  $updatedAt?: string;
  fileId?: string;
  userId?: string;
  userName?: string;
  isPublic?: boolean;
  isPublish?: boolean;
  thumbnailUrl?: string;
  subtitleFileId?: string | null;
}

export interface VideoReaction {
  // Supabase 字段名（实际使用）
  id: string;
  created_at: string;
  video_id: string;
  user_id: string;
  user_name: string;
  emoji: string;
  
  // 向后兼容字段名（用于前端组件）
  $id?: string;
  $createdAt?: string;
  videoId?: string;
  userId?: string;
  userName?: string;
}

export type Video = VideoRecord;

// 辅助函数：将 Supabase 数据转换为兼容格式
export function mapVideoRecord(data: any): VideoRecord {
  return {
    ...data,
    // 添加向后兼容字段
    $id: data.id,
    $createdAt: data.created_at,
    $updatedAt: data.updated_at,
    fileId: data.file_id,
    userId: data.user_id,
    userName: data.user_name,
    isPublic: data.is_public,
    isPublish: data.is_publish,
    thumbnailUrl: data.thumbnail_url,
    subtitleFileId: data.subtitle_file_id
  };
}

// 辅助函数：将 Supabase 反应数据转换为兼容格式
export function mapVideoReaction(data: any): VideoReaction {
  return {
    ...data,
    // 添加向后兼容字段
    $id: data.id,
    $createdAt: data.created_at,
    videoId: data.video_id,
    userId: data.user_id,
    userName: data.user_name
  };
}

export class DatabaseService {
  static async createVideoRecord() {
    throw new Error('DatabaseService has been migrated to Server Actions. Use server-database.ts functions instead.');
  }
  
  static async getUserVideos() {
    throw new Error('DatabaseService has been migrated to Server Actions. Use server-database.ts functions instead.');
  }
  
  static async getVideoById() {
    throw new Error('DatabaseService has been migrated to Server Actions. Use server-database.ts functions instead.');
  }
}
