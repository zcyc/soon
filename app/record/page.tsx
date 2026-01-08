'use client';

import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import ScreenRecorder from '@/components/screen-recorder';
import VideoGalleryWrapper from '@/components/video-gallery-wrapper';
import LoginModal from '@/components/login-modal';

export default function RecordPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [previousUser, setPreviousUser] = useState(user);
  
  // 监听登录状态变化，确保录制状态不丢失
  useEffect(() => {
    if (!loading) {
      // 检测登录状态变化
      if (!previousUser && user) {
        console.log('检测到用户登录成功:', {
          userId: user.id,
          userName: user.name,
          userEmail: user.email
        });
        
        // 登录成功后不重置页面，保持当前的录制状态
        console.log('登录成功，继续保持当前录制会话状态');
      } else if (previousUser && !user) {
        console.log('检测到用户登出');
      }
      
      setPreviousUser(user);
    }
  }, [user, loading, previousUser]);

  // 显示加载状态，避免内容闪烁
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">{t.common?.loading || '加载中...'}</p>
        </div>
      </div>
    );
  }

  return (
    <main className="flex-1">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 content-container">
        {/* Welcome Section - Only for logged in users */}
        {user && (
          <div className="mb-8">
            <h1 className="text-3xl font-bold">{t.dashboard.welcomeBack}, {user.name || 'User'}!</h1>
            <p className="text-muted-foreground mt-2">
              {t.dashboard.welcomeDescription}
            </p>
          </div>
        )}

        {/* Recording Section */}
        <div className="mb-8">
          <ScreenRecorder />
        </div>

        {/* Conditional Content Based on User Status */}
        {user ? (
          /* 已登录用户：显示我的视频 */
          <VideoGalleryWrapper />
        ) : (
          /* 未登录用户：显示提示信息 */
          <div className="text-center py-12 border border-border rounded-lg bg-muted/30">
            <p className="text-muted-foreground mb-4">
              登录后可以保存和管理您的录制视频
            </p>
            <button
              onClick={() => setShowLoginModal(true)}
              className="text-primary hover:underline font-medium"
            >
              立即登录
            </button>
          </div>
        )}
      </div>
      <LoginModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)}
        onSuccess={() => {
          console.log('页面级别: 登录成功回调被调用');
          // 不做任何特殊处理，让状态自然更新
        }}
      />
    </main>
  );
}
