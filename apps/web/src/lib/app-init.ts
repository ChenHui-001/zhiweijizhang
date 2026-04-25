/**
 * 应用初始化模块
 * 支付系统已停用
 */

import { Capacitor } from '@capacitor/core';

let isInitialized = false;

/**
 * 初始化应用
 */
export async function initializeApp(): Promise<void> {
  if (isInitialized) {
    console.log('🚀 [AppInit] 应用已初始化，跳过');
    return;
  }

  console.log('🚀 [AppInit] 开始初始化应用...');
  console.log('🚀 [AppInit] 平台信息:', {
    platform: Capacitor.getPlatform(),
    isNative: Capacitor.isNativePlatform()
  });

  // 支付系统已停用，无需初始化

  isInitialized = true;
  console.log('🚀 [AppInit] 应用初始化完成');
}

/**
 * 设置用户ID（支付系统已停用）
 */
export async function setPaymentUserId(userId: string): Promise<void> {
  // 支付系统已停用
}

/**
 * 用户登出时清理（支付系统已停用）
 */
export async function clearPaymentUser(): Promise<void> {
  // 支付系统已停用，无需清理
}

/**
 * 检查支付系统状态
 */
export function getPaymentSystemStatus() {
  return {
    isInitialized: isInitialized,
    isReady: false,
    platform: Capacitor.getPlatform(),
    isNative: Capacitor.isNativePlatform(),
    hasApiKey: false
  };
}
