import { Capacitor } from '@capacitor/core';

/**
 * SSL配置接口
 */
interface SSLConfigPlugin {
  showSSLWarning(options: { url: string; message: string }): Promise<{ allowed: boolean; message: string }>;
  configurePermissiveSSL(): Promise<{ success: boolean; message: string }>;
  restoreDefaultSSL(): Promise<{ success: boolean; message: string }>;
  getSSLStatus(): Promise<{ isPermissive: boolean; message: string }>;
}

/**
 * SSL配置服务类
 */
class SSLConfigService {
  private plugin: SSLConfigPlugin | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // 延迟初始化插件，确保Capacitor已经加载
    this.initializePlugin();
  }

  private async initializePlugin(): Promise<void> {
    // 避免重复初始化
    if (this.isInitialized || this.initPromise) {
      return this.initPromise || Promise.resolve();
    }

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      // 等待Capacitor准备就绪
      if ((window as any).Capacitor) {
        const platform = Capacitor.getPlatform();
        
        if (platform === 'ios' || platform === 'android') {
          this.plugin = (window as any).Capacitor?.Plugins?.SSLConfig as SSLConfigPlugin || null;
          this.isInitialized = true;
          console.log('✅ [SSLConfig] 插件初始化成功:', platform);
        } else {
          console.log('🌐 [SSLConfig] Web平台，跳过插件初始化:', platform);
          this.isInitialized = true;
        }
      } else {
        console.warn('⚠️ [SSLConfig] Capacitor未准备就绪');
      }
    } catch (error) {
      console.warn('⚠️ [SSLConfig] 插件初始化失败:', error);
      this.isInitialized = true; // 标记为已尝试初始化，避免无限重试
    }
  }

  /**
   * 显示SSL警告对话框
   */
  async showSSLWarning(url: string, message: string): Promise<boolean> {
    // 确保插件已初始化
    await this.initializePlugin();

    if (!this.plugin) {
      console.warn('🌐 [SSLConfig] 插件未可用，直接允许连接');
      return true;
    }

    try {
      const result = await this.plugin.showSSLWarning({ url, message });
      return result.allowed;
    } catch (error) {
      console.error('❌ [SSLConfig] 显示SSL警告失败:', error);
      return false;
    }
  }

  /**
   * 配置宽松的SSL设置
   */
  async configurePermissiveSSL(): Promise<boolean> {
    // 确保插件已初始化
    await this.initializePlugin();

    if (!this.plugin) {
      console.warn('🌐 [SSLConfig] 插件未可用，跳过SSL配置');
      return true;
    }

    try {
      const result = await this.plugin.configurePermissiveSSL();
      console.log('✅ [SSLConfig]', result.message);
      return result.success;
    } catch (error) {
      console.error('❌ [SSLConfig] 配置宽松SSL失败:', error);
      return false;
    }
  }

  /**
   * 恢复默认SSL设置
   */
  async restoreDefaultSSL(): Promise<boolean> {
    // 确保插件已初始化
    await this.initializePlugin();

    if (!this.plugin) {
      console.warn('🌐 [SSLConfig] 插件未可用，跳过SSL配置');
      return true;
    }

    try {
      const result = await this.plugin.restoreDefaultSSL();
      console.log('✅ [SSLConfig]', result.message);
      return result.success;
    } catch (error) {
      console.error('❌ [SSLConfig] 恢复默认SSL失败:', error);
      return false;
    }
  }

  /**
   * 获取SSL配置状态
   */
  async getSSLStatus(): Promise<{ isPermissive: boolean; message: string }> {
    // 确保插件已初始化
    await this.initializePlugin();

    if (!this.plugin) {
      return {
        isPermissive: false, // 默认安全模式
        message: 'Web平台默认安全模式'
      };
    }

    try {
      return await this.plugin.getSSLStatus();
    } catch (error) {
      console.error('❌ [SSLConfig] 获取SSL状态失败:', error);
      return {
        isPermissive: false, // 出错时默认安全模式
        message: '获取SSL状态失败，使用安全模式'
      };
    }
  }

  /**
   * 检查是否为原生平台
   */
  isNativePlatform(): boolean {
    const platform = Capacitor.getPlatform();
    const isNative = platform === 'ios' || platform === 'android';
    console.log('🔍 [SSLConfig] 平台检测:', { 
      platform, 
      isNative, 
      capacitorNative: Capacitor.isNativePlatform() 
    });
    return isNative;
  }

  /**
   * 获取当前平台名称
   */
  getPlatform(): string {
    return Capacitor.getPlatform();
  }
}

// 导出单例实例
export const sslConfigService = new SSLConfigService();

// 导出类型
export type { SSLConfigPlugin };