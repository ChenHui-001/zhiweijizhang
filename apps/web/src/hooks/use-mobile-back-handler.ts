/**
 * 移动端后退处理Hook
 * 统一处理Android/iOS的后退逻辑
 */

import { useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useNavigationStore, navigationManager, PageLevel } from '@/lib/mobile-navigation';
import { platformGestureHandler } from '@/lib/platform-gesture-handler';

interface BackHandlerOptions {
  // 是否启用硬件后退按钮处理
  enableHardwareBack?: boolean;
  // 是否启用浏览器历史后退处理
  enableBrowserBack?: boolean;
  // 自定义后退处理函数
  onBack?: () => boolean;
  // 是否阻止默认后退行为
  preventDefault?: boolean;
  // 页面ID（用于识别当前页面）
  pageId?: string;
  // 页面层级
  pageLevel?: PageLevel;
}

export function useMobileBackHandler(options: BackHandlerOptions = {}) {
  const {
    enableHardwareBack = true,
    enableBrowserBack = true,
    onBack,
    preventDefault = true,
    pageId,
    pageLevel = PageLevel.FEATURE,
  } = options;

  const router = useRouter();
  const navigationState = useNavigationStore();
  const backHandlerRef = useRef<(() => boolean) | null>(null);
  const isHandlingBackRef = useRef(false);

  // 注册页面到导航管理器（仅在没有自动注册的情况下）
  useEffect(() => {
    if (pageId && typeof window !== 'undefined') {
      const currentPath = window.location.pathname;

      // 检查是否已经有页面注册了
      const state = navigationManager.getNavigationState();
      const isAlreadyRegistered =
        state.currentPage?.path === currentPath ||
        state.modalStack.some(modal => modal.path === currentPath);

      if (!isAlreadyRegistered) {
        navigationManager.navigateToPage({
          id: pageId,
          level: pageLevel,
          title: document.title || pageId,
          path: currentPath,
          canGoBack: pageLevel !== PageLevel.DASHBOARD,
        });

        // 日志已精简
      } else {
        // 日志已精简
      }
    }
  }, [pageId, pageLevel]);

  // 统一的后退处理逻辑
  const handleBack = useCallback((): boolean => {
    // 防止重复处理
    if (isHandlingBackRef.current) {
      console.log('📱 [BackHandler] 跳过重复处理');
      return true;
    }

    isHandlingBackRef.current = true;

    try {
      console.log('📱 [BackHandler] 开始处理后退');

      // 1. 优先执行自定义后退处理
      if (onBack) {
        const customResult = onBack();
        console.log('📱 [BackHandler] 自定义处理结果:', customResult);
        if (customResult) {
          return true; // 自定义处理成功，阻止默认行为
        }
      }

      // 2. 使用导航管理器处理后退
      const navigationResult = navigationManager.handleBackAction();
      console.log('📱 [BackHandler] 导航管理器处理结果:', navigationResult);

      if (navigationResult) {
        // 导航管理器成功处理了后退
        const state = navigationManager.getNavigationState();

        console.log('📱 [BackHandler] 导航状态详情:', {
          modalStackLength: state.modalStack.length,
          pageStackLength: state.pageStack.length,
          currentPage: state.currentPage,
          canGoBack: state.canGoBack
        });

        // 根据当前状态决定路由跳转
        if (state.modalStack.length > 0) {
          // 还有模态框，不需要路由跳转
          console.log('📱 [BackHandler] 关闭模态框，保持当前路由');
        } else if (state.currentPage) {
          // 跳转到当前页面
          console.log('📱 [BackHandler] 准备跳转到页面:', state.currentPage.path);

          // 检查当前路径是否与目标路径不同
          const currentPath = window.location.pathname;
          if (currentPath !== state.currentPage.path) {
            const targetPath = state.currentPage.path;
            // 使用replace而不是push，避免历史记录混乱
            setTimeout(() => {
              console.log('📱 [BackHandler] 执行路由跳转:', targetPath);
              router.replace(targetPath);
            }, 50); // 稍微延迟确保状态更新完成
          } else {
            console.log('📱 [BackHandler] 已在目标页面，无需跳转');
          }
        } else {
          // 返回仪表盘
          console.log('📱 [BackHandler] 返回仪表盘');
          setTimeout(() => {
            console.log('📱 [BackHandler] 执行跳转到仪表盘');
            router.replace('/dashboard');
          }, 50);
        }

        return true;
      }

      // 3. 检查是否可以退出应用
      if (navigationState.canExitApp()) {
        console.log('📱 [BackHandler] 可以退出应用');

        // 在移动端环境中，尝试退出应用
        if (navigationState.isMobile && typeof window !== 'undefined') {
          const capacitor = (window as any).Capacitor;
          if (capacitor?.Plugins?.App) {
            console.log('📱 [BackHandler] 使用Capacitor退出应用');
            capacitor.Plugins.App.exitApp();
            return true;
          }
        }

        // Web环境或无法退出应用时，允许默认行为
        console.log('📱 [BackHandler] 允许默认后退行为');
        return false;
      }

      // 4. 默认情况：阻止后退
      console.log('📱 [BackHandler] 阻止默认后退行为');
      return true;
    } finally {
      // 延迟重置标志，避免快速连续触发
      setTimeout(() => {
        isHandlingBackRef.current = false;
      }, 100);
    }
  }, [onBack, router, navigationState]);

  // 处理硬件后退按钮（Android） - 只在组件挂载时创建一次
  useEffect(() => {
    if (!enableHardwareBack || typeof window === 'undefined') return;

    const capacitor = (window as any).Capacitor;
    if (!capacitor?.Plugins?.App) return;

    let backButtonListener: any = null;
    let isComponentMounted = true;

    const setupListener = async () => {
      try {
        backButtonListener = await capacitor.Plugins.App.addListener('backButton', (data: any) => {
          if (!isComponentMounted) return; // 检查组件是否还挂载

          console.log('📱 [BackHandler] 硬件后退按钮触发:', data);

          // 使用ref获取最新的handleBack函数
          const currentHandleBack = backHandlerRef.current;
          if (currentHandleBack) {
            const handled = currentHandleBack();
            console.log('📱 [BackHandler] 硬件后退处理结果:', handled);

            // 如果没有处理，允许默认行为
            if (!handled && !preventDefault) {
              console.log('📱 [BackHandler] 执行默认硬件后退');
            }
          }
        });

        console.log('📱 [BackHandler] 注册硬件后退监听器');
      } catch (error) {
        console.error('📱 [BackHandler] 硬件后退监听器注册失败:', error);
      }
    };

    setupListener();

    return () => {
      isComponentMounted = false;
      console.log('📱 [BackHandler] 移除硬件后退监听器');

      if (backButtonListener) {
        try {
          // 检查监听器对象是否有remove方法
          if (typeof backButtonListener.remove === 'function') {
            backButtonListener.remove();
          } else if (typeof backButtonListener === 'function') {
            // 如果监听器本身就是一个移除函数
            backButtonListener();
          } else {
            console.warn('📱 [BackHandler] 监听器对象没有remove方法:', backButtonListener);
          }
        } catch (error) {
          console.error('📱 [BackHandler] 移除硬件后退监听器失败:', error);
        }
        backButtonListener = null;
      }
    };
  }, []); // 移除依赖，只在挂载时创建一次

  // 处理浏览器历史后退 - 只在组件挂载时创建一次
  useEffect(() => {
    if (!enableBrowserBack || typeof window === 'undefined') return;

    let isComponentMounted = true;

    const handlePopState = (event: PopStateEvent) => {
      if (!isComponentMounted) return; // 检查组件是否还挂载

      console.log('📱 [BackHandler] 浏览器历史后退触发:', event);

      // 检查当前路径，如果是认证相关路径或根路径，不拦截
      const currentPath = window.location.pathname;
      const isAuthPath = currentPath.startsWith('/auth/');
      const isRootPath = currentPath === '/';

      if (isAuthPath || isRootPath) {
        console.log('📱 [BackHandler] 认证/根路径，允许默认历史行为:', currentPath);
        return; // 不阻止默认行为，允许正常的路由跳转
      }

      if (preventDefault) {
        try {
          event.preventDefault();

          // 使用ref获取最新的handleBack函数
          const currentHandleBack = backHandlerRef.current;
          if (currentHandleBack) {
            const handled = currentHandleBack();
            console.log('📱 [BackHandler] 浏览器后退处理结果:', handled);

            if (!handled) {
              // 如果没有处理成功，恢复历史状态
              console.log('📱 [BackHandler] 恢复历史状态');
              window.history.pushState(null, '', window.location.href);
            }
          }
        } catch (error) {
          console.error('📱 [BackHandler] 浏览器后退处理失败:', error);
        }
      }
    };

    // 只在非认证页面添加历史状态拦截
    const currentPath = window.location.pathname;
    const isAuthPath = currentPath.startsWith('/auth/');
    const isRootPath = currentPath === '/';

    if (!isAuthPath && !isRootPath) {
      try {
        // 添加一个历史状态，用于拦截后退
        window.history.pushState(null, '', window.location.href);
        console.log('📱 [BackHandler] 为非认证页面添加历史状态拦截');
      } catch (error) {
        console.error('📱 [BackHandler] 添加历史状态失败:', error);
      }
    }

    window.addEventListener('popstate', handlePopState, { passive: false });
    // 日志已精简

    return () => {
      isComponentMounted = false;
      // 日志已精简
      window.removeEventListener('popstate', handlePopState);
    };
  }, []); // 移除依赖，只在挂载时创建一次

  // 注册手势监听器
  useEffect(() => {
    const gestureListener = (direction: 'left' | 'right') => {
      if (direction === 'left') {
        console.log('📱 [BackHandler] 收到手势监听器调用，页面层级:', pageLevel);
        return handleBack();
      }
      return false;
    };

    platformGestureHandler.addGestureListener(gestureListener, pageLevel);
    // 日志已精简：手势监听器注册/移除太频繁

    return () => {
      platformGestureHandler.removeGestureListener(gestureListener);
      // 日志已精简：手势监听器注册/移除太频繁
    };
  }, [handleBack, pageLevel]);

  // 存储当前的后退处理函数引用
  backHandlerRef.current = handleBack;

  // 返回手动触发后退的函数
  const triggerBack = useCallback(() => {
    return handleBack();
  }, [handleBack]);

  return {
    // 手动触发后退
    goBack: triggerBack,
    // 当前是否可以后退
    canGoBack: navigationState.canGoBack,
    // 当前页面层级
    currentLevel: navigationState.getCurrentLevel(),
    // 是否可以退出应用
    canExitApp: navigationState.canExitApp(),
    // 导航状态
    navigationState: {
      pageStack: navigationState.pageStack,
      modalStack: navigationState.modalStack,
      currentPage: navigationState.currentPage,
    },
  };
}

