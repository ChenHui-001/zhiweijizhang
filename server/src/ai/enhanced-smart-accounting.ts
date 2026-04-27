import { logger } from '../utils/logger';
import { LLMProviderService } from './llm/llm-provider-service';
import {
  ENHANCED_SMART_ACCOUNTING_PROMPT,
  DEFAULT_SMART_ACCOUNTING_PROMPT,
  DATE_PARSING_PROMPT,
  AMOUNT_EXTRACTION_PROMPT,
  CATEGORY_CLASSIFICATION_PROMPT,
  TYPE_DETERMINATION_PROMPT,
} from './prompts/enhanced-accounting-prompts';
import { SmartAccountingState } from './types/accounting-types';
import { SmartAccountingResponse, SmartAccountingResult } from '../types/smart-accounting';
import multimodalAIConfigService from '../services/multimodal-ai-config.service';
import {
  SmartAccountingPromptProcessor,
  SmartAccountingPromptVariables,
  RelevanceCheckPromptVariables,
  extractJsonFromResponse
} from '../utils/prompt-utils';
import userAISmartAccountingService from '../services/user-ai-smart-accounting.service';
import NodeCache from 'node-cache';
import prisma from '../config/database';
import { getLocalDateString } from '../utils/date-helpers';
import crypto from 'crypto';

/**
 * 增强版智能记账服务
 * 集成用户自定义配置，优化提示词，提高分类准确性
 */
export class EnhancedSmartAccounting {
  private llmProviderService: LLMProviderService;
  private userAIConfigService: any;
  private cache: NodeCache;

  constructor(llmProviderService: LLMProviderService) {
    this.llmProviderService = llmProviderService;
    this.userAIConfigService = userAISmartAccountingService;
    this.cache = new NodeCache({ stdTTL: 1800 }); // 30分钟过期
  }

  /**
   * 处理用户描述
   * @param description 用户描述
   * @param userId 用户ID
   * @param accountId 账本ID
   * @param accountType 账本类型
   * @param includeDebugInfo 是否包含调试信息
   * @returns 处理结果
   */
  public async processDescription(
    description: string,
    userId: string,
    accountId: string,
    accountType: string,
    includeDebugInfo: boolean = false,
    source?: 'App' | 'WeChat' | 'API',
  ): Promise<SmartAccountingResponse> {
    if (!accountId) {
      logger.error('处理智能记账时缺少账本ID');
      return null;
    }

    if (!userId) {
      logger.error('处理智能记账时缺少用户ID');
      return null;
    }

    // 生成缓存键（使用描述文本的哈希值避免过长）
    const cacheKey = `enhanced:${userId}:${accountId}:${crypto.createHash('md5').update(description).digest('hex')}`;

    // 检查缓存
    const cachedResult = this.cache.get(cacheKey);
    if (cachedResult) {
      logger.info('增强智能记账缓存命中，返回缓存结果');
      return cachedResult as SmartAccountingResponse;
    }

    // 创建初始状态
    const initialState: SmartAccountingState = {
      description,
      userId,
      accountId,
      accountType: accountType.toLowerCase() as 'personal' | 'family',
      includeDebugInfo,
      source,
    };

    try {
      // 分析记账
      const analyzedState = await this.analyzeTransactionWithCustomConfig(initialState);

      // 检查是否有错误
      if (analyzedState.error) {
        logger.info('增强智能记账分析失败:', analyzedState.error);
        return { error: analyzedState.error };
      }

      // 匹配预算
      const budgetState = await this.matchBudgetHandler(analyzedState);

      // 匹配账本
      const accountState = await this.matchAccountHandler(budgetState);

      // 生成结果
      const resultState = await this.generateResultHandler(accountState);

      // 缓存结果
      if (resultState.result) {
        this.cache.set(cacheKey, resultState.result);
        return resultState.result as SmartAccountingResponse;
      }

      return null;
    } catch (error) {
      logger.error('增强智能记账工作流执行错误:', error);
      return null;
    }
  }

