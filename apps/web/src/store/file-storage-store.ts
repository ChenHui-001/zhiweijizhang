import React from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { userService } from '@/lib/api/user-service';

/**
 * 文件存储状态接口
 */
export interface FileStorageStatus {
  enabled: boolean;
  configured: boolean;
  healthy: boolean;
  message: string;
}

/**
 * 文件存储Store状态接口
 */
interface FileStorageState {
  // 存储状态
  status: FileStorageStatus | null;
  isLoading: boolean;
  error: string | null;
  lastChecked: number | null;

  // 缓存控制
  cacheTimeout: number; // 缓存超时时间（毫秒）

  // Actions
  fetchStorageStatus: () => Promise<void>;
  clearError: () => void;
  isStorageAvailable: () => boolean;
  shouldRefreshStatus: () => boolean;
}

/**
 * 文件存储状态Store
 */
export const useFileStorageStore = create<FileStorageState>()(
  persist(
    (set, get) => ({
      // 初始状态
      status: null,
      isLoading: false,
      error: null,
      lastChecked: null,
      cacheTimeout: 5 * 60 * 1000, // 5分钟缓存

      // 获取存储状态（实时获取，不使用缓存）
      fetchStorageStatus: async () => {
        set({ isLoading: true, error: null });

        try {
          console.log('🗄️ 实时获取文件存储状态...');

          // 使用用户服务获取存储状态
          const status = await userService.getFileStorageStatus();
          console.log('🗄️ 文件存储状态:', status);

          set({
            status,
            isLoading: false,
            error: null,
            lastChecked: Date.now(),
          });
        } catch (error) {
          console.error('🗄️ 获取文件存储状态失败:', error);
          const errorMessage = error instanceof Error ? error.message : '获取存储状态失败';

          set({
            status: {
              enabled: false,
              configured: false,
              healthy: false,
              message: errorMessage,
            },
            isLoading: false,
            error: errorMessage,
            lastChecked: Date.now(),
          });
        }
      },

      // 清除错误
      clearError: () => set({ error: null }),

      // 检查存储是否可用
      isStorageAvailable: () => {
        const { status } = get();
        return !!(status?.enabled && status?.configured && status?.healthy);
      },

      // 检查是否需要刷新状态
      shouldRefreshStatus: () => {
        const { lastChecked, cacheTimeout } = get();
        if (!lastChecked) return true;
        return Date.now() - lastChecked > cacheTimeout;
      },
    }),
    {
      name: 'file-storage-store',
      // 只持久化状态数据，不持久化函数
      partialize: (state) => ({
        status: state.status,
        lastChecked: state.lastChecked,
        cacheTimeout: state.cacheTimeout,
      }),
    },
  ),
);

/**
 * 文件存储状态Hook
 * 提供便捷的状态访问和自动刷新功能
 */
export const useFileStorageStatus = () => {
  const {
    status,
    isLoading,
    error,
    fetchStorageStatus,
    clearError,
    isStorageAvailable,
    shouldRefreshStatus,
  } = useFileStorageStore();

  // 自动获取状态（如果需要）
  React.useEffect(() => {
    if (shouldRefreshStatus()) {
      fetchStorageStatus();
    }
  }, [fetchStorageStatus, shouldRefreshStatus]);

  return {
    status,
    isLoading,
    error,
    isAvailable: isStorageAvailable(),
    refresh: fetchStorageStatus,
    clearError,
  };
};
