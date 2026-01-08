'use server';

import { uploadFile, createVideoRecord, getUserVideos, getPublicVideos, getVideoById, toggleVideoPrivacy, toggleVideoPublishStatus, deleteVideo, addReaction, getVideoReactions, incrementViews, updateVideoThumbnail, getFileUrl } from '@/lib/server-database';
import { mapVideoRecord, mapVideoReaction } from '@/lib/database';
import { getCurrentUser } from '@/lib/auth/server-auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export type ActionResult = {
  success?: boolean;
  error?: string;
  data?: any;
};

// Upload video file to storage
export async function uploadVideoFileAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: 'User not authenticated' };
    }

    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const quality = formData.get('quality') as string;
    const duration = parseFloat(formData.get('duration') as string);
    const isPublic = formData.get('isPublic') === 'true';
    const isPublish = formData.get('isPublish') === 'true';
    const thumbnailUrl = formData.get('thumbnailUrl') as string || '';

    if (!file || !title) {
      return { error: 'File and title are required' };
    }

    // Upload file to storage
    const uploadedFile = await uploadFile(file);

    // Create video record
    const videoRecord = await createVideoRecord({
      title,
      file_id: uploadedFile.$id,
      quality,
      user_id: user.id,
      user_name: user.name || user.email?.split('@')[0] || 'User',
      duration,
      is_public: isPublic,
      is_publish: isPublish,
      thumbnail_url: thumbnailUrl,
      subtitle_file_id: null
    });

    revalidatePath('/record');
    revalidatePath('/discover');

    return { 
      success: true, 
      data: { 
        videoId: videoRecord.id, 
        fileId: uploadedFile.$id 
      } 
    };
  } catch (error: any) {
    console.error('Upload video error:', error);
    return { error: error.message || 'Failed to upload video' };
  }
}

// Get user videos
export async function getUserVideosAction(): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: 'User not authenticated' };
    }

    const videos = await getUserVideos(user.id);
    
    // 映射为兼容格式
    const mappedVideos = videos.map(mapVideoRecord);
    
    return { success: true, data: mappedVideos };
  } catch (error: any) {
    console.error('Get user videos error:', error);
    return { error: error.message || 'Failed to fetch videos' };
  }
}

// Get public videos for discovery
export async function getPublicVideosAction(): Promise<ActionResult> {
  try {
    const videos = await getPublicVideos();
    
    // 映射为兼容格式
    const mappedVideos = videos.map(mapVideoRecord);
    
    return { success: true, data: mappedVideos };
  } catch (error: any) {
    console.error('Get public videos error:', error);
    return { error: error.message || 'Failed to fetch public videos' };
  }
}

// Get video by ID
export async function getVideoByIdAction(videoId: string): Promise<ActionResult> {
  try {
    const video = await getVideoById(videoId);
    
    // 映射为兼容格式
    const mappedVideo = mapVideoRecord(video);
    
    return { success: true, data: mappedVideo };
  } catch (error: any) {
    console.error('Get video by ID error:', error);
    return { error: error.message || 'Failed to fetch video' };
  }
}

// Toggle video privacy
export async function toggleVideoPrivacyAction(videoId: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: 'User not authenticated' };
    }

    const updatedVideo = await toggleVideoPrivacy(videoId, user.$id);
    
    revalidatePath('/record');
    revalidatePath('/discover');
    
    return { success: true, data: updatedVideo };
  } catch (error: any) {
    console.error('Toggle video privacy error:', error);
    return { error: error.message || 'Failed to update video privacy' };
  }
}

// Toggle video publish status
export async function toggleVideoPublishStatusAction(videoId: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: 'User not authenticated' };
    }

    const updatedVideo = await toggleVideoPublishStatus(videoId, user.$id);
    
    revalidatePath('/record');
    revalidatePath('/discover');
    
    return { success: true, data: updatedVideo };
  } catch (error: any) {
    console.error('Toggle video publish status error:', error);
    return { error: error.message || 'Failed to update video publish status' };
  }
}

// Delete video
export async function deleteVideoAction(videoId: string, fileId?: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: 'User not authenticated' };
    }

    const result = await deleteVideo(videoId, fileId);
    
    revalidatePath('/record');
    revalidatePath('/discover');
    
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Delete video error:', error);
    return { error: error.message || 'Failed to delete video' };
  }
}

// Add reaction to video
export async function addReactionAction(videoId: string, emoji: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: 'User not authenticated' };
    }

    const reaction = await addReaction(videoId, user.$id, user.name, emoji);
    
    revalidatePath(`/share/${videoId}`);
    
    return { success: true, data: reaction };
  } catch (error: any) {
    console.error('Add reaction error:', error);
    return { error: error.message || 'Failed to add reaction' };
  }
}

// Get video reactions
export async function getVideoReactionsAction(videoId: string): Promise<ActionResult> {
  try {
    const reactions = await getVideoReactions(videoId);
    
    // 映射为兼容格式
    const mappedReactions = reactions.map(mapVideoReaction);
    
    return { success: true, data: mappedReactions };
  } catch (error: any) {
    console.error('Get video reactions error:', error);
    return { error: error.message || 'Failed to fetch reactions' };
  }
}

// Increment video views
export async function incrementVideoViewsAction(videoId: string): Promise<ActionResult> {
  try {
    await incrementViews(videoId);
    
    return { success: true };
  } catch (error: any) {
    console.error('Increment video views error:', error);
    // Don't return error for view tracking failures
    return { success: true };
  }
}

// Update video thumbnail
export async function updateVideoThumbnailAction(videoId: string, thumbnailUrl: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: 'User not authenticated' };
    }

    const updatedVideo = await updateVideoThumbnail(videoId, thumbnailUrl, user.$id);
    
    revalidatePath('/record');
    
    return { success: true, data: updatedVideo };
  } catch (error: any) {
    console.error('Update video thumbnail error:', error);
    return { error: error.message || 'Failed to update thumbnail' };
  }
}

// Upload file only (without creating video record)
export async function uploadFileAction(file: File): Promise<ActionResult> {
  try {
    const uploadedFile = await uploadFile(file);
    const url = await getFileUrl(uploadedFile.$id);
    
    return { 
      success: true, 
      data: { 
        fileId: uploadedFile.$id, 
        url: url.toString() 
      } 
    };
  } catch (error: any) {
    console.error('Upload file error:', error);
    return { error: error.message || 'Failed to upload file' };
  }
}

// Get file URL
export async function getFileUrlAction(fileId: string): Promise<ActionResult> {
  try {
    const url = await getFileUrl(fileId);
    
    return { success: true, data: { url: url.toString() } };
  } catch (error: any) {
    console.error('Get file URL error:', error);
    return { error: error.message || 'Failed to get file URL' };
  }
}