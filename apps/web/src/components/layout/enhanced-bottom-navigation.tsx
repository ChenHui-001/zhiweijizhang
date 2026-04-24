'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAccountBookStore } from '@/store/account-book-store';
import { useGlobalAIStore } from '@/store/global-ai-store';
import { useTransactionSelectionStore } from '@/store/transaction-selection-store';
import { useDashboardStore } from '@/store/dashboard-store';
import EnhancedSmartAccountingDialog from '../transactions/enhanced-smart-accounting-dialog';
import { GlobalTransactionSelectionModal } from '../transactions/global-transaction-selection-modal';
import { toast } from 'sonner';
import { hapticPresets } from '@/lib/haptic-feedback';
import { apiClient } from '@/lib/api-client';
import '@/styles/smart-accounting-dialog.css';

interface EnhancedBottomNavigationProps {
  currentPath?: string;
}

export function EnhancedBottomNavigation({ currentPath }: EnhancedBottomNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentAccountBook } = useAccountBookStore();
  const { globalConfig, fetchGlobalConfig } = useGlobalAIStore();
  const [isSmartAccountingOpen, setIsSmartAccountingOpen] = useState(false);

  const [mounted, setMounted] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const [lastClickTime, setLastClickTime] = useState<Record<string, number>>({});

  // 防抖机制 - 防止快速连续点击
  const isClickAllowed = (itemId: string) => {
    const now = Date.now();
    const lastClick = lastClickTime[itemId] || 0;
    const debounceTime = 300; // 300ms防抖

    if (now - lastClick < debounceTime) {
      console.log('🚫 [BottomNav] 跳过快速连续点击:', itemId);
      return false;
    }

    setLastClickTime((prev) => ({ ...prev, [itemId]: now }));
    return true;
  };

  // 确保只在客户端渲染，并创建安全的Portal容器
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 创建专用的Portal容器，避免直接使用document.body
    const container = document.createElement('div');
    container.id = 'bottom-navigation-portal';
    container.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 40;
      pointer-events: auto;
    `;

    document.body.appendChild(container);
    setPortalContainer(container);
    setMounted(true);

    return () => {
      // 清理Portal容器
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
      setPortalContainer(null);
      setMounted(false);
    };
  }, []);

  // 获取全局AI配置
  useEffect(() => {
    fetchGlobalConfig();
  }, [fetchGlobalConfig]);

  // 监听快捷指令和分享图片打开智能记账模态框的事件
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOpenSmartAccountingDialog = (event: CustomEvent) => {
      console.log('🖼️ [BottomNav] 收到打开智能记账模态框事件:', event.detail);

      const { source, type, imageUrl, accountBookId } = event.detail;

      if (type === 'shortcut-image' && imageUrl && accountBookId) {
        console.log('🖼️ [BottomNav] 打开智能记账模态框，准备处理快捷指令图片');

        // 打开智能记账模态框
        setIsSmartAccountingOpen(true);

        // 将快捷指令信息存储到sessionStorage，供模态框使用
        sessionStorage.setItem('shortcutImageData', JSON.stringify({
          type: 'shortcut-image',
          imageUrl,
          accountBookId,
          timestamp: Date.now()
        }));
      } else if (source === 'share-image') {
        console.log('📷 [BottomNav] 打开智能记账模态框，准备处理分享图片');

        // 打开智能记账模态框
        setIsSmartAccountingOpen(true);

        // 分享图片数据已经在ShareImageHandler中保存到sessionStorage了
        // 这里只需要打开模态框即可
      }
    };

    const handlePendingTransactionRecords = (event: CustomEvent) => {
      console.log('📝 [BottomNav] 收到待处理记录事件:', event.detail);

      const { records, accountBookId, source } = event.detail;

      if (records && accountBookId) {
        console.log(`📝 [BottomNav] 显示${records.length}条待处理记录选择模态框`);

        // 使用全局记录选择模态框
        const { showSelectionModal } = useTransactionSelectionStore.getState();
        showSelectionModal(records, accountBookId, async (selectedRecords, imageFileInfo) => {
          // 创建选择的记录
          const response = await apiClient.post(
            `/ai/account/${accountBookId}/smart-accounting/create-selected`,
            {
              selectedRecords,
              imageFileInfo
            },
            { timeout: 60000 }
          );

          if (response && response.success) {
            toast.success(`成功创建 ${response.count} 条记账记录`);

            // 刷新仪表盘数据
            try {
              const dashboardStore = useDashboardStore.getState();
              await dashboardStore.refreshDashboardData(accountBookId);
            } catch (refreshError) {
              console.error('刷新数据失败:', refreshError);
            }
          } else {
            throw new Error('创建记账记录失败');
          }
        });
      }
    };

    // 添加事件监听器
    window.addEventListener('openSmartAccountingDialog', handleOpenSmartAccountingDialog as EventListener);
    window.addEventListener('pendingTransactionRecords', handlePendingTransactionRecords as EventListener);

    return () => {
      // 清理事件监听器
      window.removeEventListener('openSmartAccountingDialog', handleOpenSmartAccountingDialog as EventListener);
      window.removeEventListener('pendingTransactionRecords', handlePendingTransactionRecords as EventListener);
    };
  }, []);

  const isActive = (path: string) => {
    if (currentPath) {
      return currentPath === path;
    }
    return pathname === path;
  };

  const handleNavItemClick = (e: React.MouseEvent, itemId: string) => {
    // 防抖检查 - 但不阻止导航本身，只阻止重复的振动反馈
    const shouldVibrate = isClickAllowed(itemId);

    // 异步执行振动反馈，避免阻塞主线程
    if (shouldVibrate) {
      setTimeout(() => {
        try {
          hapticPresets.navigation();
        } catch (error) {
          console.warn('振动反馈失败:', error);
        }
      }, 0);
    }

    console.log('🧭 [BottomNav] 导航项点击:', itemId);
    // 不阻止默认的Link导航行为
  };

  const handleAddButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();

    // 防抖检查
    if (!isClickAllowed('add-button')) {
      return;
    }

    // 异步执行振动反馈，避免阻塞主线程
    setTimeout(() => {
      try {
        hapticPresets.buttonTap();
      } catch (error) {
        console.warn('振动反馈失败:', error);
      }
    }, 0);

    console.log('添加按钮点击，全局AI配置:', globalConfig);

    // 使用全局AI配置的enabled字段来判断是否显示智能记账弹窗
    if (globalConfig?.enabled) {
      console.log('全局AI已启用，打开智能记账对话框');
      setIsSmartAccountingOpen(true);
    } else {
      console.log('全局AI未启用，跳转到手动记账页面');
      router.push('/transactions/new');
    }
  };

  const handleDialogClose = () => {
    setIsSmartAccountingOpen(false);
  };

  const navigationContent = (
    <>
      <nav
        className="bottom-nav enhanced-bottom-navigation"
        style={{
          position: 'fixed',
          bottom: '0',
          left: '0',
          right: '0',
          height: '56px',
          background: 'var(--card-background)',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.05)',
          zIndex: '40',
          maxWidth: '480px',
          margin: '0 auto',
          pointerEvents: 'auto', // 确保导航栏可以接收点击事件
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)',
        }}
      >
        <Link
          href="/dashboard"
          className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`}
          onClick={(e) => handleNavItemClick(e, 'dashboard')}
        >
          <i className="fas fa-home"></i>
          <span>首页</span>
        </Link>
        <Link
          href="/statistics"
          className={`nav-item ${isActive('/statistics') ? 'active' : ''}`}
          onClick={(e) => handleNavItemClick(e, 'statistics')}
        >
          <i className="fas fa-chart-pie"></i>
          <span>统计</span>
        </Link>
        <a
          href="#"
          onClick={handleAddButtonClick}
          className="nav-item add-button"
          style={{ zIndex: 101 }}
        >
          <div className="add-icon">
            <i className="fas fa-plus"></i>
          </div>
        </a>
        <Link
          href="/budgets/statistics"
          className={`nav-item ${isActive('/budgets') || (pathname && pathname.startsWith('/budgets/')) ? 'active' : ''}`}
          onClick={(e) => handleNavItemClick(e, 'budgets')}
        >
          <i className="fas fa-wallet"></i>
          <span>预算</span>
        </Link>
        <Link
          href="/settings"
          className={`nav-item ${isActive('/settings') ? 'active' : ''}`}
          onClick={(e) => handleNavItemClick(e, 'settings')}
        >
          <i className="fas fa-user"></i>
          <span>我的</span>
        </Link>
      </nav>

      {/* 增强版智能记账对话框 */}
      <EnhancedSmartAccountingDialog
        isOpen={isSmartAccountingOpen}
        onClose={handleDialogClose}
        accountBookId={currentAccountBook?.id}
      />

      {/* 全局记录选择模态框 */}
      <GlobalTransactionSelectionModal />
    </>
  );

  // 只在客户端渲染，并使用安全的Portal容器
  if (!mounted || !portalContainer) {
    return null;
  }

  return createPortal(navigationContent, portalContainer);
}
