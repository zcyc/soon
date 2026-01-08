import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSessionClient();
    
    // 获取当前域名（使用请求 URL 的 origin，自动包含正确的协议）
    const url = new URL(request.url);
    const origin = url.origin;
    
    console.log('API: Creating Google OAuth2 session with origin:', origin);
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/oauth`,
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

    console.log('API: Google OAuth redirect URL created');
    
    return NextResponse.json({ 
      success: true, 
      url: data.url 
    });
  } catch (error: any) {
    console.error('Google OAuth API error:', error);
    return NextResponse.json(
      { error: error.message || 'Google OAuth failed' },
      { status: 500 }
    );
  }
}
