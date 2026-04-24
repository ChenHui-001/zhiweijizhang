'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useBudgetFormStore } from '@/store/budget-form-store';
import { useAccountBookStore } from '@/store/account-book-store';
import { useCategoryStore } from '@/store/category-store';
import { TransactionType } from '@/types';
import { useTokenMonitor } from '@/hooks/use-token-monitor';
import { BasicInfoSection } from './budgets/budget-form/basic-info-section';
import { TimeSettingsSection } from './budgets/budget-form/time-settings-section';
import { CategoryBudgetSection } from './budgets/budget-form/category-budget-section';
import { BudgetTypeCard } from './budgets/budget-form/budget-type-card';
import { RolloverInfoSection } from './budgets/budget-form/rollover-info-section';

// 导入样式
import '@/styles/budget-form.css';
import '@/styles/budget-edit-modal.css';
import '@/styles/budget-form.css';

interface BudgetEditModalProps {
  budgetId: string | null;
  onClose: () => void;
  onSave: () => void;
}

export default function BudgetEditModal({ budgetId, onClose, onSave }: BudgetEditModalProps) {
  const { isAuthenticated } = useAuthStore();
  const { currentAccountBook } = useAccountBookStore();
  const { categories, fetchCategories } = useCategoryStore();
  const [isDataLoading, setIsDataLoading] = useState(true);

  // 使用token监控Hook
  const { isTokenValid, isRefreshing, refreshToken } = useTokenMonitor({
    autoRedirect: false, // 不自动跳转，由组件自己处理
    onTokenInvalid: () => {
      console.log('🚨 预算编辑模态框：Token失效');
    },
    onTokenRefreshed: () => {
      console.log('✅ 预算编辑模态框：Token刷新成功');
      // Token刷新成功后，如果有budgetId且不是占位符，重新加载数据
      if (budgetId && budgetId !== 'placeholder') {
        loadBudgetData(budgetId);
      }
    },
  });

  const {
    mode: formMode,
    budgetType,
    enableRollover,
    setMode,
    setBudgetId,
    setCategories,
    loadBudgetData,
    submitForm,
    isLoading,
    isSubmitting,
    resetForm,
    errors,
  } = useBudgetFormStore();

  // 设置模态框状态
  useEffect(() => {
    // 添加modal-open类到body
    document.body.classList.add('modal-open');

    // 清理函数
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, []);

  // 设置表单模式为编辑模式
  useEffect(() => {
    setMode('edit');
    if (budgetId) {
      setBudgetId(budgetId);

      // 如果是占位符，不执行数据加载
      if (budgetId === 'placeholder') {
        return;
      }

      // 检查认证状态和token有效性
      if (!isAuthenticated || !isTokenValid) {
        console.warn('⚠️ 用户未认证或token无效');
        return;
      }

      loadBudgetData(budgetId);
    } else {
      resetForm();
    }
  }, [budgetId, isAuthenticated, isTokenValid, setMode, setBudgetId, loadBudgetData, resetForm]);

  // 加载初始数据
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsDataLoading(true);

        // 使用CategoryStore获取分类数据，与其他组件保持一致
        if (currentAccountBook?.id) {
          await fetchCategories(TransactionType.EXPENSE, currentAccountBook.id);
        } else {
          await fetchCategories(TransactionType.EXPENSE);
        }

        // 设置数据到BudgetFormStore
        setCategories(categories as any);
      } catch (error) {
        console.error('加载初始数据失败:', error);
      } finally {
        setIsDataLoading(false);
      }
    };

    loadInitialData();
  }, [setCategories, fetchCategories, currentAccountBook?.id]);

  // 监听分类数据变化，同步到BudgetFormStore
  useEffect(() => {
    if (categories.length > 0) {
      setCategories(categories as any);
      setIsDataLoading(false);
    }
  }, [categories, setCategories]);

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAccountBook) {
      console.error('没有选择账本');
      return;
    }
    const success = await submitForm(currentAccountBook.id);
    if (success) {
      // 调用父组件的保存回调
      onSave();
    }
  };

  // 检查认证状态和token有效性
  if (!isAuthenticated || !isTokenValid) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'var(--background-color)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          className="app-container"
          style={{
            maxWidth: 'none',
            margin: 0,
            width: '100%',
            height: '100vh',
            minHeight: '100vh',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div className="header">
            <button className="icon-button" onClick={onClose}>
              <i className="fas fa-arrow-left"></i>
            </button>
            <div className="header-title">编辑预算</div>
            <div style={{ width: '32px' }}></div>
          </div>
          <div className="main-content" style={{ padding: '20px' }}>
            <div className="budget-form">
              <div className="form-section">
                <div className="error-message">
                  <i className="fas fa-lock"></i>
                  <span>{!isAuthenticated ? '请先登录账户' : 'Token已失效，请重新登录'}</span>
                  {isRefreshing ? (
                    <button type="button" className="retry-button" disabled>
                      <span className="loading-spinner"></span>
                      刷新中...
                    </button>
                  ) : (
                    <div className="button-group">
                      <button type="button" onClick={refreshToken} className="retry-button">
                        <i className="fas fa-redo"></i>
                        重试
                      </button>
                      <button
                        type="button"
                        onClick={() => (window.location.href = '/auth/login')}
                        className="retry-button"
                      >
                        <i className="fas fa-sign-in-alt"></i>
                        登录
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 隐藏仪表盘页面的头部，显示编辑预算的头部
  useEffect(() => {
    // 隐藏仪表盘的头部和底部导航
    const appContainer = document.querySelector('.app-container');
    const pageHeader = appContainer?.querySelector('.header');
    const bottomNav = document.querySelector('.bottom-nav');

    if (pageHeader) {
      (pageHeader as HTMLElement).style.display = 'none';
    }
    if (bottomNav) {
      (bottomNav as HTMLElement).style.display = 'none';
    }

    return () => {
      // 恢复显示
      if (pageHeader) {
        (pageHeader as HTMLElement).style.display = '';
      }
      if (bottomNav) {
        (bottomNav as HTMLElement).style.display = '';
      }
    };
  }, []);

  // 如果正在加载，显示加载状态
  if (isLoading || isDataLoading) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'var(--background-color)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          className="app-container"
          style={{
            maxWidth: 'none',
            margin: 0,
            width: '100%',
            height: '100vh',
            minHeight: '100vh',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div className="header">
            <button className="icon-button" onClick={onClose}>
              <i className="fas fa-arrow-left"></i>
            </button>
            <div className="header-title">编辑预算</div>
            <div style={{ width: '32px' }}></div>
          </div>
          <div className="main-content" style={{ padding: '20px' }}>
            <div className="budget-form">
              <div className="form-section">
                <div className="loading-state">
                  <i className="fas fa-spinner fa-spin"></i>
                  <span>加载中...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 如果是占位符，显示占位符信息
  if (budgetId === 'placeholder') {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'var(--background-color)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          className="app-container"
          style={{
            maxWidth: 'none',
            margin: 0,
            width: '100%',
            height: '100vh',
            minHeight: '100vh',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div className="header">
            <button className="icon-button" onClick={onClose}>
              <i className="fas fa-arrow-left"></i>
            </button>
            <div className="header-title">编辑预算</div>
            <div style={{ width: '32px' }}></div>
          </div>
          <div className="main-content" style={{ padding: '20px' }}>
            <div className="budget-form">
              <div className="form-section">
                <div className="placeholder-message">
                  <i className="fas fa-info-circle"></i>
                  <span>
                    这是一个静态导出的占位符页面。在实际应用中，请通过正确的路由访问预算编辑页面。
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="budget-edit-modal"
      onClick={(e) => {
        // 只有点击背景时才关闭模态框
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* 使用完全相同的应用容器结构 */}
      <div className="app-container">
        {/* 编辑预算的头部 */}
        <div className="header">
          <button className="icon-button" onClick={onClose}>
            <i className="fas fa-arrow-left"></i>
          </button>
          <div className="header-title">编辑预算</div>
          <div style={{ width: '32px' }}></div>
        </div>

        {/* 主要内容 */}
        <div className="main-content">
          <div>
            <form onSubmit={handleSubmit} className="budget-form">
              {/* 错误提示 */}
              {errors.general && (
                <div className="form-section">
                  <div className="error-message">
                    <i className="fas fa-exclamation-triangle"></i>
                    <span>{errors.general}</span>
                    {budgetId && budgetId !== 'placeholder' && (
                      <button
                        type="button"
                        onClick={() => loadBudgetData(budgetId)}
                        className="retry-button"
                        disabled={isLoading}
                      >
                        <i className="fas fa-redo"></i>
                        重试
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 基本信息区块 */}
              <BasicInfoSection />

              {/* 时间设置区块 */}
              <TimeSettingsSection />

              {/* 分类预算区块 */}
              <CategoryBudgetSection />

              {/* 结转信息区块 - 仅个人预算且启用结转时显示 */}
              {formMode === 'edit' && budgetType === 'PERSONAL' && enableRollover && (
                <RolloverInfoSection />
              )}

              {/* 提交按钮 */}
              <div className="form-section">
                <button type="submit" className="submit-button" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <span className="loading-spinner"></span>
                      更新中...
                    </>
                  ) : (
                    '保存修改'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
