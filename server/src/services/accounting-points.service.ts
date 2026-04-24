import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';
import type {
  UserAccountingPoints,
  AccountingPointsTransactions,
  UserCheckins
} from '@prisma/client';
import { MembershipService } from './membership.service';
import { getLocalDateString } from '../utils/date-helpers';

const prisma = new PrismaClient();

/**
 * 记账点系统服务
 */
class AccountingPointsService {
  // 记账点消费标准（调高到999999，确保使用官方AI时无法使用，鼓励用户使用自定义AI）
  static POINT_COSTS = {
    text: 999999,    // LLM文字记账：999999点（几乎无法使用官方AI）
    voice: 999999,   // 语音识别：999999点（几乎无法使用官方AI）
    image: 999999     // 图片识别：999999点（几乎无法使用官方AI）
  };

  // 签到奖励点数
  static CHECKIN_REWARD = 5;

  // 每日赠送点数
  static DAILY_GIFT = 5;

  // 注册赠送点数（默认值，可通过系统配置覆盖）
  static REGISTRATION_GIFT = 30;

  // 赠送余额上限
  static GIFT_BALANCE_LIMIT = 10000;

  /**
   * 检查记账点系统是否启用
   */
  static isSystemEnabled(): boolean {
    const membershipService = new MembershipService();
    return membershipService.isAccountingPointsEnabled();
  }

  /**
   * 获取北京时间的今日日期字符串
   */
  static getBeijingToday(): string {
    const now = new Date();
    // 转换为北京时间 (UTC+8)
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    return beijingTime.toISOString().split('T')[0];
  }

  /**
   * 获取北京时间的今日开始时间
   */
  static getBeijingTodayStart(): Date {
    const today = this.getBeijingToday();
    // 创建表示北京时间0点的UTC时间
    const beijingMidnight = new Date(today + 'T00:00:00+08:00');
    return beijingMidnight;
  }

  /**
   * 根据日期字符串创建用于数据库查询的Date对象
   * 使用UTC时间来避免时区问题
   */
  static createDateForDB(dateString: string): Date {
    return new Date(dateString + 'T00:00:00.000Z');
  }

  /**
   * 获取用户记账点余额
   */
  static async getUserPoints(userId: string): Promise<UserAccountingPoints> {
    logger.info('🔍 [AccountingPointsService] 开始获取用户记账点，用户ID:', userId);
    
    let userPoints = await prisma.userAccountingPoints.findUnique({
      where: { userId }
    });

    logger.debug('📊 [AccountingPointsService] 数据库查询结果:', userPoints);

    // 如果用户没有记账点账户，创建一个
    if (!userPoints) {
      logger.info('🆕 [AccountingPointsService] 用户没有记账点账户，正在创建...');
      userPoints = await this.createUserPointsAccount(userId);
      logger.info('✅ [AccountingPointsService] 记账点账户创建完成:', userPoints);
    }

    return userPoints;
  }

  /**
   * 获取注册赠送点数（从系统配置读取，如果没有配置则使用默认值）
   */
  static async getRegistrationGiftPoints(): Promise<number> {
    try {
      const config = await prisma.systemConfig.findUnique({
        where: { key: 'registration_gift_points' }
      });

      if (config && config.value) {
        const points = parseInt(config.value);
        return isNaN(points) ? this.REGISTRATION_GIFT : points;
      }

      return this.REGISTRATION_GIFT;
    } catch (error) {
      logger.error('获取注册赠送点数配置失败:', error);
      return this.REGISTRATION_GIFT;
    }
  }

  /**
   * 为用户创建记账点账户
   */
  static async createUserPointsAccount(userId: string): Promise<UserAccountingPoints> {
    const registrationGift = await this.getRegistrationGiftPoints();

    const userPoints = await prisma.userAccountingPoints.create({
      data: {
        userId,
        giftBalance: registrationGift,
        memberBalance: 0
      }
    });

    // 记录初始化记录
    await this.recordTransaction(userId, 'registration', 'add', registrationGift, 'gift', registrationGift, '注册赠送记账点');

    return userPoints;
  }

  /**
   * 检查用户是否有足够的记账点
   */
  static async canUsePoints(userId: string, pointsNeeded: number): Promise<boolean> {
    // 如果记账点系统未启用，直接返回 true（允许使用）
    if (!this.isSystemEnabled()) {
      return true;
    }

    const userPoints = await this.getUserPoints(userId);
    const totalBalance = userPoints.giftBalance + userPoints.memberBalance;
    return totalBalance >= pointsNeeded;
  }

