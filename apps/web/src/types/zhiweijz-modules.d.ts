/**
 * Type declarations for @zhiweijz/core and @zhiweijz/web modules
 * These declarations bridge the gap when the packages are referenced
 * via path aliases but TypeScript can't resolve them directly.
 */

declare module '@zhiweijz/core' {
  // 引导步骤类型
  export type OnboardingStep =
    | 'account-type'
    | 'invite-code-display'
    | 'custodial-member-setup'
    | 'budget-setup'
    | 'theme-selection'
    | 'ai-service-setup'
    | 'feature-intro';

  // 账本类型选择
  export type AccountType = 'personal' | 'family';

  // 家庭操作类型
  export type FamilyAction = 'create' | 'join';

  // 存储适配器接口
  export interface StorageAdapter {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }

  // 托管成员类型
  export interface CustodialMember {
    name: string;
    gender?: 'male' | 'female' | 'other';
    birthDate?: string;
  }

  // 引导状态接口
  export interface OnboardingState {
    isCompleted: boolean;
    currentStep: OnboardingStep;
    isVisible: boolean;
    selectedAccountType: AccountType | null;
    selectedFamilyAction: FamilyAction | null;
    familyName: string;
    inviteCode: string;
    budgetEnabled: boolean | null;
    personalBudgetAmount: number;
    familyBudgets: Record<string, number>;
    createdFamilyId: string | null;
    createdInviteCode: string | null;
    showCustodialMemberStep: boolean;
    custodialMembers: CustodialMember[];
    startOnboarding: () => void;
    startOnboardingFromStep: (step: OnboardingStep) => void;
    completeOnboarding: () => void;
    skipOnboarding: () => void;
    nextStep: () => void;
    previousStep: () => void;
    setCurrentStep: (step: OnboardingStep) => void;
    goToStep: (step: OnboardingStep) => void;
    setAccountType: (type: AccountType) => void;
    setFamilyAction: (action: FamilyAction) => void;
    setFamilyName: (name: string) => void;
    setInviteCode: (code: string) => void;
    setBudgetEnabled: (enabled: boolean | null) => void;
    setPersonalBudgetAmount: (amount: number) => void;
    setFamilyBudgets: (budgets: Record<string, number>) => void;
    setCreatedFamilyId: (id: string) => void;
    setCreatedInviteCode: (code: string) => void;
    setShowCustodialMemberStep: (show: boolean) => void;
    setCustodialMembers: (members: CustodialMember[]) => void;
    addCustodialMember: (member: CustodialMember) => void;
    resetOnboarding: () => void;
  }

  // 创建引导状态管理函数
  export function createOnboardingStore(storage: StorageAdapter): any;

  // 其他可能导出的类型
  export interface CreateAuthStoreOptions {
    storage: StorageAdapter;
    apiBaseUrl?: string;
  }

  export function createAuthStore(options: CreateAuthStoreOptions): any;
  export function createAccountBookStore(options: { storage: StorageAdapter }): any;
  export function createTransactionStore(options: { storage: StorageAdapter }): any;
  export function createCategoryStore(options: { storage: StorageAdapter }): any;
  export function createBudgetStore(options: { storage: StorageAdapter }): any;
}

declare module '@zhiweijz/web' {
  import { StorageAdapter } from '@zhiweijz/core';

  // LocalStorage 适配器
  export class LocalStorageAdapter implements StorageAdapter {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }
}