// 全局后退处理器（用于没有特定页面上下文的场景）
export function useGlobalBackHandler() {
  return useMobileBackHandler({
    enableHardwareBack: true,
    enableBrowserBack: true,
    preventDefault: true,
  });
}

// 模态框后退处理器
export function useModalBackHandler(modalId: string, onClose?: () => void) {
  const navigationState = useNavigationStore();
  const isModalOpenRef = useRef(true);
  const isInitializedRef = useRef(false);

  const closeModal = useCallback(() => {
    console.log('📱 [ModalBackHandler] 关闭模态框:', modalId);

    // 标记模态框已关闭
    isModalOpenRef.current = false;

    // 从导航管理器中移除模态框
    const removedModal = navigationManager.closeModal();

    // 执行关闭回调
    if (onClose) {
      onClose();
    }

    return true; // 表示已处理
  }, [modalId, onClose]);

  // 注册模态框到导航管理器
  useEffect(() => {
    navigationManager.openModal({
      id: modalId,
      level: PageLevel.MODAL,
      title: modalId,
      path: window.location.pathname,
      canGoBack: true,
    });

    isModalOpenRef.current = true;
    console.log('📱 [ModalBackHandler] 注册模态框:', modalId);

    // 延迟设置初始化标志，确保导航状态更新完成
    const timeoutId = setTimeout(() => {
      isInitializedRef.current = true;
    }, 200);

    return () => {
      clearTimeout(timeoutId);
      // 组件卸载时自动关闭模态框
      if (isModalOpenRef.current) {
        navigationManager.closeModal();
        console.log('📱 [ModalBackHandler] 自动关闭模态框:', modalId);
      }
    };
  }, [modalId]);

  // 监听导航状态变化，如果模态框被外部弹出，自动关闭组件
  useEffect(() => {
    // 只有在初始化完成后才检查状态变化
    if (!isInitializedRef.current) {
      return;
    }

    const currentModal = navigationState.modalStack.find(modal => modal.id === modalId);

    // 如果模态框不在栈中，但组件认为它应该打开，说明被外部关闭了
    if (!currentModal && isModalOpenRef.current) {
      console.log('📱 [ModalBackHandler] 检测到模态框被外部关闭:', modalId);
      isModalOpenRef.current = false;

      // 延迟执行关闭回调，确保导航状态更新完成
      setTimeout(() => {
        if (onClose) {
          onClose();
        }
      }, 0);
    }
  }, [navigationState.modalStack, modalId, onClose]);

  return useMobileBackHandler({
    enableHardwareBack: true,
    enableBrowserBack: true,
    onBack: closeModal,
    preventDefault: true,
    pageId: modalId,
    pageLevel: PageLevel.MODAL,
  });
}
