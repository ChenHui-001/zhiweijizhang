/**
 * 移动端支付初始化模块
 * 支付系统已停用，此文件保留用于兼容
 */

import { Capacitor } from '@capacitor/core';

interface InitializationResult {
  success: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * 初始化移动端支付系统（已停用）
 */
export async function initializeMobilePayment(userId?: string): Promise<InitializationResult> {
  console.log('🔄 [MobilePaymentInit] 支付系统已停用');

  return {
    success: true,
    warnings: ['支付系统已停用']
  };
}

/**
 * 设置用户ID（已停用）
 */
export async function setPaymentUserId(userId: string): Promise<boolean> {
  return true;
}

/**
 * 用户登出时清理支付状态（已停用）
 */
export async function clearPaymentUser(): Promise<void> {
  // 支付系统已停用，无需清理
}

/**
 * 检查支付系统健康状态（已停用）
 */
export async function checkPaymentHealth(): Promise<{
  isHealthy: boolean;
  details: {
    isNativePlatform: boolean;
    isInitialized: boolean;
    hasApiKey: boolean;
    configValid: boolean;
  };
  issues?: string[];
}> {
  return {
    isHealthy: true,
    details: {
      isNativePlatform: Capacitor.isNativePlatform(),
      isInitialized: false,
      hasApiKey: false,
      configValid: false
    },
    issues: ['支付系统已停用']
  };
}

/**
 * 获取支付系统信息（已停用）
 */
export function getPaymentSystemInfo(): {
  platform: string;
  environment: string;
  apiKeyConfigured: boolean;
  isInitialized: boolean;
  productCount: number;
} {
  return {
    platform: Capacitor.getPlatform(),
    environment: 'disabled',
    apiKeyConfigured: false,
    isInitialized: false,
    productCount: 0
  };
}

/**
 * 在应用启动时自动初始化（已停用）
 */
export async function autoInitializePayment(): Promise<void> {
  // 支付系统已停用，无需初始化
}
