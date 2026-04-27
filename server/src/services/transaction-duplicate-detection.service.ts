import { logger } from '../utils/logger';
import prisma from '../config/database';
import { SmartAccountingResult } from '../types/smart-accounting';

/**
 * 重复检测结果
 */
export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  confidence: number; // 0-1之间，1表示完全重复
  matchedTransactions: Array<{
    id: string;
    amount: number;
    description: string;
    date: Date;
    categoryName: string;
    similarity: number;
  }>;
  reason?: string;
}

/**
 * 记账记录重复检测服务
 */
export class TransactionDuplicateDetectionService {
  /**
   * 智能选择最合适的账本进行重复检测
   */
  static async selectBestAccountBookForDuplicateDetection(
    userId: string,
    defaultAccountBookId: string,
    analysisWindowDays: number = 30
  ): Promise<string> {
    try {
      // 计算分析时间窗口
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - analysisWindowDays);

      // 查询用户在分析窗口内的所有记账记录，按账本分组统计
      const accountBookStats = await prisma.$queryRaw<Array<{
        accountBookId: string;
        count: bigint;
        latestDate: Date;
        accountBookName: string;
      }>>`
        SELECT
          t.account_book_id as "accountBookId",
          COUNT(*) as count,
          MAX(t.date) as "latestDate",
          ab.name as "accountBookName"
        FROM transactions t
        LEFT JOIN account_books ab ON t.account_book_id = ab.id
        WHERE t.user_id = ${userId}
          AND t.date >= ${startDate}
          AND t.date <= ${endDate}
        GROUP BY t.account_book_id, ab.name
        ORDER BY count DESC, "latestDate" DESC
      `;

      logger.info(`📊 [智能账本匹配] 用户 ${userId} 最近${analysisWindowDays}天的账本使用统计:`);
      accountBookStats.forEach((stat, index) => {
        logger.info(`  ${index + 1}. ${stat.accountBookName} (${stat.accountBookId}): ${stat.count}条记录, 最新: ${stat.latestDate.toISOString().split('T')[0]}`);
      });

      // 如果有统计数据，选择最活跃的账本
      if (accountBookStats.length > 0) {
        const bestAccountBook = accountBookStats[0];
        logger.info(`✅ [智能账本匹配] 选择最活跃账本: ${bestAccountBook.accountBookName} (${bestAccountBook.count}条记录)`);
        return bestAccountBook.accountBookId;
      }

      // 如果没有最近的记账记录，使用默认账本
      logger.info(`📝 [智能账本匹配] 没有最近记录，使用默认账本: ${defaultAccountBookId}`);
      return defaultAccountBookId;
    } catch (error) {
      logger.error('智能账本选择失败:', error);
      // 出错时使用默认账本
      return defaultAccountBookId;
    }
  }

  /**
   * 检测单条记账记录是否重复
   */
  static async detectDuplicate(
    userId: string,
    accountBookId: string,
    record: SmartAccountingResult,
    timeWindowDays: number = 7
  ): Promise<DuplicateDetectionResult> {
    try {
      // 计算时间窗口（兼容Date和字符串类型）
      const recordDate = record.date instanceof Date ? record.date : new Date(record.date);
      const startDate = new Date(recordDate);
      startDate.setDate(startDate.getDate() - timeWindowDays);
      const endDate = new Date(recordDate);
      endDate.setDate(endDate.getDate() + timeWindowDays);

      // 查询时间窗口内的记账记录
      const existingTransactions = await prisma.transaction.findMany({
        where: {
          accountBookId,
          date: {
            gte: startDate,
            lte: endDate,
          },
          type: record.type,
        },
        include: {
          category: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          date: 'desc',
        },
      });

      if (existingTransactions.length === 0) {
        return {
          isDuplicate: false,
          confidence: 0,
          matchedTransactions: [],
        };
      }

      // 分析每条记录的相似度
      const matches = existingTransactions.map((transaction: any) => {
        const similarity = TransactionDuplicateDetectionService.calculateSimilarity(record, {
          amount: Number(transaction.amount),
          description: transaction.description || '',
          date: transaction.date,
          categoryName: transaction.category?.name || '',
        });

        return {
          id: transaction.id,
          amount: Number(transaction.amount),
          description: transaction.description || '',
          date: transaction.date,
          categoryName: transaction.category?.name || '',
          similarity,
        };
      });

      // 按相似度排序
      matches.sort((a: any, b: any) => b.similarity - a.similarity);

      // 取最高相似度作为重复置信度
      const highestSimilarity = matches[0]?.similarity || 0;
      // 新阈值：由于金额和日期必须完全一致，描述相似度50%以上就认为是重复
      const isDuplicate = highestSimilarity >= 0.5;

      // 只返回有意义的匹配记录（相似度大于0的记录）
      const significantMatches = matches.filter((match: any) => match.similarity > 0);

      return {
        isDuplicate,
        confidence: highestSimilarity,
        matchedTransactions: significantMatches.slice(0, 3), // 最多返回3条最相似的记录
        reason: isDuplicate ? this.generateDuplicateReason(record, matches[0]) : undefined,
      };
    } catch (error) {
      logger.error('重复检测失败:', error);
      return {
        isDuplicate: false,
        confidence: 0,
        matchedTransactions: [],
        reason: '检测失败',
      };
    }
  }

  /**
   * 带智能账本匹配的重复检测
   */
  static async detectDuplicateWithSmartAccountBook(
    userId: string,
    defaultAccountBookId: string,
    record: SmartAccountingResult,
    timeWindowDays: number = 7
  ): Promise<DuplicateDetectionResult> {
    // 智能选择最合适的账本
    const bestAccountBookId = await this.selectBestAccountBookForDuplicateDetection(
      userId,
      defaultAccountBookId
    );

    // 在最合适的账本中进行重复检测
    return this.detectDuplicate(userId, bestAccountBookId, record, timeWindowDays);
  }

  /**
   * 批量检测记账记录重复（带智能账本匹配）
   */
  static async detectBatchDuplicatesWithSmartAccountBook(
    userId: string,
    defaultAccountBookId: string,
    records: SmartAccountingResult[],
    timeWindowDays: number = 7
  ): Promise<Array<DuplicateDetectionResult & { recordIndex: number }>> {
    // 智能选择最合适的账本
    const bestAccountBookId = await this.selectBestAccountBookForDuplicateDetection(
      userId,
      defaultAccountBookId
    );

    // 在最合适的账本中进行批量重复检测
    return this.detectBatchDuplicates(userId, bestAccountBookId, records, timeWindowDays);
  }

  /**
   * 批量检测多条记账记录是否重复
   */
  static async detectBatchDuplicates(
    userId: string,
    accountBookId: string,
    records: SmartAccountingResult[],
    timeWindowDays: number = 7
  ): Promise<Array<DuplicateDetectionResult & { recordIndex: number }>> {
    const results = [];

    for (let i = 0; i < records.length; i++) {
      const result = await this.detectDuplicate(userId, accountBookId, records[i], timeWindowDays);
      results.push({
        ...result,
        recordIndex: i,
      });
    }

    return results;
  }

  /**
   * 计算两条记录的相似度
   * 新逻辑：金额必须完全一致才进行进一步检测
   */
  private static calculateSimilarity(
    record1: SmartAccountingResult | {
      amount: number;
      description: string;
      date: Date;
      categoryName: string;
    },
    record2: {
      amount: number;
      description: string;
      date: Date;
      categoryName: string;
    }
  ): number {
    // 第一步：金额必须完全一致，否则直接返回0
    if (record1.amount !== record2.amount) {
      return 0;
    }

    // 第二步：检查日期是否一致（同一天）
    const date1 = record1.date instanceof Date ? record1.date : new Date(record1.date);
    const date2 = record2.date;
    const isSameDate = TransactionDuplicateDetectionService.isSameDate(date1, date2);

    // 如果日期不同，直接返回0（不同日期的相同金额消费不算重复）
    if (!isSameDate) {
      return 0;
    }

    // 第三步：金额一致且日期一致，计算描述相似度
    const desc1 = (record1 as any).description || (record1 as any).note || '';
    const descriptionSimilarity = TransactionDuplicateDetectionService.calculateTextSimilarity(desc1, record2.description);

    // 第四步：可选的分类相似度加成
    const category1 = (record1 as any).categoryName || '';
    const categorySimilarity = TransactionDuplicateDetectionService.calculateTextSimilarity(category1, record2.categoryName);

    // 最终相似度计算：描述相似度为主(80%)，分类相似度为辅(20%)
    const finalSimilarity = descriptionSimilarity * 0.8 + categorySimilarity * 0.2;

    return finalSimilarity;
  }

  /**
   * 检查两个日期是否为同一天
   */
  private static isSameDate(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }



  /**
   * 计算文本相似度（简单的字符串匹配）
   */
  private static calculateTextSimilarity(text1: string, text2: string): number {
    if (!text1 && !text2) return 1;
    if (!text1 || !text2) return 0;

    const str1 = text1.toLowerCase().trim();
    const str2 = text2.toLowerCase().trim();

    if (str1 === str2) return 1;

    // 计算包含关系
    if (str1.includes(str2) || str2.includes(str1)) {
      return 0.8;
    }

    // 计算共同字符数
    const chars1 = new Set(str1);
    const chars2 = new Set(str2);
    const intersection = new Set([...chars1].filter(x => chars2.has(x)));
    const union = new Set([...chars1, ...chars2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }



  /**
   * 生成重复原因说明
   * 新逻辑：基于严格的重复检测条件
   */
  private static generateDuplicateReason(
    newRecord: SmartAccountingResult,
    matchedRecord: {
      amount: number;
      description: string;
      date: Date;
      categoryName: string;
      similarity: number;
    }
  ): string {
    const reasons = [];

    // 金额必定相同（这是重复检测的前提条件）
    reasons.push('金额完全相同');

    // 日期必定相同（这是重复检测的前提条件）
    reasons.push('日期相同');

    // 检查描述相似度
    const newDesc = (newRecord as any).description || (newRecord as any).note || '';
    if (newDesc && matchedRecord.description) {
      if (newDesc.toLowerCase() === matchedRecord.description.toLowerCase()) {
        reasons.push('描述完全相同');
      } else if (newDesc.toLowerCase().includes(matchedRecord.description.toLowerCase()) ||
                 matchedRecord.description.toLowerCase().includes(newDesc.toLowerCase())) {
        reasons.push('描述高度相似');
      } else {
        reasons.push('描述部分匹配');
      }
    }

    // 检查分类
    const newCategory = (newRecord as any).categoryName || '';
    if (newCategory && matchedRecord.categoryName) {
      if (newCategory.toLowerCase() === matchedRecord.categoryName.toLowerCase()) {
        reasons.push('分类相同');
      }
    }

    return reasons.join('、');
  }
}
