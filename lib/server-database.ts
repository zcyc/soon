'use server';

import { createAdminClient, createSessionClient, config } from './supabase-server';

export interface VideoRecord {
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
}

export interface VideoReaction {
  id: string;
  created_at: string;
  video_id: string;
  user_id: string;
  user_name: string;
  emoji: string;
}

export type Video = VideoRecord;

// Video management functions
export async function createVideoRecord(video: Omit<VideoRecord, 'id' | 'created_at' | 'updated_at' | 'views' | 'is_publish'> & { is_publish?: boolean }) {
  try {
    const supabase = await createAdminClient();
    
    const videoData = {
      title: video.title,
      file_id: video.file_id,
      quality: video.quality,
      user_id: video.user_id,
      user_name: video.user_name,
      duration: video.duration,
      views: 0,
      is_public: video.is_public,
      is_publish: video.is_publish ?? false,
      thumbnail_url: video.thumbnail_url,
      subtitle_file_id: video.subtitle_file_id || null
    };
    
    console.log('Attempting to create video record with data:', videoData);
    
    const { data, error } = await supabase
      .from(config.collectionsId.videos)
      .insert(videoData)
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('Successfully created video record:', data);
    return data as VideoRecord;
  } catch (error: any) {
    console.error('Failed to create video record. Error details:', {
      error: error,
      message: error.message,
      code: error.code,
      video: video
    });
    throw error;
  }
}

export async function getUserVideos(userId: string) {
  try {
    const supabase = await createAdminClient();
    
    const { data, error } = await supabase
      .from(config.collectionsId.videos)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return (data || []) as VideoRecord[];
  } catch (error) {
    console.error('Failed to fetch user videos:', error);
    throw error;
  }
}

export async function getVideoById(videoId: string) {
  try {
    const supabase = await createAdminClient();
    
    const { data, error } = await supabase
      .from(config.collectionsId.videos)
      .select('*')
      .eq('id', videoId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('Video not found or no longer available.');
      }
      throw error;
    }
    
    return data as VideoRecord;
  } catch (error: any) {
    console.error('Failed to fetch video:', error);
    
    if (error.message?.includes('not found')) {
      throw new Error('Video not found or no longer available.');
    }
    
    throw error;
  }
}

export async function updateVideo(videoId: string, updates: Partial<VideoRecord>) {
  try {
    const supabase = await createAdminClient();
    
    const { data, error } = await supabase
      .from(config.collectionsId.videos)
      .update(updates)
      .eq('id', videoId)
      .select()
      .single();
    
    if (error) throw error;
    return data as VideoRecord;
  } catch (error) {
    console.error('Failed to update video:', error);
    throw error;
  }
}

export async function toggleVideoPrivacy(videoId: string, userId: string) {
  try {
    // First verify the user owns this video
    const video = await getVideoById(videoId);
    if (video.user_id !== userId) {
      throw new Error('Unauthorized: You can only modify your own videos');
    }

    const newIsPublic = !video.is_public;
    
    // Update the video privacy setting
    await updateVideo(videoId, { is_public: newIsPublic });

    // Return the updated video record
    return await getVideoById(videoId);
  } catch (error: any) {
    console.error('Failed to toggle video privacy:', error);
    
    if (error.message?.includes('Unauthorized')) {
      throw new Error('You do not have permission to modify this video');
    }
    
    if (error.message?.includes('not found')) {
      throw new Error('Video not found');
    }
    
    throw new Error(error.message || 'Failed to update privacy setting');
  }
}

export async function toggleVideoPublishStatus(videoId: string, userId: string) {
  try {
    // First verify the user owns this video
    const video = await getVideoById(videoId);
    if (video.user_id !== userId) {
      throw new Error('Unauthorized: You can only modify your own videos');
    }

    const newIsPublish = !video.is_publish;
    
    // Update the video publish status
    await updateVideo(videoId, { is_publish: newIsPublish });

    // Return the updated video record
    return await getVideoById(videoId);
  } catch (error: any) {
    console.error('Failed to toggle video publish status:', error);
    
    if (error.message?.includes('Unauthorized')) {
      throw new Error('You do not have permission to modify this video');
    }
    
    if (error.message?.includes('not found')) {
      throw new Error('Video not found');
    }
    
    throw new Error(error.message || 'Failed to update publish status');
  }
}

export async function deleteVideo(videoId: string, fileId?: string) {
  let storageDeleteSuccess = true;
  let thumbnailDeleteSuccess = true;
  
  try {
    const supabase = await createAdminClient();
    
    // First verify the video exists and get its details
    const video = await getVideoById(videoId);
    console.log('Video to delete:', { videoId, fileId, video });
    
    // Delete thumbnail if exists
    if (video.thumbnail_url) {
      try {
        const { ThumbnailService } = await import('@/lib/thumbnail-service');
        await ThumbnailService.deleteThumbnailOnVideoDelete(video.thumbnail_url);
        console.log('Successfully deleted thumbnail:', video.thumbnail_url);
      } catch (thumbnailError: any) {
        thumbnailDeleteSuccess = false;
        console.error('Failed to delete thumbnail:', thumbnailError);
      }
    }
    
    // Try to delete the file from storage first
    if (fileId) {
      try {
        const { error: storageError } = await supabase.storage
          .from(config.bucketId)
          .remove([fileId]);
        
        if (storageError) throw storageError;
        console.log('Successfully deleted file from storage:', fileId);
      } catch (storageError: any) {
        storageDeleteSuccess = false;
        console.error('Failed to delete file from storage:', storageError);
      }
    }
    
    // Delete the database record
    const { error } = await supabase
      .from(config.collectionsId.videos)
      .delete()
      .eq('id', videoId);
    
    if (error) throw error;
    
    console.log('Successfully deleted video record:', videoId);
    
    const allSuccess = storageDeleteSuccess && thumbnailDeleteSuccess;
    let message = '视频删除成功！';
    
    if (!allSuccess) {
      const issues = [];
      if (!storageDeleteSuccess) issues.push('文件删除遇到问题');
      if (!thumbnailDeleteSuccess) issues.push('缩略图删除遇到问题');
      message = `视频已从列表中删除（${issues.join('，')}）`;
    }
    
    return { 
      success: true, 
      storageDeleteSuccess,
      thumbnailDeleteSuccess,
      message
    };
  } catch (error: any) {
    console.error('Failed to delete video:', error);
    
    if (error.message?.includes('Unauthorized')) {
      throw new Error('您没有权限删除此视频。只有视频作者可以删除自己的视频。');
    } else if (error.message?.includes('not found')) {
      throw new Error('视频不存在或已被删除。');
    } else {
      throw new Error(`删除视频失败: ${error.message || '未知错误'}`);
    }
  }
}

