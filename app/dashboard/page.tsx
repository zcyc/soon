'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardPage() {
  const router = useRouter();

  // 重定向到录制页面
  useEffect(() => {
    router.replace('/record');
  }, [router]);

  // 显示加载状态
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-muted-foreground">跳转中...</p>
      </div>
    </div>
  );
}
