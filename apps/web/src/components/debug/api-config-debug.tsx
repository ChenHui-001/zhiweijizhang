'use client';

import { useState, useEffect } from 'react';

// 检查是否为Docker环境
const isDockerEnvironment = (): boolean => {
  // 检查环境变量
  if (process.env.DOCKER_ENV === 'true' || (process.env.NODE_ENV as string) === 'docker') {
    return true;
  }

  // 在浏览器环境中检测
  if (typeof window !== 'undefined') {
    // 检查是否设置了Docker环境标记
    const isDocker = (window as any).__DOCKER_ENV__ === true || process.env.DOCKER_ENV === 'true';

    // 检查主机名是否为Docker内部网络
    const hostname = window.location.hostname;
    const isLocalDev =
      hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('192.168');

    // 只有明确设置了Docker环境变量且不是本地开发环境时才认为是Docker
    return isDocker && !isLocalDev;
  }

  return false;
};

// 获取当前API基础URL
const getApiBaseUrl = (): string => {
  // 在服务端渲染时，返回默认值
  if (typeof window === 'undefined') {
    return '/api';
  }

  try {
    // 如果是Docker环境，直接使用相对路径
    if (isDockerEnvironment()) {
      return '/api';
    }

    // 直接从LocalStorage读取服务器配置
    const storedConfig = localStorage.getItem('server-config-storage');
    if (storedConfig) {
      try {
        const parsedConfig = JSON.parse(storedConfig);
        const apiUrl = parsedConfig?.state?.config?.currentUrl || 'https://app.zhiweijz.cn:1443/api';
        return apiUrl;
      } catch (parseError) {
        console.warn('⚠️ 解析服务器配置失败:', parseError);
      }
    }

    // 回退到默认官方服务器
    const defaultUrl = 'https://app.zhiweijz.cn:1443/api';
    return defaultUrl;
  } catch (error) {
    console.warn('⚠️ 获取服务器配置失败，使用默认值:', error);
    return '/api';
  }
};

export default function ApiConfigDebug() {
  const [config, setConfig] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    if (typeof window !== 'undefined') {
      const storedConfig = localStorage.getItem('server-config-storage');
      const parsedConfig = storedConfig ? JSON.parse(storedConfig) : null;

      const debugInfo = {
        isDockerEnv: isDockerEnvironment(),
        currentApiUrl: getApiBaseUrl(),
        hostname: window.location.hostname,
        dockerEnvVar: process.env.DOCKER_ENV,
        nodeEnv: process.env.NODE_ENV,
        windowDockerEnv: (window as any).__DOCKER_ENV__,
        storedConfig: parsedConfig,
      };

      setConfig(debugInfo);
      console.log('🔍 API配置调试信息:', debugInfo);
    }
  }, []);

  if (!mounted) {
    return <div>正在加载调试信息...</div>;
  }

  return (
    <div className="p-4 bg-gray-100 rounded-lg text-sm font-mono">
      <h3 className="font-bold mb-2">API配置调试信息</h3>
      <div className="space-y-1">
        <div>
          <strong>是否Docker环境:</strong> {config?.isDockerEnv ? '是' : '否'}
        </div>
        <div>
          <strong>当前API URL:</strong> {config?.currentApiUrl}
        </div>
        <div>
          <strong>主机名:</strong> {config?.hostname}
        </div>
        <div>
          <strong>DOCKER_ENV变量:</strong> {config?.dockerEnvVar || '未设置'}
        </div>
        <div>
          <strong>NODE_ENV:</strong> {config?.nodeEnv}
        </div>
        <div>
          <strong>Window Docker标记:</strong> {config?.windowDockerEnv ? '是' : '否'}
        </div>
        <div>
          <strong>存储的配置:</strong>
          <pre className="mt-1 p-2 bg-white rounded text-xs overflow-auto">
            {JSON.stringify(config?.storedConfig, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
