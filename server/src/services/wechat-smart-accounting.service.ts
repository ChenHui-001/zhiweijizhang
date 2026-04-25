import { logger } from '../utils/logger';
import crypto from 'crypto';
import prisma from '../config/database';
import { AIController } from '../controllers/ai-controller';
import { SmartAccountingResult, SmartAccountingError } from '../types/smart-accounting';
import { TransactionDuplicateDetectionService } from './transaction-duplicate-detection.service';
import { DateCorrectionMiddleware, SmartAccountingResultWithValidation } from '../middleware/date-correction.middleware';
import { WechatMessageFormatter, WechatWarningMessage } from './wechat-message-formatter.service';


export interface WechatSmartAccountingResult {
  success: boolean;
  message: string;
  transaction?: any;
  error?: string;
}

export class WechatSmartAccountingService {
  private aiController: AIController;
  private dateCorrectionMiddleware: DateCorrectionMiddleware;
  private messageFormatter: WechatMessageFormatter;

  constructor() {
    this.aiController = new AIController();
    this.dateCorrectionMiddleware = new DateCorrectionMiddleware();
    this.messageFormatter = new WechatMessageFormatter();
  }

  /**
   * 处理微信智能记账请求
   */
  async processWechatAccounting(
    userId: string,
    accountBookId: string,
    description: string,
    createTransaction: boolean = false,
    isFromImageRecognition: boolean = false,
  ): Promise<WechatSmartAccountingResult> {
    try {
      // 设置LLM请求上下文为微信来源
      this.aiController['llmProviderService'].setRequestContext({ source: 'WeChat' });

      // 1. 验证账本权限
      const accountBook = await this.validateAccountBookAccess(userId, accountBookId);
      if (!accountBook) {
        return {
          success: false,
          message: '账本不存在或无权访问，请重新设置默认账本。',
        };
      }

      // 2. 调用智能记账分析
      const smartAccounting = this.aiController['smartAccounting'];
      if (!smartAccounting) {
        return {
          success: false,
          message: '智能记账服务暂时不可用，请稍后重试。',
        };
      }

      const analysisResult = await smartAccounting.processDescription(
        description,
        userId,
        accountBookId,
        accountBook.type,
      );

      if (!analysisResult) {
        return {
          success: false,
          message: '智能记账分析失败，请稍后重试。',
        };
      }

      // 4. 检查分析结果
      if ('error' in analysisResult) {
        if (analysisResult.error.includes('Token使用受限')) {
          return {
            success: false,
            message: 'AI服务使用受限，请稍后重试。',
            error: 'TOKEN_LIMIT_EXCEEDED',
          };
        }
        return {
          success: false,
          message: `${analysisResult.error}\n\n请发送有效的记账信息，例如："50 餐饮 午餐"`,
        };
      }

      // 5. 日期校验和修正 - 微信端自动修正
      const isMultipleRecords = Array.isArray(analysisResult);
      const recordsToValidate = isMultipleRecords ? analysisResult : [analysisResult];

      // 对所有记录进行日期校验和自动修正
      const recordsWithDateValidation = this.dateCorrectionMiddleware.processBatchRecords(
        recordsToValidate,
        'wechat',
        { userId, accountBookId }
      );

      // 生成日期警告消息
      const dateWarning = this.messageFormatter.formatDateWarning(recordsWithDateValidation);

      if (dateWarning.hasWarning) {
        logger.info(`⚠️ [微信日期校验] 检测到${dateWarning.correctedRecords.length}条记录日期异常，已自动修正`);
      }

      // 6. 如果需要创建记账记录
      if (createTransaction) {
        // 使用校验和修正后的记录
        const recordsToCreate = recordsWithDateValidation;

        logger.info(`📝 [微信记账] 检测到 ${recordsToCreate.length} 条记录需要创建`);

        // 微信图片记账进行重复检测（检测到重复则不创建记录）
        let duplicateResults: any[] = [];
        let recordsToActuallyCreate = recordsToCreate;
        let skippedDuplicates: string[] = [];

        if (isFromImageRecognition) {
          try {
            logger.info('🔍 [微信重复检测] 开始智能账本匹配和重复检测');
            duplicateResults = await TransactionDuplicateDetectionService.detectBatchDuplicatesWithSmartAccountBook(
              userId,
              accountBookId, // 作为默认账本
              recordsToCreate
            );

            // 过滤掉重复的记录，只保留不重复的记录
            recordsToActuallyCreate = [];
            recordsToCreate.forEach((record, index) => {
              const duplicateResult = duplicateResults[index];
              if (duplicateResult && duplicateResult.isDuplicate && duplicateResult.confidence > 0.5) {
                // 记录重复，跳过创建
                skippedDuplicates.push(
                  `记录${index + 1}(${record.amount}元 ${record.note || '无描述'})已存在，跳过创建`
                );
                logger.info(`⚠️ [微信重复检测] 跳过重复记录: ${record.amount}元 ${record.note || '无描述'}`);
              } else {
                // 记录不重复，添加到创建列表
                recordsToActuallyCreate.push(record);
                logger.info(`✅ [微信重复检测] 记录不重复，将创建: ${record.amount}元 ${record.note || '无描述'}`);
              }
            });

            logger.info(`📊 [微信重复检测] 原始记录数: ${recordsToCreate.length}, 跳过重复: ${skippedDuplicates.length}, 将创建: ${recordsToActuallyCreate.length}`);
          } catch (duplicateError) {
            logger.error('微信图片记账重复检测失败:', duplicateError);
            // 重复检测失败时，创建所有记录（保持原有行为）
            recordsToActuallyCreate = recordsToCreate;
          }
        }

        const createdTransactions = [];

        // 循环创建过滤后的记录（不重复的记录）
        for (let i = 0; i < recordsToActuallyCreate.length; i++) {
          const record = recordsToActuallyCreate[i];
          const transaction = await this.createTransactionRecord(record, userId);

          if (transaction) {
            createdTransactions.push(transaction);
            logger.info(`✅ [微信记账] 第 ${i + 1} 条记账记录创建成功: ${transaction.id}`);
          } else {
            logger.error(`❌ [微信记账] 第 ${i + 1} 条记账记录创建失败`);
          }
        }

        // 处理结果消息
        if (createdTransactions.length > 0 || skippedDuplicates.length > 0) {
          let resultMessage = '';

          // 如果有成功创建的记录
          if (createdTransactions.length > 0) {
            resultMessage = this.formatSuccessMessage(analysisResult, true, createdTransactions.length);
          }

          // 如果是图片记账且有跳过的重复记录，添加说明
          if (isFromImageRecognition && skippedDuplicates.length > 0) {
            if (createdTransactions.length > 0) {
              resultMessage += '\n\n📋 重复记录处理:\n' + skippedDuplicates.join('\n');
            } else {
              // 所有记录都是重复的情况
              resultMessage = `识别到 ${recordsToCreate.length} 条记录，但均为重复记录，已跳过创建：\n\n` + skippedDuplicates.join('\n');
            }
          }

          // 附加日期警告消息
          resultMessage = this.messageFormatter.appendWarningToSuccessMessage(resultMessage, dateWarning);

          return {
            success: true,
            message: resultMessage,
            transaction: isMultipleRecords ? createdTransactions : createdTransactions[0],
          };
        } else {
          // 没有创建任何记录的情况
          if (isFromImageRecognition && skippedDuplicates.length > 0) {
            // 所有记录都是重复的，这是正常情况
            return {
              success: true,
              message: `识别到 ${recordsToCreate.length} 条记录，但均为重复记录，已跳过创建：\n\n` + skippedDuplicates.join('\n'),
            };
          } else {
            // 其他原因导致的创建失败
            return {
              success: false,
              message: '记账分析成功，但创建记账记录失败。',
            };
          }
        }
      }

      // 8. 仅返回分析结果(不创建记账)
      let analysisMessage = this.formatSuccessMessage(
        analysisResult,
        false,
        Array.isArray(analysisResult) ? analysisResult.length : 1
      );

      // 附加日期警告消息
      analysisMessage = this.messageFormatter.appendWarningToSuccessMessage(analysisMessage, dateWarning);

      return {
        success: true,
        message: analysisMessage,
      };
    } catch (error) {
      logger.error('微信智能记账处理失败:', error);
      return {
        success: false,
        message: '记账处理失败，请稍后重试。',
      };
    } finally {
      // 清除LLM请求上下文
      this.aiController['llmProviderService'].clearRequestContext();
    }
  }

