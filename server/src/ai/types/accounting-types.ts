import { WorkflowState } from './workflow-types';

/**
 * 智能记账工作流状态接口
 */
export interface SmartAccountingState extends WorkflowState {
  // 输入
  description: string;
  userId: string;
  accountId?: string;
  accountType?: 'personal' | 'family';

  // 支持批量交易记录
  transactions?: Array<{
    amount: number;
    date: Date | string;
    categoryId: string;
    categoryName: string;
    type: 'EXPENSE' | 'INCOME';
    budgetId?: string;
    budgetName?: string;
    note: string;
    confidence: number;
    accountId: string;
    accountName?: string;
    accountType?: 'personal' | 'family';
    userId: string;
  }>;

  // 中间状态
  analyzedTransaction?: {
    amount: number;
    date: Date;
    categoryId: string;
    categoryName: string;
    type: 'EXPENSE' | 'INCOME';
    budgetName?: string;
    note: string;
    confidence: number;
  };

  matchedBudget?: {
    id: string;
    name: string;
  };

  // 调试信息
  debugInfo?: {
    systemPrompt: string;
    userPrompt: string;
    llmResponse: string;
    parsedResult: any;
  };

  // 错误信息
  error?: string;

  includeDebugInfo?: boolean;

  // 请求来源（用于日志记录）
  source?: 'App' | 'WeChat' | 'API';

  // 输出
  result?: {
    amount: number;
    date: Date;
    categoryId: string;
    categoryName: string;
    type: 'EXPENSE' | 'INCOME';
    note: string;
    accountId: string;
    accountType: 'personal' | 'family';
    budgetId?: string;
    budgetName?: string;
    confidence: number;
  };
}
