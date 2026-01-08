'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import VideoGallery from './video-gallery';

interface VideoGalleryWrapperProps {
  showPublic?: boolean;
}

export default function VideoGalleryWrapper({ showPublic = false }: VideoGalleryWrapperProps) {
  const [hasSetupError, setHasSetupError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSetupError = (error: string) => {
    if (error.includes('Attribute not found in schema') || 
        error.includes('Collection not found') ||
        error.includes('userId') ||
        error.includes('not authorized') ||
        error.includes('Unauthorized')) {
      setHasSetupError(true);
      setErrorMessage(error);
    }
  };

  if (hasSetupError) {
    return (
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950">
        <CardHeader>
          <CardTitle className="flex items-center text-amber-700 dark:text-amber-300">
            <AlertCircle className="h-5 w-5 mr-2" />
            Database Setup Required
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-amber-600 dark:text-amber-400 text-sm">
            {errorMessage.includes('Unauthorized') ? (
              '🔒 数据库权限配置不正确。请按照设置指南的步骤6配置集合权限。'
            ) : (
              '您的 Supabase 数据库表尚未设置。请按照 README 中的 SQL 语句在 Supabase SQL Editor 中创建必要的表。'
            )}
          </p>
          
          <div className="bg-amber-100 dark:bg-amber-900 p-3 rounded-lg">
            <p className="text-xs font-mono text-amber-700 dark:text-amber-300">
              Error: {errorMessage}
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setHasSetupError(false)}
            >
              Retry
            </Button>
          </div>
          
          <details className="mt-4">
            <summary className="text-sm text-amber-600 dark:text-amber-400 cursor-pointer">
为什么需要手动设置？
            </summary>
            <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 space-y-1">
              <p>• 客户端 SDK 没有管理权限，无法自动创建集合</p>
              <p>• 需要在 Supabase SQL Editor 中执行 SQL 创建 "videos" 和 "reactions" 表</p>
              <p>• 设置指南包含详细的步骤说明</p>
              <p>• 完成设置后应用将正常工作</p>
            </div>
          </details>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <VideoGallery showPublic={showPublic} onError={handleSetupError} />
    </>
  );
}