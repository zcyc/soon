'use client';

import { Button } from '@/components/ui/button';
import { ArrowRight, Video, Download, Globe, Zap, Shield, Share2, Play } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import Link from 'next/link';

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { t } = useI18n();

  // 显示加载状态
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
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-background to-muted/20 py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              {t.home?.heroTitle || '专业的屏幕录制工具'}
            </h1>
            <p className="text-xl sm:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              {t.home?.heroSubtitle || '轻松录制屏幕、摄像头和音频，创建高质量的视频内容'}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/record">
                <Button size="lg" className="text-lg px-8 py-6">
                  {t.home?.getStarted || '开始录制'}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/discover">
                <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                  {t.nav?.discover || '探索视频'}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              {t.home?.featuresTitle || '强大的功能特性'}
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t.home?.featuresSubtitle || '一切您需要的录制功能，都在这里'}
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="p-6 rounded-lg border border-border bg-card hover:shadow-lg transition-shadow">
              <div className="bg-primary/10 rounded-full p-4 w-16 h-16 mb-4 flex items-center justify-center">
                <Video className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {t.home?.screenRecordingTitle || '屏幕录制'}
              </h3>
              <p className="text-muted-foreground">
                {t.home?.screenRecordingDesc || '录制整个屏幕、特定窗口或浏览器标签页'}
              </p>
            </div>
            
            <div className="p-6 rounded-lg border border-border bg-card hover:shadow-lg transition-shadow">
              <div className="bg-primary/10 rounded-full p-4 w-16 h-16 mb-4 flex items-center justify-center">
                <Globe className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {t.home?.cameraRecordingTitle || '摄像头录制'}
              </h3>
              <p className="text-muted-foreground">
                {t.home?.cameraRecordingDesc || '同时录制屏幕和摄像头，创建画中画效果'}
              </p>
            </div>
            
            <div className="p-6 rounded-lg border border-border bg-card hover:shadow-lg transition-shadow">
              <div className="bg-primary/10 rounded-full p-4 w-16 h-16 mb-4 flex items-center justify-center">
                <Download className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {t.home?.audioRecordingTitle || '音频录制'}
              </h3>
              <p className="text-muted-foreground">
                {t.home?.audioRecordingDesc || '录制系统音频和麦克风，支持高质量音质'}
              </p>
            </div>

            <div className="p-6 rounded-lg border border-border bg-card hover:shadow-lg transition-shadow">
              <div className="bg-primary/10 rounded-full p-4 w-16 h-16 mb-4 flex items-center justify-center">
                <Zap className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {t.home?.highQualityTitle || '高质量输出'}
              </h3>
              <p className="text-muted-foreground">
                {t.home?.highQualityDesc || '支持 720p 和 1080p 录制，可自定义比特率和帧率'}
              </p>
            </div>

            <div className="p-6 rounded-lg border border-border bg-card hover:shadow-lg transition-shadow">
              <div className="bg-primary/10 rounded-full p-4 w-16 h-16 mb-4 flex items-center justify-center">
                <Share2 className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {t.home?.easyShareTitle || '轻松分享'}
              </h3>
              <p className="text-muted-foreground">
                {t.home?.easyShareDesc || '一键分享视频，生成公开链接，支持下载和在线播放'}
              </p>
            </div>

            <div className="p-6 rounded-lg border border-border bg-card hover:shadow-lg transition-shadow">
              <div className="bg-primary/10 rounded-full p-4 w-16 h-16 mb-4 flex items-center justify-center">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {t.home?.privacyProtectionTitle || '隐私保护'}
              </h3>
              <p className="text-muted-foreground">
                {t.home?.privacyProtectionDesc || '完全控制视频的可见性，支持公开和私有设置'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-muted/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            {t.home?.ctaTitle || '准备好开始录制了吗？'}
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            {t.home?.ctaDescription || '立即开始创建您的第一个视频'}
          </p>
          <Link href="/record">
            <Button size="lg" className="text-lg px-8 py-6">
              <Play className="mr-2 h-5 w-5" />
              {t.home?.startRecording || '开始录制'}
            </Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
