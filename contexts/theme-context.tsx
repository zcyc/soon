'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'auto';

// Fixed green theme color values
const GREEN_THEME = {
  primary: '142 76% 36%', // green-500 in HSL
  primaryForeground: '0 0% 98%'
};

interface ThemeContextType {
  mode: ThemeMode;
  actualMode: 'light' | 'dark'; // 实际生效的模式
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

// 获取基于设备主题的模式
function getDeviceTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') {
    // 服务器端回退到浅色模式
    return 'light';
  }
  // 检测设备首选色彩方案
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // Read initial theme from server-side rendered data attribute
  const getInitialTheme = (): 'light' | 'dark' => {
    if (typeof document !== 'undefined') {
      // First try to get from server-rendered data attribute
      const serverTheme = document.documentElement.getAttribute('data-initial-theme');
      if (serverTheme === 'dark' || serverTheme === 'light') {
        return serverTheme;
      }
      
      // Check if dark class is already applied (for immediate sync)
      const hasDarkClass = document.documentElement.classList.contains('dark');
      if (hasDarkClass) {
        return 'dark';
      }
    }
    // Fallback to device theme
    return getDeviceTheme();
  };

  const [mode, setMode] = useState<ThemeMode>('auto');
  const [actualMode, setActualMode] = useState<'light' | 'dark'>(() => getInitialTheme());
  const [mounted, setMounted] = useState(false);

  // Load theme preferences and sync with server
  useEffect(() => {
    const savedMode = (localStorage.getItem('theme-mode') as ThemeMode) || 'auto';
    setMode(savedMode);
    
    // Clean up old theme-color localStorage entry since we're using fixed green theme
    if (localStorage.getItem('theme-color')) {
      localStorage.removeItem('theme-color');
    }
    
    // Set theme preferences in cookies for server-side detection
    document.cookie = `soon-theme-mode=${savedMode}; path=/; max-age=31536000; samesite=strict`;
    
    setMounted(true);
  }, []); 

  // Apply theme changes to document and handle auto mode
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    
    // 计算实际应该应用的模式
    let effectiveMode: 'light' | 'dark';
    if (mode === 'auto') {
      effectiveMode = getDeviceTheme();
    } else {
      effectiveMode = mode as 'light' | 'dark';
    }
    
    // 只在模式真的改变时更新 actualMode
    if (effectiveMode !== actualMode) {
      setActualMode(effectiveMode);
    }
    
    // Batch DOM updates to minimize repaints
    const updates: Array<() => void> = [];
    
    // Apply dark/light mode - 只在需要时修改，避免不必要的闪烁
    const hasDarkClass = root.classList.contains('dark');
    if (effectiveMode === 'dark' && !hasDarkClass) {
      updates.push(() => root.classList.add('dark'));
    } else if (effectiveMode === 'light' && hasDarkClass) {
      updates.push(() => root.classList.remove('dark'));
    }
    
    // Apply fixed green theme color as CSS variables
    const currentPrimary = root.style.getPropertyValue('--primary');
    if (currentPrimary !== GREEN_THEME.primary) {
      updates.push(() => {
        root.style.setProperty('--primary', GREEN_THEME.primary);
        root.style.setProperty('--primary-foreground', GREEN_THEME.primaryForeground);
      });
    }
    
    // Execute all DOM updates in a single frame
    if (updates.length > 0) {
      requestAnimationFrame(() => {
        updates.forEach(update => update());
      });
    }
    
    // Save to localStorage and cookie (only mode, color is fixed)
    localStorage.setItem('theme-mode', mode);
    if (typeof document !== 'undefined') {
      document.cookie = `soon-theme-mode=${mode}; path=/; max-age=31536000; samesite=strict`;
    }
  }, [mode, mounted, actualMode]);

  // 监听设备主题变化（仅在 auto 模式下）
  useEffect(() => {
    if (!mounted || mode !== 'auto') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleThemeChange = (e?: MediaQueryListEvent) => {
      const matches = e ? e.matches : mediaQuery.matches;
      const newActualMode = matches ? 'dark' : 'light';
      if (newActualMode !== actualMode) {
        setActualMode(newActualMode);
      }
    };
    
    // 立即检查一次，确保与服务器端保持同步
    handleThemeChange();
    
    // 监听设备主题变化
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleThemeChange);
      return () => mediaQuery.removeEventListener('change', handleThemeChange);
    } else {
      // 兼容旧版浏览器
      mediaQuery.addListener(handleThemeChange);
      return () => mediaQuery.removeListener(handleThemeChange);
    }
  }, [mounted, mode, actualMode]);
  
  // Mark hydration complete after everything is ready
  useEffect(() => {
    if (mounted) {
      // Enable transitions after hydration is complete
      const timer = setTimeout(() => {
        document.documentElement.setAttribute('data-hydrated', 'true');
      }, 100); // Slightly longer delay to ensure stability
      
      return () => clearTimeout(timer);
    }
  }, [mounted]);

  const toggleMode = () => {
    setMode(prev => {
      if (prev === 'auto') return 'light';
      if (prev === 'light') return 'dark';
      return 'auto';
    });
  };

  return (
    <ThemeContext.Provider value={{ mode, actualMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
};