export async function incrementViews(videoId: string) {
  try {
    // First check if video exists and is accessible
    const video = await getVideoById(videoId);
    
    // Only increment views for public videos
    if (video.is_public) {
      try {
        await updateVideo(videoId, { views: video.views + 1 });
      } catch (updateError: any) {
        console.info('Unable to increment views:', updateError);
        // Fail silently for view counting failures
        return;
      }
    }
  } catch (error: any) {
    console.error('Failed to increment views:', error);
    // Don't throw error for view tracking failures
  }
}

// Reactions management
export async function addReaction(videoId: string, userId: string, userName: string, emoji: string) {
  try {
    const supabase = await createAdminClient();
    
    // Check if user already reacted with this emoji
    const existingReactions = await getVideoReactions(videoId);
    const existingReaction = existingReactions.find(
      r => r.user_id === userId && r.emoji === emoji
    );

    if (existingReaction) {
      // Remove existing reaction
      const { error } = await supabase
        .from(config.collectionsId.reactions)
        .delete()
        .eq('id', existingReaction.id);
      
      if (error) throw error;
      return null;
    } else {
      // Add new reaction
      const { data, error } = await supabase
        .from(config.collectionsId.reactions)
        .insert({
          video_id: videoId,
          user_id: userId,
          user_name: userName,
          emoji
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as VideoReaction;
    }
  } catch (error: any) {
    console.error('Failed to add reaction:', error);
    
    if (error.code === '42501' || error.message?.includes('permission')) {
      throw new Error('You must be logged in to react to videos.');
    }
    
    throw error;
  }
}

export async function getVideoReactions(videoId: string) {
  try {
    const supabase = await createAdminClient();
    
    const { data, error } = await supabase
      .from(config.collectionsId.reactions)
      .select('*')
      .eq('video_id', videoId)
      .order('created_at', { ascending: false });
    
    if (error) {
      // If it's a permission error, return empty array
      if (error.code === '42501' || error.message?.includes('permission')) {
        console.info('Cannot access reactions - returning empty array');
        return [];
      }
      throw error;
    }
    
    return (data || []) as VideoReaction[];
  } catch (error: any) {
    console.error('Failed to fetch reactions:', error);
    
    // If it's a permission error, return empty array
    if (error.code === '42501' || error.message?.includes('permission')) {
      console.info('Cannot access reactions - returning empty array');
      return [];
    }
    
    throw error;
  }
}

// Public videos for discovery
export async function getPublicVideos(limit = 20) {
  try {
    const supabase = await createAdminClient();
    
    const { data, error } = await supabase
      .from(config.collectionsId.videos)
      .select('*')
      .eq('is_public', true)
      .eq('is_publish', true)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    return (data || []) as VideoRecord[];
  } catch (error) {
    console.error('Failed to fetch public videos:', error);
    throw error;
  }
}

// Thumbnail management
export async function updateVideoThumbnail(videoId: string, thumbnailUrl: string, userId: string) {
  try {
    // Verify the user owns this video
    const video = await getVideoById(videoId);
    if (video.user_id !== userId) {
      throw new Error('Unauthorized: You can only update your own videos');
    }

    const response = await updateVideo(videoId, { thumbnail_url: thumbnailUrl });
    return response;
  } catch (error) {
    console.error('Failed to update video thumbnail:', error);
    throw error;
  }
}

// Upload file to storage
export async function uploadFile(file: File, bucketId?: string) {
  try {
    const supabase = await createAdminClient();
    
    // Generate unique file name
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = fileName;
    
    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const { data, error } = await supabase.storage
      .from(bucketId || config.bucketId)
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        upsert: false
      });
    
    if (error) throw error;
    
    return {
      $id: data.path, // 使用 path 作为 ID
      name: fileName,
      path: data.path
    };
  } catch (error) {
    console.error('Failed to upload file:', error);
    throw error;
  }
}

// Delete file from storage
export async function deleteFile(fileId: string, bucketId?: string) {
  try {
    const supabase = await createAdminClient();
    
    const { error } = await supabase.storage
      .from(bucketId || config.bucketId)
      .remove([fileId]);
    
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    console.error('Failed to delete file:', error);
    throw error;
  }
}

// Get file URL
export async function getFileUrl(fileId: string, bucketId?: string) {
  const supabase = await createAdminClient();
  
  const { data } = supabase.storage
    .from(bucketId || config.bucketId)
    .getPublicUrl(fileId);
  
  return data.publicUrl;
}