  /**
   * 验证账本访问权限
   */
  private async validateAccountBookAccess(userId: string, accountBookId: string) {
    return await prisma.accountBook.findFirst({
      where: {
        id: accountBookId,
        OR: [
          { userId },
          {
            type: 'FAMILY',
            familyId: {
              not: null,
            },
            family: {
              members: {
                some: {
                  userId,
                },
              },
            },
          },
        ],
      },
    });
  }

  /**
   * 创建记账记录
   */
  private async createTransactionRecord(result: SmartAccountingResult, userId: string) {
    try {
      // 确保日期包含当前时间
      let transactionDate: Date;
      const now = new Date();

      if (result.date) {
        // 如果智能分析返回了日期，使用该日期但设置为当前时间
        const resultDate = new Date(result.date);
        transactionDate = new Date(
          resultDate.getFullYear(),
          resultDate.getMonth(),
          resultDate.getDate(),
          now.getHours(),
          now.getMinutes(),
          now.getSeconds(),
          now.getMilliseconds(),
        );
      } else {
        // 如果没有日期，使用当前时间
        transactionDate = now;
      }

      // 获取账本信息以确定是否为家庭账本
      const accountBook = await prisma.accountBook.findUnique({
        where: { id: result.accountId },
        select: { type: true, familyId: true },
      });

      // 确定家庭ID和家庭成员ID
      let finalFamilyId: string | null = null;
      let finalFamilyMemberId: string | null = null;

      if (accountBook?.type === 'FAMILY' && accountBook.familyId) {
        finalFamilyId = accountBook.familyId;

        // 如果有预算ID，通过预算确定家庭成员ID
        if (result.budgetId) {
          const budget = await prisma.budget.findUnique({
            where: { id: result.budgetId },
            include: { familyMember: true, user: true },
          });

          if (budget) {
            if (budget.familyMemberId) {
              // 预算直接关联到家庭成员（旧架构的托管成员预算）
              finalFamilyMemberId = budget.familyMemberId;
            } else if (budget.userId) {
              // 预算关联到用户（包括普通用户和托管用户），需要查找该用户在家庭中的成员记录
              // 这是统一的处理逻辑：无论是普通用户还是托管用户，都通过userId查找对应的familyMember.id
              const familyMember = await prisma.familyMember.findFirst({
                where: {
                  familyId: finalFamilyId,
                  userId: budget.userId,
                },
              });

              if (familyMember) {
                finalFamilyMemberId = familyMember.id;
              }
            }
          }
        }

        // 如果通过预算无法确定家庭成员ID，则使用当前用户作为备选方案
        if (!finalFamilyMemberId) {
          const familyMember = await prisma.familyMember.findFirst({
            where: {
              familyId: finalFamilyId,
              userId: userId,
            },
          });

          if (familyMember) {
            finalFamilyMemberId = familyMember.id;
          }
        }
      }

      // 在创建记账前，确保用户有当前月份的预算（如果是支出记账）
      if (result.accountId && result.type === 'EXPENSE') {
        try {
          const budgetService = new (await import('./budget.service')).BudgetService();
          await budgetService.ensureCurrentMonthBudget(userId, result.accountId);
        } catch (error) {
          logger.error('智能记账时确保当前月份预算失败:', error);
          // 不影响记账创建流程，继续执行
        }
      }

      const transaction = await prisma.transaction.create({
        data: {
          id: crypto.randomUUID(),
          amount: result.amount,
          type: result.type,
          description: result.note,
          date: transactionDate,
          categoryId: result.categoryId,
          accountBookId: result.accountId,
          userId: userId,
          budgetId: result.budgetId || null,
          // 如果是家庭账本，添加家庭ID和家庭成员ID
          familyId: finalFamilyId,
          familyMemberId: finalFamilyMemberId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        include: {
          category: true,
          budget: true,
          accountBook: true,
        },
      });

      return transaction;
    } catch (error) {
      logger.error('创建记账记录失败:', error);
      return null;
    }
  }

  /**
   * 格式化成功消息
   */
  private formatSuccessMessage(result: SmartAccountingResult | SmartAccountingResult[], transactionCreated: boolean, count: number = 1): string {
    // 如果是多条记录
    if (Array.isArray(result)) {
      const status = transactionCreated ? '记账成功' : '分析完成';
      let message = `✅ ${status}！已处理 ${count} 条记录\n\n`;

      result.forEach((record, index) => {
        const amount = record.amount;
        const type = record.type === 'EXPENSE' ? '支出' : '收入';
        const categoryIcon = this.getCategoryIcon(record.categoryName);
        const category = `${categoryIcon}${record.categoryName || '未分类'}`;
        const desc = record.note || '';

        // 格式化日期 - 只显示日期部分
        const transactionDate = new Date(record.date);
        const dateStr = transactionDate.toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });

        message += `${index + 1}. ${type} ¥${amount}\n`;
        message += `   ${category} ${desc}\n`;
        message += `   📅 ${dateStr}\n`;

        // 构建预算信息
        if (record.budgetName) {
          if (record.budgetOwnerName && record.budgetName !== record.budgetOwnerName) {
            message += `   📊 预算：个人预算（${record.budgetOwnerName}）\n`;
          } else {
            message += `   📊 预算：${record.budgetName}\n`;
          }
        }

        if (index < result.length - 1) {
          message += '\n';
        }
      });

      return message;
    }

