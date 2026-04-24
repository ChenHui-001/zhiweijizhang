'use client';

// @ts-ignore - @zhiweijz/core module declarations in zhiweijz-modules.d.ts
import { createOnboardingStore } from '@zhiweijz/core';
// @ts-ignore - @zhiweijz/web module declarations in zhiweijz-modules.d.ts
import { LocalStorageAdapter } from '@zhiweijz/web';

// 创建存储适配器
const storage = new LocalStorageAdapter();

// 使用标准版本的 store
export const useOnboardingStore = createOnboardingStore(storage);
