/**
 * 平台权限管理
 * 处理相机、相册等权限请求
 */

/**
 * 权限状态
 */
export type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'unavailable';

/**
 * 权限结果
 */
export interface PermissionResult {
  status: PermissionStatus;
  message?: string;
}

/**
 * 检查Capacitor权限
 */
async function checkCapacitorPermission(permission: string): Promise<PermissionResult> {
  try {
    console.log(`🔐 [PermissionCheck] 开始检查${permission}权限...`);

    if (typeof window === 'undefined' || !(window as any).Capacitor) {
      console.log('🔐 [PermissionCheck] Capacitor不可用');
      return { status: 'unavailable', message: 'Capacitor不可用' };
    }

    const { Capacitor } = window as any;
    console.log('🔐 [PermissionCheck] Capacitor环境信息:', {
      platform: Capacitor.getPlatform?.(),
      isNative: Capacitor.isNativePlatform?.(),
    });

    // 动态导入Capacitor Camera
    console.log('🔐 [PermissionCheck] 正在导入Camera模块...');
    const capacitorCamera = await import('@capacitor/camera').catch((importError) => {
      console.error('🔐 [PermissionCheck] Camera模块导入失败:', importError);
      return null;
    });

    if (!capacitorCamera) {
      console.error('🔐 [PermissionCheck] Camera模块不可用');
      return { status: 'unavailable', message: 'Capacitor Camera插件不可用' };
    }

    const { Camera } = capacitorCamera;
    console.log('🔐 [PermissionCheck] Camera模块导入成功，检查权限...');

    if (!Camera || typeof Camera.checkPermissions !== 'function') {
      console.error('🔐 [PermissionCheck] Camera.checkPermissions方法不可用');
      return { status: 'unavailable', message: 'Camera权限检查方法不可用' };
    }

    const result = await Camera.checkPermissions();
    console.log('🔐 [PermissionCheck] 权限检查结果:', result);

    if (permission === 'camera') {
      const status = result.camera as PermissionStatus;
      console.log(`🔐 [PermissionCheck] 相机权限状态: ${status}`);
      return {
        status,
        message: status === 'denied' ? '相机权限被拒绝' : undefined,
      };
    } else if (permission === 'photos') {
      const status = result.photos as PermissionStatus;
      console.log(`🔐 [PermissionCheck] 相册权限状态: ${status}`);
      return {
        status,
        message: status === 'denied' ? '相册权限被拒绝' : undefined,
      };
    }

    console.log(`🔐 [PermissionCheck] 未知权限类型: ${permission}`);
    return { status: 'unavailable' };
  } catch (error) {
    console.error('🔐 [PermissionCheck] 检查Capacitor权限失败:', error);
    return {
      status: 'unavailable',
      message: `权限检查失败: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}

/**
 * 请求Capacitor权限
 */
async function requestCapacitorPermission(permission: string): Promise<PermissionResult> {
  try {
    console.log(`🔐 [PermissionRequest] 开始请求${permission}权限...`);

    if (typeof window === 'undefined' || !(window as any).Capacitor) {
      console.log('🔐 [PermissionRequest] Capacitor不可用');
      return { status: 'unavailable', message: 'Capacitor不可用' };
    }

    const { Capacitor } = window as any;
    console.log('🔐 [PermissionRequest] Capacitor环境信息:', {
      platform: Capacitor.getPlatform?.(),
      isNative: Capacitor.isNativePlatform?.(),
    });

    // 动态导入Capacitor Camera
    console.log('🔐 [PermissionRequest] 正在导入Camera模块...');
    const capacitorCamera = await import('@capacitor/camera').catch((importError) => {
      console.error('🔐 [PermissionRequest] Camera模块导入失败:', importError);
      return null;
    });

    if (!capacitorCamera) {
      console.error('🔐 [PermissionRequest] Camera模块不可用');
      return { status: 'unavailable', message: 'Capacitor Camera插件不可用' };
    }

    const { Camera } = capacitorCamera;
    console.log('🔐 [PermissionRequest] Camera模块导入成功，请求权限...');

    if (!Camera || typeof Camera.requestPermissions !== 'function') {
      console.error('🔐 [PermissionRequest] Camera.requestPermissions方法不可用');
      return { status: 'unavailable', message: 'Camera权限请求方法不可用' };
    }

    const result = await Camera.requestPermissions({
      permissions: [permission as any],
    });
    console.log('🔐 [PermissionRequest] 权限请求结果:', result);

    if (permission === 'camera') {
      const status = result.camera as PermissionStatus;
      console.log(`🔐 [PermissionRequest] 相机权限请求结果: ${status}`);
      return {
        status,
        message: status === 'denied' ? '用户拒绝了相机权限' : undefined,
      };
    } else if (permission === 'photos') {
      const status = result.photos as PermissionStatus;
      console.log(`🔐 [PermissionRequest] 相册权限请求结果: ${status}`);
      return {
        status,
        message: status === 'denied' ? '用户拒绝了相册权限' : undefined,
      };
    }

    console.log(`🔐 [PermissionRequest] 未知权限类型: ${permission}`);
    return { status: 'unavailable' };
  } catch (error) {
    console.error('🔐 [PermissionRequest] 请求Capacitor权限失败:', error);
    return {
      status: 'denied',
      message: `权限请求失败: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}

/**
 * 检查Web权限
 */
async function checkWebPermission(permission: string): Promise<PermissionResult> {
  try {
    if (!navigator.permissions) {
      return { status: 'unavailable', message: '浏览器不支持权限API' };
    }

    const result = await navigator.permissions.query({ name: permission as any });
    return { status: result.state as PermissionStatus };
  } catch (error) {
    console.error('检查Web权限失败:', error);
    return { status: 'unavailable', message: '权限检查失败' };
  }
}

/**
 * 平台权限管理器
 */
export class PlatformPermissions {
  private static instance: PlatformPermissions;
  private isCapacitor = !!(typeof window !== 'undefined' && (window as any).Capacitor);

  static getInstance(): PlatformPermissions {
    if (!PlatformPermissions.instance) {
      PlatformPermissions.instance = new PlatformPermissions();
    }
    return PlatformPermissions.instance;
  }

  /**
   * 检查相机权限
   */
  async checkCameraPermission(): Promise<PermissionResult> {
    if (this.isCapacitor) {
      return await checkCapacitorPermission('camera');
    } else {
      return await checkWebPermission('camera');
    }
  }

  /**
   * 请求相机权限
   */
  async requestCameraPermission(): Promise<PermissionResult> {
    if (this.isCapacitor) {
      return await requestCapacitorPermission('camera');
    } else {
      // Web端通常在使用时自动请求权限
      return { status: 'prompt', message: '将在使用时请求权限' };
    }
  }

  /**
   * 检查相册权限
   */
  async checkPhotosPermission(): Promise<PermissionResult> {
    if (this.isCapacitor) {
      return await checkCapacitorPermission('photos');
    } else {
      // Web端相册访问通常不需要特殊权限
      return { status: 'granted' };
    }
  }

  /**
   * 请求相册权限
   */
  async requestPhotosPermission(): Promise<PermissionResult> {
    if (this.isCapacitor) {
      return await requestCapacitorPermission('photos');
    } else {
      return { status: 'granted' };
    }
  }

  /**
   * 检查并请求权限（如果需要）
   */
  async ensurePermission(type: 'camera' | 'photos'): Promise<PermissionResult> {
    let checkResult: PermissionResult;

    if (type === 'camera') {
      checkResult = await this.checkCameraPermission();
    } else {
      checkResult = await this.checkPhotosPermission();
    }

    // 如果权限已授予，直接返回
    if (checkResult.status === 'granted') {
      return checkResult;
    }

    // 如果需要请求权限
    if (checkResult.status === 'prompt') {
      if (type === 'camera') {
        return await this.requestCameraPermission();
      } else {
        return await this.requestPhotosPermission();
      }
    }

    // 其他情况直接返回检查结果
    return checkResult;
  }

  /**
   * 显示权限说明对话框
   */
  showPermissionDialog(type: 'camera' | 'photos', result: PermissionResult): void {
    if (result.status === 'denied') {
      const isIOS = this.isCapacitor && (window as any).Capacitor?.getPlatform?.() === 'ios';

      let message: string;
      let settingsPath: string;

      if (type === 'camera') {
        message = '需要相机权限才能拍照。';
        settingsPath = isIOS ? '设置 → 只为记账 → 相机' : '设置 → 应用权限 → 只为记账 → 相机';
      } else {
        message = '需要相册权限才能选择图片。';
        settingsPath = isIOS ? '设置 → 只为记账 → 照片' : '设置 → 应用权限 → 只为记账 → 存储';
      }

      const fullMessage = `${message}\n\n请在手机设置中开启权限：\n${settingsPath}`;

      // 使用更友好的提示方式
      if (typeof window !== 'undefined' && window.confirm) {
        const shouldOpenSettings = window.confirm(`${fullMessage}\n\n是否现在前往设置？`);
        if (shouldOpenSettings && this.isCapacitor) {
          // 尝试打开应用设置页面
          this.openAppSettings();
        }
      } else {
        alert(fullMessage);
      }
    }
  }

  /**
   * 打开应用设置页面
   */
  private async openAppSettings(): Promise<void> {
    try {
      if (this.isCapacitor) {
        const { App } = await import('@capacitor/app');
        const appAny = App as any;
        if (appAny && typeof appAny.openSettings === 'function') {
          await appAny.openSettings();
        }
      }
    } catch (error) {
      console.error('🔐 [OpenSettings] 无法打开设置页面:', error);
    }
  }
}

/**
 * 便捷的导出实例
 */
export const platformPermissions = PlatformPermissions.getInstance();
