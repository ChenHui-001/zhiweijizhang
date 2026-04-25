'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth-store';
import { useOnboardingStore } from '@/store/onboarding-store';
import { useAccountBookStore } from '@/store/account-book-store';
import { PageContainer } from '@/components/layout/page-container';
import { useThemeStore } from '@/store/theme-store';
import { AvatarDisplay } from '@/components/ui/avatar-display';
import { userService } from '@/lib/api/user-service';
import { useSystemConfig } from '@/hooks/useSystemConfig';
import { VersionUpdate } from '@/components/settings/VersionUpdate';
import { useMobileBackHandler } from '@/hooks/use-mobile-back-handler';
import { PageLevel } from '@/lib/mobile-navigation';
import './settings.css';

export default function SettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout, syncUserToLocalStorage } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const { resetOnboarding, startOnboarding, setAccountType, setCurrentStep } = useOnboardingStore();
  const { currentAccountBook } = useAccountBookStore();
  const { config } = useSystemConfig();
  const [currentLanguage, setCurrentLanguage] = useState('简体中文');
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // 移动端后退处理
  const { goBack } = useMobileBackHandler({
    pageId: 'settings',
    pageLevel: PageLevel.FEATURE,
    enableHardwareBack: true,
    enableBrowserBack: true,
    onBack: () => {
      // 设置页面后退到仪表盘
      router.push('/dashboard');
      return true; // 已处理
    },
  });

  // 获取最新的用户信息
  useEffect(() => {
    const fetchLatestUserInfo = async () => {
      if (!isAuthenticated || !user) return;

      try {
        setIsLoadingProfile(true);
        const latestProfile = await userService.getUserProfile();

        // 更新auth store中的用户信息
        const updatedUser = {
          ...user,
          avatar: latestProfile.avatar,
          bio: latestProfile.bio,
          birthDate: latestProfile.birthDate,
          username: latestProfile.username,
        };

        syncUserToLocalStorage(updatedUser);
      } catch (error) {
        console.error('获取最新用户信息失败:', error);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchLatestUserInfo();
  }, [isAuthenticated, user?.id, syncUserToLocalStorage]);
  const [currentCurrency, setCurrentCurrency] = useState('人民币 (¥)');

  // 如果未登录，重定向到登录页
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, router]);

  // 加载本地设置
  useEffect(() => {
    const savedLanguage = localStorage.getItem('app-language') || 'zh-CN';
    const savedCurrency = localStorage.getItem('app-currency') || 'CNY';

    // 语言映射
    const languageMap: Record<string, string> = {
      'zh-CN': '简体中文',
      'zh-TW': '繁體中文',
      en: 'English',
    };

    // 货币映射
    const currencyMap: Record<string, string> = {
      CNY: '人民币 (¥)',
      USD: '美元 ($)',
      EUR: '欧元 (€)',
      GBP: '英镑 (£)',
      JPY: '日元 (¥)',
      HKD: '港币 (HK$)',
      TWD: '新台币 (NT$)',
    };

    setCurrentLanguage(languageMap[savedLanguage] || '简体中文');
    setCurrentCurrency(currencyMap[savedCurrency] || '人民币 (¥)');
  }, []);

  // 处理退出登录
  const handleLogout = async () => {
    if (confirm('确定要退出登录吗？')) {
      logout();
      router.push('/auth/login');
    }
  };

  // 处理重新查看引导
  const handleRestartOnboarding = () => {
    console.log('🔄 [Settings] Restarting onboarding...');

    // 清理本地存储中的引导状态
    try {
      localStorage.removeItem('onboarding-storage');
      console.log('🧹 [Settings] Cleared onboarding storage');
    } catch (error) {
      console.warn('⚠️ [Settings] Failed to clear storage:', error);
    }

    resetOnboarding();

    // 始终从第一步开始，让用户重新体验完整的引导流程
    console.log('🔄 [Settings] Starting onboarding from account-type step');
    startOnboarding();
  };

  // 处理导入记录
  const handleImportRecords = () => {
    const importUrl = 'https://import.zhiweijz.cn:1443';

    // 只在新窗口打开导入页面，不使用fallback策略
    if (typeof window !== 'undefined') {
      try {
        // 尝试在新窗口打开，不检查结果
        window.open(importUrl, '_blank', 'noopener,noreferrer');
      } catch (error) {
        // 静默处理错误，不进行任何跳转
        console.warn('Failed to open new window:', error);
      }
    }
  };

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <PageContainer title="设置" activeNavItem="profile">
      <div className="user-card">
        <div className="user-avatar">
          <AvatarDisplay
            avatar={user.avatar}
            username={user.name}
            userId={user.id}
            size="large"
            alt="用户头像"
          />
        </div>
        <div className="user-info">
          <div className="user-name">{user.name}</div>
          <div className="user-email">{user.email}</div>
        </div>
      </div>

      <div className="settings-group">
        <div className="group-title">账户</div>
        <Link href="/settings/profile" className="settings-item">
          <div className="item-icon">
            <i className="fas fa-user-circle"></i>
          </div>
          <div className="item-content">
            <div className="item-title">个人资料</div>
            <div className="item-description">修改个人信息</div>
          </div>
          <div className="item-action">
            <i className="fas fa-chevron-right"></i>
          </div>
        </Link>
        <Link href="/settings/security" className="settings-item">
          <div className="item-icon">
            <i className="fas fa-shield-alt"></i>
          </div>
          <div className="item-content">
            <div className="item-title">账户安全</div>
            <div className="item-description">修改密码</div>
          </div>
          <div className="item-action">
            <i className="fas fa-chevron-right"></i>
          </div>
        </Link>
      </div>

      <div className="settings-group">
        <div className="group-title">数据管理</div>
        <Link href="/settings/books" className="settings-item">
          <div className="item-icon">
            <i className="fas fa-book"></i>
          </div>
          <div className="item-content">
            <div className="item-title">账本管理</div>
            <div className="item-description">管理您的账本</div>
          </div>
          <div className="item-action">
            <i className="fas fa-chevron-right"></i>
          </div>
        </Link>
        <Link href="/settings/budgets" className="settings-item">
          <div className="item-icon">
            <i className="fas fa-wallet"></i>
          </div>
          <div className="item-content">
            <div className="item-title">预算管理</div>
            <div className="item-description">管理个人和通用预算</div>
          </div>
          <div className="item-action">
            <i className="fas fa-chevron-right"></i>
          </div>
        </Link>
        <Link href="/settings/tags" className="settings-item">
          <div className="item-icon">
            <i className="fas fa-tags"></i>
          </div>
          <div className="item-content">
            <div className="item-title">标签管理</div>
            <div className="item-description">管理记账记录标签</div>
          </div>
          <div className="item-action">
            <i className="fas fa-chevron-right"></i>
          </div>
        </Link>
        <Link href="/settings/families" className="settings-item">
          <div className="item-icon">
            <i className="fas fa-home"></i>
          </div>
          <div className="item-content">
            <div className="item-title">家庭管理</div>
            <div className="item-description">管理家庭人员</div>
          </div>
          <div className="item-action">
            <i className="fas fa-chevron-right"></i>
          </div>
        </Link>
        <Link href="/settings/categories" className="settings-item">
          <div className="item-icon">
            <i className="fas fa-tags"></i>
          </div>
          <div className="item-content">
            <div className="item-title">分类管理</div>
            <div className="item-description">管理记账分类</div>
          </div>
          <div className="item-action">
            <i className="fas fa-chevron-right"></i>
          </div>
        </Link>
        <button className="settings-item" onClick={handleImportRecords}>
          <div className="item-icon">
            <i className="fas fa-file-import"></i>
          </div>
          <div className="item-content">
            <div className="item-title">导入记录</div>
            <div className="item-description">从其他应用导入记账数据</div>
          </div>
          <div className="item-action">
            <i className="fas fa-external-link-alt"></i>
          </div>
        </button>
        <Link href="/settings/export" className="settings-item">
          <div className="item-icon">
            <i className="fas fa-file-export"></i>
          </div>
          <div className="item-content">
            <div className="item-title">数据导出</div>
            <div className="item-description">导出账本数据</div>
          </div>
          <div className="item-action">
            <i className="fas fa-chevron-right"></i>
          </div>
        </Link>
      </div>

      <div className="settings-group">
        <div className="group-title">应用</div>
        <Link href="/settings/ai-services" className="settings-item">
          <div className="item-icon">
            <i className="fas fa-robot"></i>
          </div>
          <div className="item-content">
            <div className="item-title">AI服务管理</div>
            <div className="item-description">开启或关闭AI功能，查看记账点余额</div>
          </div>
          <div className="item-action">
            <i className="fas fa-chevron-right"></i>
          </div>
        </Link>
        <Link href="/settings/shortcuts" className="settings-item">
          <div className="item-icon">
            <i className="fas fa-bolt"></i>
          </div>
          <div className="item-content">
            <div className="item-title">快捷记账</div>
            <div className="item-description">设置快捷指令，实现快速记账</div>
          </div>
          <div className="item-action">
            <i className="fas fa-chevron-right"></i>
          </div>
        </Link>
        <Link href="/settings/theme" className="settings-item">
          <div className="item-icon">
            <i className="fas fa-palette"></i>
          </div>
          <div className="item-content">
            <div className="item-title">主题设置</div>
            <div className="item-description">自定义应用外观</div>
          </div>
          <div className="item-action">
            <i className="fas fa-chevron-right"></i>
          </div>
        </Link>
        <Link href="/settings/language" className="settings-item">
          <div className="item-icon">
            <i className="fas fa-language"></i>
          </div>
          <div className="item-content">
            <div className="item-title">语言</div>
            <div className="item-description">{currentLanguage}</div>
          </div>
          <div className="item-action">
            <i className="fas fa-chevron-right"></i>
          </div>
        </Link>
        <Link href="/settings/currency" className="settings-item">
          <div className="item-icon">
            <i className="fas fa-yen-sign"></i>
          </div>
          <div className="item-content">
            <div className="item-title">货币设置</div>
            <div className="item-description">{currentCurrency}</div>
          </div>
          <div className="item-action">
            <i className="fas fa-chevron-right"></i>
          </div>
        </Link>
        <button className="settings-item" onClick={handleRestartOnboarding}>
          <div className="item-icon">
            <i className="fas fa-graduation-cap"></i>
          </div>
          <div className="item-content">
            <div className="item-title">重新查看引导</div>
            <div className="item-description">重新体验应用引导流程</div>
          </div>
          <div className="item-action">
            <i className="fas fa-chevron-right"></i>
          </div>
        </button>
      </div>



      <div className="settings-group">
        <div className="group-title">关于</div>
        <Link href="/settings/about" className="settings-item">
          <div className="item-icon">
            <i className="fas fa-info-circle"></i>
          </div>
          <div className="item-content">
            <div className="item-title">关于应用</div>
            <div className="item-description">版本信息</div>
          </div>
          <div className="item-action">
            <i className="fas fa-chevron-right"></i>
          </div>
        </Link>
        <Link href="/settings/feedback" className="settings-item">
          <div className="item-icon">
            <i className="fas fa-comment-alt"></i>
          </div>
          <div className="item-content">
            <div className="item-title">意见反馈</div>
            <div className="item-description">提交问题或建议</div>
          </div>
          <div className="item-action">
            <i className="fas fa-chevron-right"></i>
          </div>
        </Link>
        <VersionUpdate />
      </div>

      <button className="logout-button" onClick={handleLogout}>
        退出登录
      </button>

      <div className="version-info">只为记账 v0.9.1</div>
    </PageContainer>
  );
}