  /**
   * 使用自定义配置分析交易
   * @param state 工作流状态
   * @returns 更新后的状态
   */
  private async analyzeTransactionWithCustomConfig(state: SmartAccountingState) {
    try {
      // 获取用户自定义配置（合并为一次查询）
      const { customPrompt, customRules, categoryMappings } = await this.userAIConfigService.getAllUserConfig(state.userId);

      // 获取全局配置
      const globalConfig = await multimodalAIConfigService.getFullConfig();

      // 第一步：判断相关性
      const relevanceCheckTemplate = (globalConfig.smartAccounting.relevanceCheckPrompt && globalConfig.smartAccounting.relevanceCheckPrompt.trim()) ?
        globalConfig.smartAccounting.relevanceCheckPrompt :
        `你是一个专业的财务助手。请判断以下用户描述是否与记账相关。

判断标准：
1. 包含金额信息（必须）
2. 包含记账流水明细（必须）

如果描述中包含明确的金额和记账内容（如购买、支付、收入、转账等），则判定为与记账相关。
如果描述中只是询问、闲聊或其他非记账相关内容，则判定为与记账无关。

请只回答 "相关" 或 "无关"，不要有其他文字。

用户描述: {{description}}`;

      const relevanceVariables: RelevanceCheckPromptVariables = {
        description: state.description
      };
      const relevanceCheckPrompt = SmartAccountingPromptProcessor.processRelevanceCheckPrompt(
        relevanceCheckTemplate,
        relevanceVariables
      );

      const relevanceResponse = await this.llmProviderService.generateChat(
        [
          { role: 'system', content: '你是一个专业的财务助手，负责判断用户描述是否与记账相关。' },
          { role: 'user', content: relevanceCheckPrompt },
        ],
        state.userId,
        state.accountId,
        state.accountType,
        state.source,
      );

      const relevanceResult = relevanceResponse.trim();

      if (relevanceResult.includes('无关')) {
        return {
          ...state,
          error: '消息与记账无关',
        };
      }

      // 获取所有分类
      const categories = await prisma.category.findMany({
        where: {
          OR: [{ userId: state.userId }, { isDefault: true }, { accountBookId: state.accountId }],
        },
      });

      // 获取简化的分类列表
      const categoryList = await this.getSimplifiedCategoryListForPrompt(
        state.userId,
        state.accountId || '',
      );

      // 获取预算列表
      const budgetListText = await this.getBudgetListForPrompt(state.userId, state.accountId || '');
      const budgetList = budgetListText ? `预算列表：\n${budgetListText}` : '';

      // 构建提示词
      let systemPrompt = DEFAULT_SMART_ACCOUNTING_PROMPT;

      // 优先使用用户自定义提示词
      if (customPrompt && customPrompt.configValue) {
        systemPrompt = customPrompt.configValue;
        logger.info('使用用户自定义提示词');
      } else if (globalConfig.smartAccounting.smartAccountingPrompt) {
        systemPrompt = globalConfig.smartAccounting.smartAccountingPrompt;
        logger.info('使用全局配置提示词');
      }

      // 准备变量
      const currentDate = getLocalDateString();

      // 如果有自定义规则，将其注入到提示词中
      let finalPrompt = systemPrompt;
      if (customRules && customRules.configValue) {
        try {
          const rules = JSON.parse(customRules.configValue);
          finalPrompt = this.injectCustomRules(systemPrompt, rules);
        } catch (e) {
          logger.warn('解析自定义规则失败:', e);
        }
      }

      // 注入分类映射
      if (categoryMappings.length > 0) {
        finalPrompt = this.injectCategoryMappings(finalPrompt, categoryMappings);
      }

      const variables: SmartAccountingPromptVariables = {
        description: state.description,
        categories: categoryList,
        budgets: budgetList,
        currentDate: currentDate,
      };

      const systemPromptProcessed = SmartAccountingPromptProcessor.processSmartAccountingPrompt(
        finalPrompt,
        variables
      );

      const userPrompt = `用户描述: ${state.description}\n当前日期: ${currentDate}`;

      // 调用LLM
      const response = await this.llmProviderService.generateChat(
        [
          { role: 'system', content: systemPromptProcessed },
          { role: 'user', content: userPrompt },
        ],
        state.userId,
        state.accountId,
        state.accountType,
        state.source,
      );

      // 解析响应
      const extracted = extractJsonFromResponse(response);

      if (extracted) {
        const parsedResult = JSON.parse(extracted.json);
        const isArrayFormat = extracted.isArray;
        const transactions = isArrayFormat ? parsedResult : [parsedResult];

        for (let i = 0; i < transactions.length; i++) {
          const analyzedTransaction = transactions[i];

          // 处理日期
          if (analyzedTransaction.date) {
            const dateStr = analyzedTransaction.date;
            if (typeof dateStr === 'string') {
              if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                const now = new Date();
                const [year, month, day] = dateStr.split('-').map(Number);
                analyzedTransaction.date = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());
              } else {
                analyzedTransaction.date = new Date(dateStr);
              }
            } else {
              analyzedTransaction.date = new Date(dateStr);
            }
          } else {
            analyzedTransaction.date = new Date();
          }

          // 应用用户分类映射
          if (!analyzedTransaction.categoryId && analyzedTransaction.note) {
            const mappedCategory = await this.applyCategoryMappings(
              state.userId,
              analyzedTransaction.note,
              analyzedTransaction.categoryName
            );
            if (mappedCategory) {
              analyzedTransaction.categoryId = mappedCategory.categoryId;
              analyzedTransaction.categoryName = mappedCategory.categoryName;
            }
          }

          // 验证分类ID
          const validCategory = categories.find((c: any) => c.id === analyzedTransaction.categoryId);
          if (!validCategory) {
            const defaultCategory = categories.find((c: any) => c.name === '其他') || categories[0];
            if (defaultCategory) {
              analyzedTransaction.categoryId = defaultCategory.id;
              analyzedTransaction.categoryName = defaultCategory.name;
            }
          }

          // 统一类型格式
          if (analyzedTransaction.type === '支出' || analyzedTransaction.type === 'expense') {
            analyzedTransaction.type = 'EXPENSE';
          } else if (analyzedTransaction.type === '收入' || analyzedTransaction.type === 'income') {
            analyzedTransaction.type = 'INCOME';
          }
        }

        return {
          ...state,
          transactions: transactions,
          debugInfo: {
            systemPrompt: systemPromptProcessed,
            userPrompt,
            llmResponse: response,
            parsedResult,
            isArrayFormat,
            transactionCount: transactions.length,
          },
        };
      }

