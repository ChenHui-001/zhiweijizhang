'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { PageContainer } from '@/components/layout/page-container';

import { useGlobalAIStore } from '@/store/global-ai-store';
import { useAuthStore } from '@/store/auth-store';
import { useAIServicesStore } from '@/store/ai-services-store';
import { useMobileBackHandler } from '@/hooks/use-mobile-back-handler';
import { PageLevel } from '@/lib/mobile-navigation';
import styles from './ai-services.module.css';

export default function AIServicesPage() {
  const router = useRouter();

  const { isAuthenticated } = useAuthStore();

  const {
    userAIEnabled,
    isLoadingUserAI,
    fetchUserAIEnabled,
    toggleUserAIService,
    switchServiceType,
    globalConfig,
    fetchGlobalConfig,
  } = useGlobalAIStore();

  const {
    services,
    isLoading: servicesLoading,
    fetchServices,
    deleteService,
  } = useAIServicesStore();

  const [selectedServiceType, setSelectedServiceType] = useState<'official' | 'custom'>('official');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useMobileBackHandler({
    pageId: 'settings-ai-services',
    pageLevel: PageLevel.MODAL,
    enableHardwareBack: true,
    enableBrowserBack: true,
    onBack: () => {
      router.push('/settings');
      return true;
    },
  });

  useEffect(() => {
    if (isAuthenticated) {
      fetchUserAIEnabled();
      fetchServices();
      fetchGlobalConfig();
    }
  }, [isAuthenticated, fetchUserAIEnabled, fetchServices, fetchGlobalConfig]);

  useEffect(() => {
    if (globalConfig?.serviceType) {
      setSelectedServiceType(globalConfig.serviceType as 'official' | 'custom');
    }
  }, [globalConfig?.serviceType]);

  const handleGlobalAIToggle = async (enabled: boolean) => {
    try {
      await toggleUserAIService(enabled);
    } catch (error) {
      console.error('切换用户AI服务状态失败:', error);
    }
  };

  const handleServiceTypeChange = async (type: 'official' | 'custom') => {
    try {
      setSelectedServiceType(type);
      if (type === 'custom' && services.length > 0) {
        await switchServiceType('custom', services[0].id);
      } else {
        await switchServiceType('official');
      }
      toast.success(`已切换到${type === 'official' ? '官方AI' : '自定义AI'}`);
    } catch (error) {
      console.error('切换服务类型失败:', error);
      toast.error('切换失败');
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm('确定要删除这个AI服务配置吗？')) return;

    setDeletingId(id);
    try {
      await deleteService(id);
      toast.success('删除成功');
      if (selectedServiceType === 'custom' && services.length === 0) {
        setSelectedServiceType('official');
        await switchServiceType('official');
      }
    } catch (error) {
      console.error('删除服务失败:', error);
      toast.error('删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  const handleRefreshServices = async () => {
    await fetchServices();
  };

  const rightActions = (
    <div className={styles.actionButtons}>
      <button
        className={`${styles.iconButton} ${styles.refreshButton}`}
        onClick={handleRefreshServices}
        title="刷新"
      >
        <i className="fas fa-sync-alt"></i>
      </button>
    </div>
  );

  if (!isAuthenticated) {
    return (
      <PageContainer title="AI服务管理" showBackButton={true} activeNavItem="profile">
        <div className={styles.loginContainer}>
          <div className={styles.loginCard}>
            <i className="fas fa-lock" style={{ fontSize: '48px', color: 'var(--text-secondary)', marginBottom: '16px' }}></i>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 8px 0' }}>需要登录</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 24px 0' }}>请先登录以访问AI服务管理功能</p>
            <Link href="/auth/login" className={styles.loginButton}>前往登录</Link>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="AI服务管理" rightActions={rightActions} showBackButton={true} activeNavItem="profile">
      {/* AI服务开关 */}
      <div className={styles.globalAISwitch}>
        <div className={styles.globalAISwitchHeader}>
          <div className={styles.globalAISwitchInfo}>
            <h3>AI服务开关</h3>
            <p>开启后可以使用智能记账等AI功能</p>
          </div>
          <div className={styles.globalAISwitchControls}>
            {isLoadingUserAI ? (
              <div className={styles.globalAISwitchSpinner}></div>
            ) : (
              <label className={styles.globalAISwitchToggle}>
                <input type="checkbox" checked={userAIEnabled} onChange={(e) => handleGlobalAIToggle(e.target.checked)} />
                <span className={styles.globalAISwitchSlider}></span>
              </label>
            )}
            <span className={`${styles.globalAISwitchStatus} ${userAIEnabled ? styles.enabled : styles.disabled}`}>
              {userAIEnabled ? '已启用' : '已禁用'}
            </span>
          </div>
        </div>
      </div>

      {/* AI服务类型切换 */}
      {userAIEnabled && (
        <div className={styles.globalAISwitch}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 16px 0' }}>AI服务类型</h3>
          <div className={styles.serviceTypeButtons}>
            <button
              onClick={() => handleServiceTypeChange('official')}
              className={`${styles.serviceTypeButton} ${selectedServiceType === 'official' ? styles.active : ''}`}
            >
              <i className="fas fa-crown"></i>
              官方AI
            </button>
            <button
              onClick={() => handleServiceTypeChange('custom')}
              className={`${styles.serviceTypeButton} ${selectedServiceType === 'custom' ? styles.active : ''}`}
            >
              <i className="fas fa-user-cog"></i>
              自定义AI
            </button>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '12px 0 0 0' }}>
            {selectedServiceType === 'official'
              ? '使用系统内置AI服务，会消耗记账点'
              : '使用您配置的API服务，完全免费'}
          </p>
        </div>
      )}

      {/* 自定义AI服务列表 */}
      {userAIEnabled && selectedServiceType === 'custom' && (
        <div className={styles.globalAISwitch}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>自定义AI服务</h3>
            <Link href="/settings/ai-services/add" className={styles.addServiceButton}>
              <i className="fas fa-plus"></i> 添加服务
            </Link>
          </div>

          {servicesLoading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.loadingSpinner}></div>
              <span>加载中...</span>
            </div>
          ) : services.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <i className="fas fa-robot"></i>
              </div>
              <h3>暂无自定义AI服务</h3>
              <p>配置您的自定义AI服务，享受免费智能记账</p>
              <Link href="/settings/ai-services/add" className={styles.addServiceButton}>
                添加自定义AI服务
              </Link>
            </div>
          ) : (
            <div className={styles.aiServicesList}>
              {services.map((service) => (
                <div key={service.id} className={styles.aiServiceItem}>
                  <div className={styles.serviceInfo}>
                    <div className={styles.serviceName}>{service.name}</div>
                    <div className={styles.serviceDetails}>
                      <span className={styles.serviceProvider}>{service.provider}</span>
                      <span className={styles.serviceModel}>{service.model}</span>
                    </div>
                    <div className={styles.serviceDescription}>
                      创建于 {new Date(service.createdAt).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                  <div className={styles.serviceActions}>
                    <Link href={`/settings/ai-services/edit/${service.id}`} className={styles.editButton}>
                      <i className="fas fa-edit"></i>
                    </Link>
                    <button
                      onClick={() => handleDeleteService(service.id)}
                      disabled={deletingId === service.id}
                      className={styles.deleteButton}
                    >
                      <i className={`fas ${deletingId === service.id ? 'fa-spinner fa-spin' : 'fa-trash'}`}></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 官方AI提示 */}
      {userAIEnabled && selectedServiceType === 'official' && (
        <div className={styles.globalAISwitch} style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <i className="fas fa-info-circle" style={{ fontSize: '20px', color: 'var(--primary-color)', marginTop: '2px' }}></i>
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 8px 0' }}>使用官方AI服务</h4>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
                官方AI服务由系统提供。
              </p>
              <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--primary-color)' }}>
                💡 推荐配置自定义AI服务，享受更灵活的AI功能
              </p>
            </div>
          </div>
        </div>
      )}

      {/* AI服务未启用提示 */}
      {!userAIEnabled && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <i className="fas fa-robot"></i>
          </div>
          <h3>AI服务未启用</h3>
          <p>开启AI服务后，您可以使用智能记账、语音记账、图片记账等AI功能</p>
          <button onClick={() => handleGlobalAIToggle(true)} className={styles.addServiceButton}>
            立即开启AI服务
          </button>
        </div>
      )}
    </PageContainer>
  );
}
