import { registrationConfig } from "@/lib/config";
import { NextResponse } from "next/server";
import { activityService, ActivityType } from "@/lib/services/activity-service";
import { headers, cookies } from "next/headers";
import { createServerClient } from '@supabase/ssr';
import { config } from '@/lib/supabase-server';

/**
 * OAuth 回调处理
 * Supabase OAuth 使用 code 参数进行认证
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    console.log('OAuth callback received:', {
      hasCode: !!code,
      error: error || 'none',
      url: url.toString()
    });

    // 获取正确的 origin（使用请求的 origin，自动包含正确的协议）
    const redirectOrigin = url.origin;

    // 检查错误
    if (error) {
      console.error('OAuth callback error:', error);
      return NextResponse.redirect(`${redirectOrigin}/oauth-complete?error=oauth_failed`);
    }

    // 检查必需参数
    if (!code) {
      console.error('OAuth callback missing code parameter');
      return NextResponse.redirect(`${redirectOrigin}/sign-in?error=oauth_incomplete`);
    }

    // 创建响应对象用于设置 cookie
    const cookieStore = await cookies();
    
    // 创建临时响应对象用于收集 cookie
    const tempResponse = NextResponse.next();
    const cookiesToSet: Array<{ name: string; value: string; options?: any }> = [];
    
    // 创建 Supabase 客户端，配置 cookie 处理
    const supabase = createServerClient(config.url, config.publishableKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSetArray) {
          cookiesToSetArray.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
            cookiesToSet.push({ name, value, options });
          });
        }
      }
    });

    // 交换 code 获取 session
    console.log('OAuth: Exchanging code for session...');
    const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (exchangeError) {
      console.error('OAuth: Failed to exchange code for session:', exchangeError);
      return NextResponse.redirect(`${redirectOrigin}/oauth-complete?error=oauth_session_failed`);
    }

    if (!session) {
      console.error('OAuth: No session returned after code exchange');
      return NextResponse.redirect(`${redirectOrigin}/oauth-complete?error=oauth_session_failed`);
    }

    console.log('OAuth: Session established successfully, session ID:', session.access_token?.substring(0, 20) + '...');

    // 获取用户信息
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('OAuth: Failed to get user after session exchange:', userError);
      return NextResponse.redirect(`${redirectOrigin}/oauth-complete?error=oauth_session_failed`);
    }

    console.log('OAuth: User retrieved successfully:', user.id);

    // 检查注册是否被禁用
    if (!registrationConfig.enableRegistration) {
      // 检查用户创建时间（如果是新用户，删除）
      const userCreationTime = new Date(user.created_at).getTime();
      const now = Date.now();
      const timeDiff = now - userCreationTime;
      
      // 如果用户创建时间很近（小于5分钟），认为是新注册
      if (timeDiff < 300000) { // 5分钟
        console.log('OAuth: New user registration detected and registration disabled');
        
        // 删除新用户（需要管理员权限）
        try {
          const { createAdminClient } = await import('@/lib/supabase-server');
          const adminSupabase = await createAdminClient();
          const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(user.id);
          
          if (deleteError) {
            console.warn('OAuth: Failed to delete new user:', deleteError);
          } else {
            console.log('OAuth: New user deleted due to registration disabled');
          }
        } catch (deleteError) {
          console.warn('OAuth: Failed to delete new user:', deleteError);
        }
        
        // 登出用户
        await supabase.auth.signOut();
        
        return NextResponse.redirect(`${redirectOrigin}/oauth-complete?error=registration_disabled`);
      }
      
      console.log('OAuth: Existing user login allowed');
    }

    console.log('OAuth: User authenticated successfully:', user.id);

    // 记录登录活动
    try {
      const headersList = await headers();
      const ipAddress = headersList.get('x-forwarded-for')?.split(',')[0] || 
                       headersList.get('x-real-ip') || 
                       '0.0.0.0';
      
      // 检测 OAuth 提供商类型
      const referer = headersList.get('referer') || '';
      let oauthProvider = 'OAuth';
      if (referer.includes('github.com')) {
        oauthProvider = 'GitHub OAuth';
      } else if (referer.includes('google.com') || referer.includes('accounts.google.com')) {
        oauthProvider = 'Google OAuth';
      }
      
      await activityService.logActivity({
        user_id: user.id,
        action: ActivityType.SIGN_IN,
        ip_address: ipAddress,
        metadata: `${oauthProvider} login`
      });

      console.log('OAuth: Activity logged successfully for:', oauthProvider);
    } catch (activityError) {
      console.warn('OAuth: Failed to log activity:', activityError);
      // 不让活动记录失败影响登录流程
    }

    // 重定向到OAuth完成页面 - 用于处理弹窗关闭
    console.log('OAuth: Redirecting to oauth-complete at:', `${redirectOrigin}/oauth-complete`);
    
    // 创建重定向响应
    const redirectResponse = NextResponse.redirect(`${redirectOrigin}/oauth-complete`);
    
    // 将所有设置的 cookie 复制到重定向响应
    cookiesToSet.forEach(({ name, value, options }) => {
      redirectResponse.cookies.set(name, value, options);
    });
    
    console.log('OAuth: Cookies set in response:', cookiesToSet.length);
    
    return redirectResponse;

  } catch (error: any) {
    console.error('OAuth callback error:', error);
    
    const url = new URL(request.url);
    const redirectOrigin = url.origin;
    
    // 在catch块中也重定向到oauth-complete页面以便正确关闭弹窗
    return NextResponse.redirect(`${redirectOrigin}/oauth-complete?error=oauth_session_failed`);
  }
}