  /**
   * 消费记账点（优先使用会员余额）
   * 使用数据库事务确保并发安全
   */
  static async deductPoints(userId: string, type: string, pointsNeeded: number): Promise<{
    giftBalance: number;
    memberBalance: number;
    totalDeducted: number;
  }> {
    // 如果记账点系统未启用，返回模拟的结果而不执行实际扣除
    if (!this.isSystemEnabled()) {
      const userPoints = await this.getUserPoints(userId);
      return {
        giftBalance: userPoints.giftBalance,
        memberBalance: userPoints.memberBalance,
        totalDeducted: 0
      };
    }

    return await prisma.$transaction(async (tx) => {
      // 在事务中重新获取最新的用户记账点信息
      const userPoints = await tx.userAccountingPoints.findUnique({
        where: { userId }
      });

      if (!userPoints) {
        throw new Error('用户记账点账户不存在');
      }

      const totalBalance = userPoints.giftBalance + userPoints.memberBalance;

      if (totalBalance < pointsNeeded) {
        throw new Error('记账点余额不足');
      }

      let remainingPoints = pointsNeeded;
      let newGiftBalance = userPoints.giftBalance;
      let newMemberBalance = userPoints.memberBalance;

      // 优先扣除会员余额
      if (remainingPoints > 0 && newMemberBalance > 0) {
        const deductFromMember = Math.min(remainingPoints, newMemberBalance);
        newMemberBalance -= deductFromMember;
        remainingPoints -= deductFromMember;

        // 记录会员余额扣除
        await tx.accountingPointsTransactions.create({
          data: {
            userId,
            type,
            operation: 'deduct',
            points: deductFromMember,
            balanceType: 'member',
            balanceAfter: newMemberBalance,
            description: `${this.getTypeDescription(type)}消费记账点`
          }
        });
      }

      // 如果还有剩余，扣除赠送余额
      if (remainingPoints > 0 && newGiftBalance > 0) {
        const deductFromGift = Math.min(remainingPoints, newGiftBalance);
        newGiftBalance -= deductFromGift;
        remainingPoints -= deductFromGift;

        // 记录赠送余额扣除
        await tx.accountingPointsTransactions.create({
          data: {
            userId,
            type,
            operation: 'deduct',
            points: deductFromGift,
            balanceType: 'gift',
            balanceAfter: newGiftBalance,
            description: `${this.getTypeDescription(type)}消费记账点`
          }
        });
      }

      // 更新用户记账点余额
      await tx.userAccountingPoints.update({
        where: { userId },
        data: {
          giftBalance: newGiftBalance,
          memberBalance: newMemberBalance
        }
      });

      return {
        giftBalance: newGiftBalance,
        memberBalance: newMemberBalance,
        totalDeducted: pointsNeeded
      };
    });
  }

  /**
   * 增加记账点
   * 使用数据库原子操作确保并发安全
   */
  static async addPoints(
    userId: string, 
    type: string, 
    points: number, 
    balanceType: 'gift' | 'member' = 'gift', 
    description: string = ''
  ): Promise<number> {
    return await prisma.$transaction(async (tx) => {
      // 确保用户记账点账户存在
      await tx.userAccountingPoints.upsert({
        where: { userId },
        create: {
          userId,
          giftBalance: 0,
          memberBalance: 0
        },
        update: {}
      });

      // 使用数据库级别的原子操作更新余额
      let updatedPoints;
      if (balanceType === 'gift') {
        updatedPoints = await tx.userAccountingPoints.update({
          where: { userId },
          data: { 
            giftBalance: { increment: points }
          }
        });
      } else {
        updatedPoints = await tx.userAccountingPoints.update({
          where: { userId },
          data: { 
            memberBalance: { increment: points }
          }
        });
      }

      const newBalance = balanceType === 'gift' ? updatedPoints.giftBalance : updatedPoints.memberBalance;

      // 记录记账
      await tx.accountingPointsTransactions.create({
        data: {
          userId,
          type,
          operation: 'add',
          points,
          balanceType,
          balanceAfter: newBalance,
          description
        }
      });

      return newBalance;
    });
  }

  /**
   * 记录记账点记账
   */
  static async recordTransaction(
    userId: string, 
    type: string, 
    operation: 'add' | 'deduct', 
    points: number, 
    balanceType: 'gift' | 'member', 
    balanceAfter: number, 
    description: string = ''
  ): Promise<AccountingPointsTransactions> {
    return await prisma.accountingPointsTransactions.create({
      data: {
        userId,
        type,
        operation,
        points,
        balanceType,
        balanceAfter,
        description
      }
    });
  }

