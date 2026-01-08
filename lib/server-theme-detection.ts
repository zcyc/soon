import { headers, cookies } from 'next/headers';

// 默认主题颜色（绿色）
const defaultThemeColor = {
  primary: '142 76% 36%', // green-500 in HSL
  primaryForeground: '0 0% 98%'
};

// 获取基于设备主题的模式（回退到浅色模式）
function getDeviceThemeFallback(): 'light' | 'dark' {
  // 服务器端无法直接检测设备主题，回退到浅色模式
  // 客户端会通过 matchMedia 正确检测设备主题
  return 'light';
}

// 服务器端获取初始主题设置
export async function getServerInitialTheme(): Promise<{
  mode: 'auto' | 'light' | 'dark';
  actualMode: 'light' | 'dark';
  shouldApplyDarkClass: boolean;
  themeColor: { primary: string; primaryForeground: string };
}> {
  const cookieStore = await cookies();
  const headersList = await headers();
  
  // 优先从 cookie 获取用户保存的主题偏好
  const savedThemeMode = cookieStore.get('soon-theme-mode')?.value as 'auto' | 'light' | 'dark' | undefined;
  
  // 从请求头获取客户端的首选色彩方案（Windows Dark Mode 检测）
  const prefersColorScheme = headersList.get('sec-ch-prefers-color-scheme');
  
  let mode: 'auto' | 'light' | 'dark' = savedThemeMode || 'auto';
  let actualMode: 'light' | 'dark';
  
  if (mode === 'auto') {
    // 自动模式：使用设备主题偏好
    if (prefersColorScheme === 'dark') {
      actualMode = 'dark';
    } else if (prefersColorScheme === 'light') {
      actualMode = 'light';
    } else {
      // 如果无法检测设备主题，回退到浅色模式
      // 客户端会通过 matchMedia 正确检测设备主题
      actualMode = getDeviceThemeFallback();
    }
  } else {
    actualMode = mode as 'light' | 'dark';
  }
  
  const shouldApplyDarkClass = actualMode === 'dark';
  
  return {
    mode,
    actualMode,
    shouldApplyDarkClass,
    themeColor: defaultThemeColor
  };
}