    // 单条记录的原有逻辑
    const amount = result.amount;
    const type = result.type === 'EXPENSE' ? '支出' : '收入';
    const categoryIcon = this.getCategoryIcon(result.categoryName);
    const category = `${categoryIcon}${result.categoryName || '未分类'}`;
    const desc = result.note || '';
    const status = transactionCreated ? '记账成功' : '分析完成';

    // 格式化日期 - 只显示日期部分
    const transactionDate = new Date(result.date);
    const dateStr = transactionDate.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    // 构建预算信息
    let budgetInfo = '';
    if (result.budgetName) {
      // 检查是否是个人预算，如果是则在括号中显示所有者名字
      if (result.budgetOwnerName && result.budgetName !== result.budgetOwnerName) {
        // 个人预算：显示"个人预算（张三）"
        budgetInfo = `📊 预算：个人预算（${result.budgetOwnerName}）`;
      } else {
        // 通用预算：直接显示预算名称
        budgetInfo = `📊 预算：${result.budgetName}`;
      }
    }

    return (
      `✅ ${status}！\n` +
      `📝 明细：${desc}\n` +
      `📅 日期：${dateStr}\n` +
      `💸 方向：${type}；分类：${category}\n` +
      `💰 金额：${amount}元` +
      (budgetInfo ? `\n${budgetInfo}` : '')
    );
  }

  /**
   * 获取分类图标
   */
  private getCategoryIcon(categoryName?: string): string {
    if (!categoryName) return '📝';

    const iconMap: { [key: string]: string } = {
      餐饮: '🍽️',
      交通: '🚗',
      购物: '🛒',
      娱乐: '🎮',
      医疗: '🏥',
      教育: '📚',
      学习: '📝',
      住房: '🏠',
      通讯: '📱',
      服装: '👕',
      美容: '💄',
      运动: '⚽',
      旅游: '✈️',
      工资: '💼',
      奖金: '🎁',
      投资: '📈',
      其他: '📝',
    };

    // 查找匹配的图标
    for (const [key, icon] of Object.entries(iconMap)) {
      if (categoryName.includes(key)) {
        return icon;
      }
    }

    return '📝'; // 默认图标
  }

  /**
   * 获取账本统计信息
   */
  async getAccountBookStats(userId: string, accountBookId: string): Promise<string> {
    try {
      // 验证权限
      const accountBook = await this.validateAccountBookAccess(userId, accountBookId);
      if (!accountBook) {
        return '无权访问该账本统计信息。';
      }

      // 获取本月统计
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const monthlyStats = await prisma.transaction.groupBy({
        by: ['type'],
        where: {
          accountBookId,
          date: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        _sum: {
          amount: true,
        },
        _count: {
          id: true,
        },
      });

      let message = `📊 ${accountBook.name} 本月统计\n\n`;

      const expenseStats = monthlyStats.find((s) => s.type === 'EXPENSE');
      const incomeStats = monthlyStats.find((s) => s.type === 'INCOME');

      const totalExpense = Number(expenseStats?._sum.amount || 0);
      const totalIncome = Number(incomeStats?._sum.amount || 0);
      const expenseCount = expenseStats?._count.id || 0;
      const incomeCount = incomeStats?._count.id || 0;

      message += `💰 收入：¥${totalIncome.toFixed(2)} (${incomeCount}笔)\n`;
      message += `💸 支出：¥${totalExpense.toFixed(2)} (${expenseCount}笔)\n`;
      message += `📈 结余：¥${(totalIncome - totalExpense).toFixed(2)}\n\n`;

      // 获取最近5笔记账
      const recentTransactions = await prisma.transaction.findMany({
        where: { accountBookId },
        include: { category: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      if (recentTransactions.length > 0) {
        message += '📝 最近记账：\n';
        recentTransactions.forEach((tx, index) => {
          const type = tx.type === 'EXPENSE' ? '支出' : '收入';
          const date = new Date(tx.date).toLocaleDateString('zh-CN');
          message += `${index + 1}. ${date} ${type} ¥${tx.amount.toFixed(2)} ${tx.category?.name || '未分类'
            }\n`;
        });
      }

      return message;
    } catch (error) {
      logger.error('获取账本统计失败:', error);
      return '获取统计信息失败，请稍后重试。';
    }
  }

  /**
   * 获取最近记账记录
   */
  async getRecentTransactions(
    userId: string,
    accountBookId: string,
    limit: number = 5,
  ): Promise<string> {
    try {
      // 验证权限
      const accountBook = await this.validateAccountBookAccess(userId, accountBookId);
      if (!accountBook) {
        return '无权访问该账本记账记录。';
      }

      // 获取最近记账
      const recentTransactions = await prisma.transaction.findMany({
        where: { accountBookId },
        include: {
          category: true,
          budget: {
            include: {
              user: { select: { name: true } },
              familyMember: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      if (recentTransactions.length === 0) {
        return `📝 ${accountBook.name}\n\n暂无记账记录`;
      }

      let message = `📝 ${accountBook.name} 最近记账\n\n`;

      recentTransactions.forEach((tx, index) => {
        const type = tx.type === 'EXPENSE' ? '支出' : '收入';
        const date = new Date(tx.date).toLocaleDateString('zh-CN', {
          month: 'numeric',
          day: 'numeric',
        });
        const category = tx.category?.name || '未分类';

        // 预算信息
        let budgetInfo = '';
        if (tx.budget) {
          const budgetOwner = tx.budget.familyMember?.name || tx.budget.user?.name;
          if (budgetOwner && tx.budget.name !== budgetOwner) {
            budgetInfo = ` (${budgetOwner})`;
          }
        }

        message += `${index + 1}. ${date} ${type} ¥${tx.amount.toFixed(
          2,
        )} ${category}${budgetInfo}\n`;
      });

      return message;
    } catch (error) {
      logger.error('获取最近记账失败:', error);
      return '获取记账记录失败，请稍后重试。';
    }
  }

  /**
   * 获取指定时间范围的统计
   */
  async getTimeRangeStats(
    userId: string,
    accountBookId: string,
    startDate: Date,
    endDate: Date,
    period: string,
  ): Promise<string> {
    try {
      // 验证权限
      const accountBook = await this.validateAccountBookAccess(userId, accountBookId);
      if (!accountBook) {
        return '无权访问该账本统计信息。';
      }

      // 获取时间范围内的统计
      const stats = await prisma.transaction.groupBy({
        by: ['type'],
        where: {
          accountBookId,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: {
          amount: true,
        },
        _count: {
          id: true,
        },
      });

      const expenseStats = stats.find((s) => s.type === 'EXPENSE');
      const incomeStats = stats.find((s) => s.type === 'INCOME');

      const totalExpense = Number(expenseStats?._sum.amount || 0);
      const totalIncome = Number(incomeStats?._sum.amount || 0);
      const expenseCount = expenseStats?._count.id || 0;
      const incomeCount = incomeStats?._count.id || 0;

      let message = `📊 ${accountBook.name} ${period}统计\n\n`;
      message += `💰 收入：¥${totalIncome.toFixed(2)} (${incomeCount}笔)\n`;
      message += `💸 支出：¥${totalExpense.toFixed(2)} (${expenseCount}笔)\n`;
      message += `📈 结余：¥${(totalIncome - totalExpense).toFixed(2)}\n`;

      // 如果有记账，显示最近几笔
      if (expenseCount > 0 || incomeCount > 0) {
        const recentTransactions = await prisma.transaction.findMany({
          where: {
            accountBookId,
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
          include: { category: true },
          orderBy: { date: 'desc' },
          take: 3,
        });

        if (recentTransactions.length > 0) {
          message += '\n📝 最近记账：\n';
          recentTransactions.forEach((tx, index) => {
            const type = tx.type === 'EXPENSE' ? '支出' : '收入';
            const date = new Date(tx.date).toLocaleDateString('zh-CN', {
              month: 'numeric',
              day: 'numeric',
            });
            message += `${index + 1}. ${date} ${type} ¥${tx.amount.toFixed(2)} ${tx.category?.name || '未分类'
              }\n`;
          });
        }
      }

      return message;
    } catch (error) {
      logger.error('获取时间范围统计失败:', error);
      return '获取统计信息失败，请稍后重试。';
    }
  }

  /**
   * 获取预算状态查询
   */
  async getBudgetStatus(userId: string, accountBookId: string): Promise<string> {
    try {
      // 验证权限
      const accountBook = await this.validateAccountBookAccess(userId, accountBookId);
      if (!accountBook) {
        return '无权访问该账本预算信息。';
      }

      // 获取当前活跃的预算
      const now = new Date();
      const budgets = await prisma.budget.findMany({
        where: {
          accountBookId,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        include: {
          category: true,
          user: { select: { name: true } },
          familyMember: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (budgets.length === 0) {
        return `📊 ${accountBook.name}\n\n暂无活跃预算`;
      }

      let message = `📊 ${accountBook.name} 预算执行情况\n\n`;

      for (const budget of budgets) {
        // 计算已使用金额
        const spent = await prisma.transaction.aggregate({
          where: {
            budgetId: budget.id,
            date: {
              gte: budget.startDate,
              lte: budget.endDate,
            },
          },
          _sum: { amount: true },
        });

        const spentAmount = Number(spent._sum.amount || 0);
        const totalAmount = Number(budget.amount) + Number(budget.rolloverAmount || 0);
        const remaining = totalAmount - spentAmount;
        const percentage = totalAmount > 0 ? (spentAmount / totalAmount) * 100 : 0;

        // 预算状态图标
        let statusIcon = '✅';
        if (percentage >= 100) {
          statusIcon = '🔴';
        } else if (percentage >= 80) {
          statusIcon = '⚠️';
        }

        // 预算名称
        let budgetName = budget.name;
        const budgetOwner = budget.familyMember?.name || budget.user?.name;
        if (budgetOwner && budget.name !== budgetOwner) {
          budgetName = `个人预算（${budgetOwner}）`;
        }

        message += `${statusIcon} ${budgetName}\n`;
        message += `💰 总额：¥${totalAmount.toFixed(2)} | 已用：¥${spentAmount.toFixed(2)}\n`;

        if (remaining >= 0) {
          message += `📈 剩余：¥${remaining.toFixed(2)} (${(100 - percentage).toFixed(1)}%)\n\n`;
        } else {
          message += `📈 超支：¥${Math.abs(remaining).toFixed(2)} (${percentage.toFixed(1)}%)\n\n`;
        }
      }

      return message.trim();
    } catch (error) {
      logger.error('获取预算状态失败:', error);
      return '获取预算状态失败，请稍后重试。';
    }
  }

  /**
   * 获取分类统计
   */
  async getCategoryStats(userId: string, accountBookId: string): Promise<string> {
    try {
      // 验证权限
      const accountBook = await this.validateAccountBookAccess(userId, accountBookId);
      if (!accountBook) {
        return '无权访问该账本分类统计。';
      }

      // 获取本月分类统计
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const categoryStats = await prisma.transaction.groupBy({
        by: ['categoryId', 'type'],
        where: {
          accountBookId,
          date: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        _sum: {
          amount: true,
        },
        _count: {
          id: true,
        },
      });

      // 获取分类信息
      const categoryIds = [...new Set(categoryStats.map((s) => s.categoryId))];
      const categories = await prisma.category.findMany({
        where: { id: { in: categoryIds } },
      });

      let message = `📊 ${accountBook.name} 本月分类统计\n\n`;

      // 支出分类统计
      const expenseStats = categoryStats.filter((s) => s.type === 'EXPENSE');
      if (expenseStats.length > 0) {
        message += '💸 支出分类：\n';
        expenseStats
          .sort((a, b) => Number(b._sum.amount || 0) - Number(a._sum.amount || 0))
          .slice(0, 5)
          .forEach((stat) => {
            const category = categories.find((c) => c.id === stat.categoryId);
            const amount = Number(stat._sum.amount || 0);
            const count = stat._count.id;
            message += `• ${category?.name || '未分类'}：¥${amount.toFixed(2)} (${count}笔)\n`;
          });
        message += '\n';
      }

      // 收入分类统计
      const incomeStats = categoryStats.filter((s) => s.type === 'INCOME');
      if (incomeStats.length > 0) {
        message += '💰 收入分类：\n';
        incomeStats
          .sort((a, b) => Number(b._sum.amount || 0) - Number(a._sum.amount || 0))
          .slice(0, 5)
          .forEach((stat) => {
            const category = categories.find((c) => c.id === stat.categoryId);
            const amount = Number(stat._sum.amount || 0);
            const count = stat._count.id;
            message += `• ${category?.name || '未分类'}：¥${amount.toFixed(2)} (${count}笔)\n`;
          });
      }

      return message;
    } catch (error) {
      logger.error('获取分类统计失败:', error);
      return '获取分类统计失败，请稍后重试。';
    }
  }
}