  /**
   * 用户签到
   */
  static async checkin(userId: string): Promise<{
    checkin: UserCheckins;
    newBalance: number;
  }> {
    // 使用北京时间获取今天的日期
    const today = this.getBeijingToday(); // YYYY-MM-DD格式
    
    // 检查今天是否已经签到
    const existingCheckin = await prisma.userCheckins.findUnique({
      where: {
        userId_checkinDate: {
          userId,
          checkinDate: this.createDateForDB(today)
        }
      }
    });

    if (existingCheckin) {
      throw new Error('今天已经签到过了');
    }

    // 创建签到记录
    const checkin = await prisma.userCheckins.create({
      data: {
        userId,
        checkinDate: this.createDateForDB(today),
        pointsAwarded: this.CHECKIN_REWARD
      }
    });

    // 增加记账点
    const newBalance = await this.addPoints(
      userId, 
      'checkin', 
      this.CHECKIN_REWARD, 
      'gift', 
      '每日签到奖励'
    );

    return {
      checkin,
      newBalance
    };
  }

  /**
   * 获取用户签到历史
   */
  static async getUserCheckinHistory(userId: string, days: number = 30): Promise<Array<{
    date: string;
    isCheckedIn: boolean;
    pointsAwarded: number;
  }>> {
    // 使用北京时间计算日期范围
    const beijingNow = new Date(new Date().getTime() + 8 * 60 * 60 * 1000);

    // 计算开始日期和结束日期的字符串
    const endDateStr = beijingNow.toISOString().split('T')[0];
    const startDateObj = new Date(beijingNow);
    startDateObj.setDate(startDateObj.getDate() - days + 1);
    const startDateStr = startDateObj.toISOString().split('T')[0];

    // 使用UTC日期进行数据库查询
    const startDateUTC = this.createDateForDB(startDateStr);
    const endDateUTC = this.createDateForDB(endDateStr);

    // 获取用户在指定时间范围内的签到记录
    const checkins = await prisma.userCheckins.findMany({
      where: {
        userId,
        checkinDate: {
          gte: startDateUTC,
          lte: endDateUTC
        }
      },
      orderBy: {
        checkinDate: 'asc'
      }
    });

    // 生成完整的日期范围历史（使用北京时间）
    const history = [];
    for (let i = 0; i < days; i++) {
      // 计算北京时间的日期
      const beijingDate = new Date(beijingNow);
      beijingDate.setDate(beijingDate.getDate() - days + 1 + i);

      // 直接构造日期字符串，避免时区转换问题
      const year = beijingDate.getUTCFullYear();
      const month = String(beijingDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(beijingDate.getUTCDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;

      const checkinRecord = checkins.find(c =>
        c.checkinDate.toISOString().split('T')[0] === dateString
      );

      history.push({
        date: dateString,
        isCheckedIn: !!checkinRecord,
        pointsAwarded: checkinRecord?.pointsAwarded || 0
      });
    }

    return history;
  }

  /**
   * 获取用户连续签到天数
   */
  static async getUserConsecutiveCheckinDays(userId: string): Promise<number> {
    // 使用北京时间
    const beijingNow = new Date(new Date().getTime() + 8 * 60 * 60 * 1000);
    let consecutiveDays = 0;

    for (let i = 0; i < 365; i++) { // 最多检查一年
      const checkDate = new Date(beijingNow);
      checkDate.setDate(checkDate.getDate() - i);
      const dateString = checkDate.toISOString().split('T')[0];

      const checkin = await prisma.userCheckins.findUnique({
        where: {
          userId_checkinDate: {
            userId,
            checkinDate: this.createDateForDB(dateString)
          }
        }
      });

      if (checkin) {
        consecutiveDays++;
      } else {
        // 如果是今天且未签到，继续检查昨天
        if (i === 0) {
          continue;
        } else {
          break;
        }
      }
    }

    return consecutiveDays;
  }

  /**
   * 检查用户今天是否已经签到
   */
  static async hasCheckedInToday(userId: string): Promise<boolean> {
    const today = this.getBeijingToday();
    
    const checkin = await prisma.userCheckins.findUnique({
      where: {
        userId_checkinDate: {
          userId,
          checkinDate: this.createDateForDB(today)
        }
      }
    });

    return !!checkin;
  }

  /**
   * 检查并执行每日首次访问赠送记账点
   * 当用户每日首次调用API时调用此方法
   * 使用数据库事务和唯一约束确保并发安全，使用北京时间作为基准
   */
  static async checkAndGiveDailyPoints(userId: string): Promise<{
    isFirstVisitToday: boolean;
    newBalance?: number;
    pointsGiven?: number;
  }> {
    return await prisma.$transaction(async (tx) => {
      // 使用北京时间获取今日日期
      const today = this.getBeijingToday(); // YYYY-MM-DD格式
      const todayDate = this.getBeijingTodayStart();

      try {
        // 尝试创建今日赠送记录，如果已存在则会因唯一约束失败
        // 这是防止并发重复赠送的关键步骤
        const giftRecord = await tx.dailyGiftRecords.create({
          data: {
            userId,
            giftDate: todayDate,
            pointsGiven: 0 // 先创建记录，稍后更新实际赠送点数
          }
        });

        // 如果能成功创建记录，说明今天确实是首次访问
        logger.info('🎁 [AccountingPointsService] 今日首次访问，用户ID:', userId, '日期:', today);

        // 确保用户记账点账户存在
        let userPoints = await tx.userAccountingPoints.findUnique({
          where: { userId }
        });

        if (!userPoints) {
          userPoints = await tx.userAccountingPoints.create({
            data: {
              userId,
              giftBalance: 0,
              memberBalance: 0
            }
          });
        }

        // 检查赠送余额是否已达上限
        let pointsToGive = 0;
        if (userPoints.giftBalance < this.GIFT_BALANCE_LIMIT) {
          pointsToGive = Math.min(
            this.DAILY_GIFT,
            this.GIFT_BALANCE_LIMIT - userPoints.giftBalance
          );
        }

        logger.info('💰 [AccountingPointsService] 计算赠送点数:', {
          currentBalance: userPoints.giftBalance,
          limit: this.GIFT_BALANCE_LIMIT,
          dailyGift: this.DAILY_GIFT,
          pointsToGive
        });

        if (pointsToGive > 0) {
          // 使用原子操作更新余额
          const updatedPoints = await tx.userAccountingPoints.update({
            where: { userId },
            data: {
              giftBalance: { increment: pointsToGive },
              lastDailyGiftDate: todayDate // 保持向后兼容
            }
          });

          const newGiftBalance = updatedPoints.giftBalance;

          // 更新赠送记录中的实际赠送点数
          await tx.dailyGiftRecords.update({
            where: { id: giftRecord.id },
            data: { pointsGiven: pointsToGive }
          });

          // 记录记账
          await tx.accountingPointsTransactions.create({
            data: {
              userId,
              type: 'daily_first_visit',
              operation: 'add',
              points: pointsToGive,
              balanceType: 'gift',
              balanceAfter: newGiftBalance,
              description: '每日首次访问赠送记账点'
            }
          });

          logger.info('✅ [AccountingPointsService] 赠送成功:', {
            pointsGiven: pointsToGive,
            newBalance: newGiftBalance
          });

          return {
            isFirstVisitToday: true,
            newBalance: newGiftBalance,
            pointsGiven: pointsToGive
          };
        } else {
          // 即使没有赠送点数，也要更新lastDailyGiftDate保持向后兼容
          await tx.userAccountingPoints.update({
            where: { userId },
            data: { lastDailyGiftDate: todayDate }
          });

          logger.info('ℹ️ [AccountingPointsService] 首次访问但未赠送点数（已达上限）');

          return {
            isFirstVisitToday: true,
            pointsGiven: 0
          };
        }

      } catch (error: any) {
        // 如果是唯一约束冲突，说明今天已经赠送过了
        if (error.code === 'P2002' && error.meta?.target?.includes('user_id') && error.meta?.target?.includes('gift_date')) {
          //logger.info('ℹ️ [AccountingPointsService] 今日已赠送过记账点，用户ID:', userId, '日期:', today);
          return {
            isFirstVisitToday: false
          };
        }

        // 其他错误重新抛出
        logger.error('❌ [AccountingPointsService] 每日赠送检查失败:', error);
        throw error;
      }
    });
  }
  static async dailyGiftPoints(): Promise<void> {
    // 获取所有用户
    const users = await prisma.user.findMany({
      select: { id: true }
    });

    for (const user of users) {
      const userPoints = await this.getUserPoints(user.id);
      
      // 只有赠送余额小于上限才赠送
      if (userPoints.giftBalance < this.GIFT_BALANCE_LIMIT) {
        const pointsToAdd = Math.min(
          this.DAILY_GIFT, 
          this.GIFT_BALANCE_LIMIT - userPoints.giftBalance
        );
        
        if (pointsToAdd > 0) {
          await this.addPoints(
            user.id, 
            'daily', 
            pointsToAdd, 
            'gift', 
            '每日赠送记账点'
          );
        }
      }
    }
  }

  /**
   * 获取用户记账记录
   */
  static async getUserTransactions(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<AccountingPointsTransactions[]> {
    const transactions = await prisma.accountingPointsTransactions.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    // 添加调试日志
    logger.info(`🔍 [AccountingPointsService] 获取用户 ${userId} 的记账记录，数量: ${transactions.length}`);
    if (transactions.length > 0) {
      logger.info(`🔍 [AccountingPointsService] 第一条记录时间: ${transactions[0].createdAt}`);
      logger.info(`🔍 [AccountingPointsService] 最后一条记录时间: ${transactions[transactions.length - 1].createdAt}`);
    }

    return transactions;
  }

  /**
   * 管理员手动添加记账点
   */
  static async adminAddPoints(userId: string, points: number, description: string = '管理员手动添加'): Promise<number> {
    return await this.addPoints(userId, 'admin', points, 'gift', description);
  }

  /**
   * 获取每日活跃用户统计
   * @param date 日期，格式 YYYY-MM-DD，默认为今天
   */
  static async getDailyActiveUsersStats(date?: string): Promise<{
    date: string;
    activeUsers: number;
    totalPointsGiven: number;
  }> {
    const targetDate = date || getLocalDateString();
    
    // 统计今天首次访问的用户数量（基于赠送记录）
    const stats = await prisma.accountingPointsTransactions.aggregate({
      where: {
        type: 'daily_first_visit',
        createdAt: {
          gte: new Date(targetDate),
          lt: new Date(new Date(targetDate).getTime() + 24 * 60 * 60 * 1000)
        }
      },
      _count: {
        userId: true
      },
      _sum: {
        points: true
      }
    });
    
    return {
      date: targetDate,
      activeUsers: stats._count.userId || 0,
      totalPointsGiven: stats._sum.points || 0
    };
  }

  /**
   * 获取历史日活跃用户统计
   * @param days 获取最近多少天的数据，默认7天
   */
  static async getHistoricalDailyActiveStats(days: number = 7): Promise<Array<{
    date: string;
    activeUsers: number;
    totalPointsGiven: number;
  }>> {
    const results = [];

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const stats = await this.getDailyActiveUsersStats(dateStr);
      results.push(stats);
    }

    return results.reverse(); // 返回按日期正序排列的结果
  }

  /**
   * 获取去重的活跃用户统计
   * @param days 获取最近多少天的数据，默认7天
   */
  static async getUniqueActiveUsersStats(days: number = 7): Promise<{
    uniqueActiveUsers: number;
    totalPointsGiven: number;
    periodDays: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const endDate = new Date();

    // 使用聚合查询获取去重的活跃用户数和总点数
    const result = await prisma.accountingPointsTransactions.groupBy({
      by: ['userId'],
      where: {
        type: 'daily_first_visit',
        createdAt: {
          gte: startDate,
          lt: endDate
        }
      },
      _sum: {
        points: true
      }
    });

    const uniqueActiveUsers = result.length;
    const totalPointsGiven = result.reduce((sum, user) => sum + (user._sum.points || 0), 0);

    return {
      uniqueActiveUsers,
      totalPointsGiven,
      periodDays: days
    };
  }
  /**
   * 获取类型描述
   */
  static getTypeDescription(type: string): string {
    const descriptions: Record<string, string> = {
      text: '文本AI',
      voice: '语音AI',
      image: '图像AI',
      gift: '赠送',
      member: '会员',
      daily: '每日',
      daily_first_visit: '每日首次访问',
      checkin: '签到',
      admin: '管理员'
    };
    return descriptions[type] || type;
  }

  /**
   * 获取所有用户记账点统计
   */
  static async getAllUsersPointsStats(limit: number = 50, offset: number = 0): Promise<{
    users: Array<{
      userId: string;
      giftBalance: number;
      memberBalance: number;
      totalBalance: number;
      user: {
        name: string;
        email: string;
      };
    }>;
    total: number;
  }> {
    const [users, total] = await Promise.all([
      prisma.userAccountingPoints.findMany({
        include: {
          user: {
            select: {
              name: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        skip: offset
      }),
      prisma.userAccountingPoints.count()
    ]);

    return {
      users: users.map(u => ({
        userId: u.userId,
        giftBalance: u.giftBalance,
        memberBalance: u.memberBalance,
        totalBalance: u.giftBalance + u.memberBalance,
        user: u.user
      })),
      total
    };
  }
}

export default AccountingPointsService; 