/**
 * 支付功能使用示例页面
 * 展示如何在应用中集成支付功能
 */

import React, { useState, useEffect } from 'react';
import { PaymentModal } from '../components/PaymentModal';
import { 
  useMobilePayment, 
  MembershipLevel, 
  REVENUECAT_CONFIG,
  getActiveProducts 
} from '../lib/payment';
import { Capacitor } from '@capacitor/core';

export default function ExamplePaymentPage() {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [initStatus, setInitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const {
    isInitialized,
    isLoading,
    error,
    membershipLevel,
    isDonationMember,
    isDonationTwo,
    isDonationThree,
    hasMonthlyPoints1000,
    hasMonthlyPoints1500,
    hasCharityAttribution,
    hasPrioritySupport,
    hasAiSmartAccounting,
    hasAdvancedAnalytics,
    initialize,
    refreshCustomerInfo
  } = useMobilePayment();

  // 初始化支付系统
  useEffect(() => {
    const initPayment = async () => {
      if (!Capacitor.isNativePlatform()) {
        console.log('非移动端环境，跳过支付初始化');
        return;
      }

      if (!REVENUECAT_CONFIG.apiKey) {
        setInitStatus('error');
        console.error('RevenueCat API密钥未配置');
        return;
      }

      setInitStatus('loading');
      try {
        await initialize(REVENUECAT_CONFIG.apiKey);
        setInitStatus('success');
      } catch (error) {
        setInitStatus('error');
        console.error('支付系统初始化失败:', error);
      }
    };

    initPayment();
  }, [initialize]);

  // 处理购买成功
  const handlePurchaseSuccess = (newLevel: string) => {
    console.log('购买成功，新会员级别:', newLevel);
    // 这里可以添加购买成功后的逻辑
    // 比如刷新页面数据、显示成功消息等
  };

  // 获取会员状态显示信息
  const getMembershipDisplay = () => {
    switch (membershipLevel) {
      case MembershipLevel.DONATION_THREE:
        return { name: '捐赠会员（叁）', color: 'text-purple-600', bgColor: 'bg-purple-100' };
      case MembershipLevel.DONATION_TWO:
        return { name: '捐赠会员（贰）', color: 'text-blue-600', bgColor: 'bg-blue-100' };
      case MembershipLevel.DONATION_ONE:
        return { name: '捐赠会员（壹）', color: 'text-green-600', bgColor: 'bg-green-100' };
      default:
        return { name: '免费用户', color: 'text-gray-600', bgColor: 'bg-gray-100' };
    }
  };

  const membershipDisplay = getMembershipDisplay();
  const isMobile = Capacitor.isNativePlatform();
  const products = getActiveProducts();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8">支付功能示例</h1>

        {/* 平台信息 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">平台信息</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-gray-600">当前平台:</span>
              <span className="ml-2 font-medium">{Capacitor.getPlatform()}</span>
            </div>
            <div>
              <span className="text-gray-600">是否移动端:</span>
              <span className={`ml-2 font-medium ${isMobile ? 'text-green-600' : 'text-orange-600'}`}>
                {isMobile ? '是' : '否'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">支付系统状态:</span>
              <span className={`ml-2 font-medium ${
                initStatus === 'success' ? 'text-green-600' : 
                initStatus === 'error' ? 'text-red-600' : 
                initStatus === 'loading' ? 'text-yellow-600' : 'text-gray-600'
              }`}>
                {initStatus === 'success' ? '已初始化' : 
                 initStatus === 'error' ? '初始化失败' : 
                 initStatus === 'loading' ? '初始化中...' : '未初始化'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">API密钥:</span>
              <span className={`ml-2 font-medium ${REVENUECAT_CONFIG.apiKey ? 'text-green-600' : 'text-red-600'}`}>
                {REVENUECAT_CONFIG.apiKey ? '已配置' : '未配置'}
              </span>
            </div>
          </div>
        </div>

        {/* 会员状态 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">会员状态</h2>
          <div className={`inline-flex items-center px-4 py-2 rounded-full ${membershipDisplay.bgColor}`}>
            <span className={`font-medium ${membershipDisplay.color}`}>
              {membershipDisplay.name}
            </span>
          </div>

          {/* 权益状态 */}
          <div className="mt-4">
            <h3 className="font-medium mb-2">当前权益:</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center">
                <span className={`mr-2 ${hasMonthlyPoints1000 ? 'text-green-500' : 'text-gray-400'}`}>
                  {hasMonthlyPoints1000 ? '✓' : '○'}
                </span>
                <span className={hasMonthlyPoints1000 ? 'text-gray-900' : 'text-gray-500'}>
                  1000点/月记账点
                </span>
              </div>
              <div className="flex items-center">
                <span className={`mr-2 ${hasMonthlyPoints1500 ? 'text-green-500' : 'text-gray-400'}`}>
                  {hasMonthlyPoints1500 ? '✓' : '○'}
                </span>
                <span className={hasMonthlyPoints1500 ? 'text-gray-900' : 'text-gray-500'}>
                  1500点/月记账点
                </span>
              </div>
              <div className="flex items-center">
                <span className={`mr-2 ${hasCharityAttribution ? 'text-green-500' : 'text-gray-400'}`}>
                  {hasCharityAttribution ? '✓' : '○'}
                </span>
                <span className={hasCharityAttribution ? 'text-gray-900' : 'text-gray-500'}>
                  公益署名权
                </span>
              </div>
              <div className="flex items-center">
                <span className={`mr-2 ${hasPrioritySupport ? 'text-green-500' : 'text-gray-400'}`}>
                  {hasPrioritySupport ? '✓' : '○'}
                </span>
                <span className={hasPrioritySupport ? 'text-gray-900' : 'text-gray-500'}>
                  优先客服支持
                </span>
              </div>
              <div className="flex items-center">
                <span className={`mr-2 ${hasAiSmartAccounting ? 'text-green-500' : 'text-gray-400'}`}>
                  {hasAiSmartAccounting ? '✓' : '○'}
                </span>
                <span className={hasAiSmartAccounting ? 'text-gray-900' : 'text-gray-500'}>
                  AI智能记账
                </span>
              </div>
              <div className="flex items-center">
                <span className={`mr-2 ${hasAdvancedAnalytics ? 'text-green-500' : 'text-gray-400'}`}>
                  {hasAdvancedAnalytics ? '✓' : '○'}
                </span>
                <span className={hasAdvancedAnalytics ? 'text-gray-900' : 'text-gray-500'}>
                  高级统计分析
                </span>
              </div>
            </div>
          </div>

          {/* 刷新按钮 */}
          <button
            onClick={refreshCustomerInfo}
            disabled={!isInitialized || isLoading}
            className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            {isLoading ? '刷新中...' : '刷新状态'}
          </button>
        </div>

        {/* 可用产品 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">可用产品</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {products.map((product) => (
              <div key={product.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{product.name}</h3>
                  {product.isPopular && (
                    <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded">
                      推荐
                    </span>
                  )}
                </div>
                <p className="text-gray-600 text-sm mb-2">{product.description}</p>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-lg">{product.displayPrice}</span>
                  <span className="text-sm text-gray-500">
                    {product.duration === 'P1M' ? '每月' : '每年'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">操作</h2>
          <div className="space-y-4">
            <button
              onClick={() => setShowPaymentModal(true)}
              disabled={!isMobile || !isInitialized}
              className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!isMobile ? 'App内购买仅在移动端可用' : 
               !isInitialized ? '支付系统未初始化' : 
               '升级会员'}
            </button>

            {!isMobile && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-600 text-sm">
                  💡 要测试App内购买功能，请在iOS或Android设备上运行应用
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-600 text-sm">
                  ❌ 错误: {error}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 支付模态框 */}
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePurchaseSuccess}
        />

        {/* 开发信息 */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-6 bg-gray-100 rounded-lg p-4">
            <h3 className="font-medium mb-2">开发信息</h3>
            <pre className="text-xs overflow-auto">
              {JSON.stringify({
                platform: Capacitor.getPlatform(),
                isNative: isMobile,
                isInitialized,
                membershipLevel,
                hasApiKey: !!REVENUECAT_CONFIG.apiKey,
                environment: process.env.NODE_ENV,
                productCount: products.length
              }, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
