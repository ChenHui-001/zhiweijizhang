'use client';

import React, { createContext, useContext, useCallback, useState } from 'react';
import { useVersionCheck } from '@/hooks/useVersionCheck';
import {
  VersionUpdateDialog,
  VersionCheckIndicator,
} from '@/components/version/VersionUpdateDialog';
import { VersionCheckResponse } from '@/lib/api/version';

interface VersionContextType {
  isChecking: boolean;
  updateInfo: VersionCheckResponse | null;
  error: string | null;
  checkVersion: () => Promise<void>;
  showUpdateDialog: boolean;
  setShowUpdateDialog: (show: boolean) => void;
}

const VersionContext = createContext<VersionContextType | undefined>(undefined);

export function useVersion() {
  const context = useContext(VersionContext);
  if (!context) {
    throw new Error('useVersion must be used within a VersionProvider');
  }
  return context;
}

interface VersionProviderProps {
  children: React.ReactNode;
  enabled?: boolean;
  autoCheck?: boolean;
  checkInterval?: number;
}

// 获取当前平台
function getCurrentPlatform(): 'web' | 'ios' | 'android' {
  if (typeof window === 'undefined') return 'web';
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes('android')) return 'android';
  if (userAgent.includes('iphone') || userAgent.includes('ipad')) return 'ios';
  return 'web';
}

// 获取当前应用版本
function getCurrentAppVersion(): { version: string; buildNumber: number } {
  return {
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    buildNumber: parseInt(process.env.NEXT_PUBLIC_APP_BUILD_NUMBER || '1', 10),
  };
}

export function VersionProvider({
  children,
  enabled = true,
  autoCheck = true,
  checkInterval = 24 * 60 * 60 * 1000, // 24小时
}: VersionProviderProps) {
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [forceUpdateDialog, setForceUpdateDialog] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<VersionCheckResponse | null>(null);

  const platform = getCurrentPlatform();
  const { version, buildNumber } = getCurrentAppVersion();

  const { isChecking, error, checkVersion: doCheckVersion, clearError } =
    useVersionCheck();

  const checkVersion = useCallback(async () => {
    await doCheckVersion({
      platform,
      currentVersion: version,
      currentBuildNumber: buildNumber,
    });
  }, [doCheckVersion, platform, version, buildNumber]);

  const handleCloseDialog = useCallback(() => {
    if (!forceUpdateDialog) {
      setShowUpdateDialog(false);
    }
  }, [forceUpdateDialog]);

  const handleUpdate = useCallback(async () => {
    // Update action handled by dialog
  }, []);

  const handleSkip = useCallback(async () => {
    setShowUpdateDialog(false);
    setForceUpdateDialog(false);
  }, []);

  const contextValue: VersionContextType = {
    isChecking,
    updateInfo,
    error,
    checkVersion,
    showUpdateDialog,
    setShowUpdateDialog,
  };

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <VersionContext.Provider value={contextValue}>
      {children}

      {/* 版本检查指示器 */}
      <VersionCheckIndicator
        isChecking={isChecking}
        error={error}
        onRetry={() => {
          clearError();
          checkVersion();
        }}
      />

      {/* 版本更新对话框 */}
      {updateInfo?.hasUpdate && updateInfo.latestVersion && (
        <VersionUpdateDialog
          isOpen={showUpdateDialog}
          onClose={handleCloseDialog}
          updateInfo={updateInfo}
          onUpdate={handleUpdate}
          onSkip={handleSkip}
          platform={platform}
        />
      )}
    </VersionContext.Provider>
  );
}

// 手动检查版本的钩子
export function useManualVersionCheck() {
  const { checkVersion } = useVersion();

  return useCallback(async () => {
    await checkVersion();
  }, [checkVersion]);
}

// 获取版本信息的钩子
export function useVersionInfo() {
  const { updateInfo } = useVersion();
  const platform = getCurrentPlatform();
  const { version, buildNumber } = getCurrentAppVersion();

  return {
    currentVersion: version,
    currentBuildNumber: buildNumber,
    platform,
    latestVersion: updateInfo?.latestVersion,
    hasUpdate: updateInfo?.hasUpdate || false,
    isForceUpdate: updateInfo?.isForceUpdate || false,
  };
}
