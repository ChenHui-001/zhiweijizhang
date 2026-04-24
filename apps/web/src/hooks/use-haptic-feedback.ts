/**
 * 震动反馈Hook
 * 提供便捷的震动反馈功能，支持不同类型的用户交互
 */

import { useCallback } from 'react';
import {
  haptic,
  recordingHaptics,
  triggerHapticFeedback,
  HapticType,
} from '@/utils/haptic-feedback';

export interface UseHapticFeedbackReturn {
  // 基础震动函数
  light: () => Promise<boolean>;
  medium: () => Promise<boolean>;
  heavy: () => Promise<boolean>;
  success: () => Promise<boolean>;
  warning: () => Promise<boolean>;
  error: () => Promise<boolean>;
  selection: () => Promise<boolean>;

  // 录音专用震动函数
  recording: {
    start: () => Promise<boolean>;
    stop: () => Promise<boolean>;
    cancel: () => Promise<boolean>;
    success: () => Promise<boolean>;
    error: () => Promise<boolean>;
    touch: () => Promise<boolean>;
  };

  // 按钮类型震动函数
  button: {
    primary: () => Promise<boolean>; // 主要按钮（保存、确认等）
    secondary: () => Promise<boolean>; // 次要按钮（取消、返回等）
    destructive: () => Promise<boolean>; // 危险按钮（删除、清空等）
    add: () => Promise<boolean>; // 添加按钮
    edit: () => Promise<boolean>; // 编辑按钮
    submit: () => Promise<boolean>; // 提交按钮
  };

  // 表单操作震动函数
  form: {
    save: () => Promise<boolean>; // 保存表单
    submit: () => Promise<boolean>; // 提交表单
    reset: () => Promise<boolean>; // 重置表单
    validate: () => Promise<boolean>; // 验证失败
  };

  // 导航操作震动函数
  navigation: {
    tab: () => Promise<boolean>; // 切换标签页
    back: () => Promise<boolean>; // 返回操作
    forward: () => Promise<boolean>; // 前进操作
    menu: () => Promise<boolean>; // 菜单操作
  };

  // 自定义震动函数
  custom: (type: HapticType) => Promise<boolean>;
}

/**
 * 震动反馈Hook
 * @param enabled 是否启用震动反馈（默认true）
 * @returns 震动反馈函数集合
 */