      return {
        ...state,
        error: '无法解析AI响应',
      };
    } catch (error) {
      logger.error('分析交易失败:', error);
      return {
        ...state,
        error: error instanceof Error ? error.message : '分析交易时出错',
      };
    }
  }

  /**
   * 注入自定义规则到提示词
   */
  private injectCustomRules(prompt: string, rules: any): string {
    let enhancedPrompt = prompt;

    // 注入收入关键词
    if (rules.income_keywords && rules.income_keywords.length > 0) {
      const incomeSection = `\n### 收入关键词\n${rules.income_keywords.join('、')}`;
      if (!enhancedPrompt.includes('收入关键词')) {
        enhancedPrompt += incomeSection;
      }
    }

    // 注入支出关键词
    if (rules.expense_keywords && rules.expense_keywords.length > 0) {
      const expenseSection = `\n### 支出关键词\n${rules.expense_keywords.join('、')}`;
      if (!enhancedPrompt.includes('支出关键词')) {
        enhancedPrompt += expenseSection;
      }
    }

    // 注入分类关键词
    if (rules.food_keywords) {
      const foodSection = `\n### 餐饮关键词\n${rules.food_keywords.join('、')}`;
      if (!enhancedPrompt.includes('餐饮关键词')) {
        enhancedPrompt += foodSection;
      }
    }

    if (rules.transport_keywords) {
      const transportSection = `\n### 交通关键词\n${rules.transport_keywords.join('、')}`;
      if (!enhancedPrompt.includes('交通关键词')) {
        enhancedPrompt += transportSection;
      }
    }

    return enhancedPrompt;
  }

  /**
   * 注入分类映射到提示词
   */
  private injectCategoryMappings(prompt: string, mappings: any[]): string {
    let enhancedPrompt = prompt;

    const mappingSection = '\n### 用户自定义分类映射\n' +
      mappings.slice(0, 20).map((m: any) => `${m.keyword} → ${m.categoryName}`).join('\n') +
      (mappings.length > 20 ? `\n... 还有 ${mappings.length - 20} 条映射规则` : '');

    if (!enhancedPrompt.includes('自定义分类映射')) {
      enhancedPrompt += mappingSection;
    }

    return enhancedPrompt;
  }

  /**
   * 应用分类映射
   */
  private async applyCategoryMappings(
    userId: string,
    text: string,
    currentCategoryName?: string
  ): Promise<{ categoryId: string; categoryName: string } | null> {
    try {
      const result = await this.userAIConfigService.matchCategoryByKeyword(userId, text);
      if (result.matched) {
        return {
          categoryId: result.categoryId,
          categoryName: result.categoryName,
        };
      }
      return null;
    } catch (error) {
      logger.error('应用分类映射失败:', error);
      return null;
    }
  }

  /**
   * 获取简化的分类列表
   */
  private async getSimplifiedCategoryListForPrompt(userId: string, accountId: string): Promise<string> {
    try {
      const categories = await prisma.category.findMany({
        where: {
          OR: [{ userId: userId }, { isDefault: true }, { accountBookId: accountId }],
        },
        select: {
          id: true,
          name: true,
          icon: true,
        },
      });

      return categories
        .map((c, index) => `${index + 1}. ${c.name}`)
        .join('\n');
    } catch (error) {
      logger.error('获取分类列表失败:', error);
      return '';
    }
  }

  /**
   * 获取预算列表
   */
  private async getBudgetListForPrompt(userId: string, accountId: string): Promise<string> {
    try {
      const accountBook = await prisma.accountBook.findUnique({
        where: { id: accountId },
        include: {
          family: {
            include: {
              members: {
                where: { userId: { not: null } },
                select: { userId: true },
              },
            },
          },
        },
      });

      if (!accountBook) {
        return '';
      }

      let userIds = [userId];
      if (accountBook.type === 'FAMILY' && accountBook.family) {
        const familyUserIds = accountBook.family.members
          .filter((member) => member.userId)
          .map((member) => member.userId!);
        userIds = [...new Set([...userIds, ...familyUserIds])];
      }

      const activeBudgets = await prisma.budget.findMany({
        where: {
          accountBookId: accountId,
          startDate: { lte: new Date() },
          endDate: { gte: new Date() },
          OR: [{ userId: { in: userIds } }, { familyId: accountBook.familyId }],
        },
        select: {
          id: true,
          name: true,
          budgetType: true,
          familyMemberId: true,
          userId: true,
          familyMember: {
            select: {
              user: {
                select: { id: true, name: true },
              },
              name: true,
            },
          },
        },
      });

      const budgets: string[] = [];

      // 批量查询用户名称（修复N+1查询问题）
      const budgetUserIds = [...new Set(activeBudgets
        .filter(b => b.userId && !b.familyMemberId)
        .map(b => b.userId)
        .filter((id): id is string => id !== null))];

      const usersMap = new Map<string, string>();
      if (budgetUserIds.length > 0) {
        const users = await prisma.user.findMany({
          where: { id: { in: budgetUserIds } },
          select: { id: true, name: true },
        });
        users.forEach(u => usersMap.set(u.id, u.name));
      }

      for (const budget of activeBudgets) {
        let budgetDisplayName = budget.name;

        if (budget.budgetType === 'GENERAL') {
          budgetDisplayName = budget.name;
        } else if (budget.budgetType === 'PERSONAL') {
          if (budget.familyMemberId && budget.familyMember) {
            budgetDisplayName = budget.familyMember.user?.name || budget.familyMember.name;
          } else if (budget.userId) {
            budgetDisplayName = usersMap.get(budget.userId) || budget.name;
          }
        }

        budgets.push(`${budgetDisplayName} (ID: ${budget.id})`);
      }

      return budgets.join('\n');
    } catch (error) {
      logger.error('获取预算列表失败:', error);
      return '';
    }
  }

  /**
   * 获取当前活跃的预算列表（用于内存匹配）
   */
  private async getActiveBudgetsForMatching(userId: string, accountId: string): Promise<any[]> {
    try {
      const accountBook = await prisma.accountBook.findUnique({
        where: { id: accountId },
        select: { familyId: true },
      });
      if (!accountBook) return [];

      const currentDate = new Date();
      return await prisma.budget.findMany({
        where: {
          OR: [
            { accountBookId: accountId, startDate: { lte: currentDate }, endDate: { gte: currentDate } },
            { userId: userId, startDate: { lte: currentDate }, endDate: { gte: currentDate } },
            ...(accountBook.familyId
              ? [{ familyId: accountBook.familyId, startDate: { lte: currentDate }, endDate: { gte: currentDate } }]
              : []),
          ],
        },
      });
    } catch (error) {
      logger.error('获取活跃预算失败:', error);
      return [];
    }
  }

  /**
   * 匹配预算处理器 - 多优先级匹配
   */
  private async matchBudgetHandler(state: SmartAccountingState) {
    if (!state.transactions || state.transactions.length === 0) {
      return state;
    }

    try {
      // 获取当前活跃的预算
      const activeBudgets = await this.getActiveBudgetsForMatching(state.userId, state.accountId || '');

      for (const transaction of state.transactions) {
        if (transaction.budgetId) {
          continue;
        }

        let matchedBudget = null;

        // 1. LLM识别的预算名称匹配（优先级最高）
        if (transaction.budgetName) {
          matchedBudget = activeBudgets.find((b: any) =>
            b.name.toLowerCase().includes(transaction.budgetName!.toLowerCase()) ||
            transaction.budgetName!.toLowerCase().includes(b.name.toLowerCase())
          );
          if (matchedBudget) {
            logger.info(`[预算匹配-增强] 根据预算名称匹配: ${matchedBudget.id}`);
            transaction.budgetId = matchedBudget.id;
            continue;
          }
        }

        // 2. 用户个人预算（排除托管成员）
        matchedBudget = activeBudgets.find((b: any) =>
          b.userId === state.userId &&
          b.budgetType === 'PERSONAL' &&
          !b.familyMemberId &&
          (!b.categoryId || b.categoryId === transaction.categoryId)
        );

        if (matchedBudget) {
          logger.info(`[预算匹配-增强] 匹配用户个人预算: ${matchedBudget.id}`);
          transaction.budgetId = matchedBudget.id;
          continue;
        }

        // 3. 账本分类预算
        matchedBudget = activeBudgets.find((b: any) =>
          b.accountBookId === state.accountId &&
          b.categoryId === transaction.categoryId
        );

        if (matchedBudget) {
          logger.info(`[预算匹配-增强] 匹配分类预算: ${matchedBudget.id}`);
          transaction.budgetId = matchedBudget.id;
          continue;
        }

        // 4. 账本通用预算（不限分类）
        matchedBudget = activeBudgets.find((b: any) =>
          b.accountBookId === state.accountId &&
          !b.categoryId
        );

        if (matchedBudget) {
          logger.info(`[预算匹配-增强] 匹配通用预算: ${matchedBudget.id}`);
          transaction.budgetId = matchedBudget.id;
        }
      }

      return state;
    } catch (error) {
      logger.error('匹配预算失败:', error);
      return state;
    }
  }

  /**
   * 匹配账本处理器
   */
  private async matchAccountHandler(state: SmartAccountingState) {
    if (!state.transactions || state.transactions.length === 0) {
      return state;
    }

    try {
      const accountBook = await prisma.accountBook.findUnique({
        where: { id: state.accountId },
      });

      if (accountBook) {
        for (const transaction of state.transactions) {
          transaction.accountId = accountBook.id;
          transaction.accountName = accountBook.name;
          transaction.accountType = accountBook.type.toLowerCase() as 'personal' | 'family';
          transaction.userId = state.userId;
        }
      }

      return state;
    } catch (error) {
      logger.error('匹配账本失败:', error);
      return state;
    }
  }

  /**
   * 生成结果处理器 - 支持多条记录
   */
  private async generateResultHandler(state: SmartAccountingState) {
    if (!state.transactions || state.transactions.length === 0) {
      return state;
    }

    try {
      // 获取账本信息
      const accountBook = await prisma.accountBook.findUnique({
        where: { id: state.accountId },
      });

      const isArrayFormat = state.transactions.length > 1;

      // 批量获取所有分类和预算信息（消除N+1查询）
      const categoryIds = [...new Set(state.transactions.map(t => t.categoryId).filter(Boolean))];
      const budgetIds = [...new Set(state.transactions.map(t => t.budgetId).filter((id): id is string => !!id))];

      const [categories, budgets] = await Promise.all([
        categoryIds.length > 0
          ? prisma.category.findMany({ where: { id: { in: categoryIds } } })
          : Promise.resolve([]),
        budgetIds.length > 0
          ? prisma.budget.findMany({
              where: { id: { in: budgetIds } },
              include: {
                user: { select: { name: true } },
                familyMember: { include: { user: { select: { name: true } } } },
              },
            })
          : Promise.resolve([]),
      ]);

      const categoryMap = new Map(categories.map((c: any) => [c.id, c]));
      const budgetMap = new Map(budgets.map((b: any) => [b.id, b]));

      const results: SmartAccountingResult[] = [];

      for (const transaction of state.transactions) {
        const category = categoryMap.get(transaction.categoryId);
        const budget = transaction.budgetId ? budgetMap.get(transaction.budgetId) : null;

        let budgetOwnerName = null;
        if (budget) {
          if (budget.familyMemberId && budget.familyMember) {
            budgetOwnerName = budget.familyMember.user?.name || budget.familyMember.name;
          } else if (budget.userId && budget.user) {
            budgetOwnerName = budget.user.name;
          } else {
            budgetOwnerName = budget.name;
          }
        }

        const result: SmartAccountingResult = {
          amount: transaction.amount,
          date: transaction.date instanceof Date ? transaction.date : new Date(transaction.date),
          categoryId: transaction.categoryId || '',
          categoryName: category?.name || transaction.categoryName || '',
          type: (category?.type || transaction.type || 'EXPENSE') as 'EXPENSE' | 'INCOME',
          note: transaction.note || '',
          accountId: transaction.accountId || state.accountId || '',
          accountName: accountBook?.name || transaction.accountName || '',
          accountType: (accountBook?.type?.toLowerCase() || transaction.accountType || state.accountType || 'personal') as 'personal' | 'family',
          userId: state.userId || '',
          confidence: transaction.confidence || 0.9,
          createdAt: new Date(),
          originalDescription: state.description,
        };

        if (transaction.budgetId) {
          result.budgetId = transaction.budgetId;
          result.budgetName = budget?.name;
          if (budgetOwnerName) {
            result.budgetOwnerName = budgetOwnerName;
          }
          result.budgetType = budget?.period === 'MONTHLY' ? 'PERSONAL' : 'GENERAL';
        }

        results.push(result);
      }

      const finalResult = isArrayFormat ? results : results[0];

      // 附加调试信息
      if (state.includeDebugInfo && state.debugInfo) {
        (finalResult as any).debugInfo = state.debugInfo;
      }

      return { ...state, result: finalResult as any };
    } catch (error) {
      logger.error('生成结果失败:', error);
      return state;
    }
  }

  /**
   * 清除缓存
   */
  public clearCache() {
    this.cache.flushAll();
    logger.info('增强智能记账缓存已清除');
  }
}