export function useHapticFeedback(enabled: boolean = true): UseHapticFeedbackReturn {
  // 创建安全的震动调用函数
  const createSafeHaptic = useCallback(
    (hapticFn: () => Promise<boolean>) => {
      return async () => {
        if (!enabled) return false;

        try {
          return await hapticFn();
        } catch (error) {
          console.warn('🔊 [useHapticFeedback] 震动反馈执行失败:', error);
          return false;
        }
      };
    },
    [enabled],
  );

  // 基础震动函数
  const light = useCallback(() => haptic.light(), []);
  const medium = useCallback(() => haptic.medium(), []);
  const heavy = useCallback(() => haptic.heavy(), []);
  const success = useCallback(() => haptic.success(), []);
  const warning = useCallback(() => haptic.warning(), []);
  const error = useCallback(() => haptic.error(), []);
  const selection = useCallback(() => haptic.selection(), []);

  // 录音专用震动函数
  const recording = {
    start: useCallback(() => recordingHaptics.start(), []),
    stop: useCallback(() => recordingHaptics.stop(), []),
    cancel: useCallback(() => recordingHaptics.cancel(), []),
    success: useCallback(() => recordingHaptics.success(), []),
    error: useCallback(() => recordingHaptics.error(), []),
    touch: useCallback(() => recordingHaptics.touch(), []),
  };

  // 按钮类型震动函数
  const button = {
    primary: useCallback(() => haptic.medium(), []), // 主要按钮使用中等震动
    secondary: useCallback(() => haptic.light(), []), // 次要按钮使用轻微震动
    destructive: useCallback(() => haptic.warning(), []), // 危险按钮使用警告震动
    add: useCallback(() => haptic.light(), []), // 添加按钮使用轻微震动
    edit: useCallback(() => haptic.light(), []), // 编辑按钮使用轻微震动
    submit: useCallback(() => haptic.medium(), []), // 提交按钮使用中等震动
  };

  // 表单操作震动函数
  const form = {
    save: useCallback(() => haptic.success(), []), // 保存成功使用成功震动
    submit: useCallback(() => haptic.medium(), []), // 提交使用中等震动
    reset: useCallback(() => haptic.warning(), []), // 重置使用警告震动
    validate: useCallback(() => haptic.error(), []), // 验证失败使用错误震动
  };

  // 导航操作震动函数
  const navigation = {
    tab: useCallback(() => haptic.selection(), []), // 标签切换使用选择震动
    back: useCallback(() => haptic.light(), []), // 返回使用轻微震动
    forward: useCallback(() => haptic.light(), []), // 前进使用轻微震动
    menu: useCallback(() => haptic.light(), []), // 菜单使用轻微震动
  };

  // 自定义震动函数
  const custom = useCallback((type: HapticType) => {
    return triggerHapticFeedback(type);
  }, []);

  return {
    // 基础震动函数（包装为安全调用）
    light: createSafeHaptic(light),
    medium: createSafeHaptic(medium),
    heavy: createSafeHaptic(heavy),
    success: createSafeHaptic(success),
    warning: createSafeHaptic(warning),
    error: createSafeHaptic(error),
    selection: createSafeHaptic(selection),

    // 录音专用震动函数（包装为安全调用）
    recording: {
      start: createSafeHaptic(recording.start),
      stop: createSafeHaptic(recording.stop),
      cancel: createSafeHaptic(recording.cancel),
      success: createSafeHaptic(recording.success),
      error: createSafeHaptic(recording.error),
      touch: createSafeHaptic(recording.touch),
    },

    // 按钮类型震动函数（包装为安全调用）
    button: {
      primary: createSafeHaptic(button.primary),
      secondary: createSafeHaptic(button.secondary),
      destructive: createSafeHaptic(button.destructive),
      add: createSafeHaptic(button.add),
      edit: createSafeHaptic(button.edit),
      submit: createSafeHaptic(button.submit),
    },

    // 表单操作震动函数（包装为安全调用）
    form: {
      save: createSafeHaptic(form.save),
      submit: createSafeHaptic(form.submit),
      reset: createSafeHaptic(form.reset),
      validate: createSafeHaptic(form.validate),
    },

    // 导航操作震动函数（包装为安全调用）
    navigation: {
      tab: createSafeHaptic(navigation.tab),
      back: createSafeHaptic(navigation.back),
      forward: createSafeHaptic(navigation.forward),
      menu: createSafeHaptic(navigation.menu),
    },

    // 自定义震动函数（包装为安全调用）
    custom: async (type: HapticType) => {
      if (!enabled) return false;
      try {
        return await custom(type);
      } catch (error) {
        console.warn('🔊 [useHapticFeedback] 震动反馈执行失败:', error);
        return false;
      }
    },
  };
}

/**
 * 为按钮点击事件添加震动反馈的高阶函数
 * @param onClick 原始点击事件处理函数
 * @param hapticType 震动类型
 * @param enabled 是否启用震动反馈
 * @returns 包装后的点击事件处理函数
 */
export function withHapticFeedback<T extends (...args: any[]) => any>(
  onClick: T,
  hapticType: keyof UseHapticFeedbackReturn['button'] = 'primary',
  enabled: boolean = true,
): T {
  const { button } = useHapticFeedback(enabled);

  return ((...args: Parameters<T>) => {
    // 先触发震动反馈
    button[hapticType]();

    // 然后执行原始点击事件
    return onClick(...args);
  }) as T;
}

/**
 * 为表单提交添加震动反馈的高阶函数
 * @param onSubmit 原始提交事件处理函数
 * @param enabled 是否启用震动反馈
 * @returns 包装后的提交事件处理函数
 */
export function withFormHapticFeedback<T extends (...args: any[]) => any>(
  onSubmit: T,
  enabled: boolean = true,
): T {
  const { form } = useHapticFeedback(enabled);

  return ((...args: Parameters<T>) => {
    // 先触发提交震动反馈
    form.submit();

    // 然后执行原始提交事件
    return onSubmit(...args);
  }) as T;
}

/**
 * 震动反馈配置类型
 */
export interface HapticConfig {
  enabled: boolean;
  buttonFeedback: boolean;
  formFeedback: boolean;
  navigationFeedback: boolean;
  recordingFeedback: boolean;
}

/**
 * 默认震动反馈配置
 */
export const defaultHapticConfig: HapticConfig = {
  enabled: true,
  buttonFeedback: true,
  formFeedback: true,
  navigationFeedback: true,
  recordingFeedback: true,
};

/**
 * 根据配置创建震动反馈Hook
 * @param config 震动反馈配置
 * @returns 震动反馈函数集合
 */
export function useConfiguredHapticFeedback(
  config: Partial<HapticConfig> = {},
): UseHapticFeedbackReturn {
  const finalConfig = { ...defaultHapticConfig, ...config };
  return useHapticFeedback(finalConfig.enabled);
}
