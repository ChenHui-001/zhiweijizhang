/**
 * 跨平台同步服务
 * 注意：会员同步功能已移除，此服务待后续扩展
 */

import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  errors: string[];
  details: {
    userId: string;
    fromPlatform: string;
    toPlatform: string;
    action: 'created' | 'updated' | 'skipped';
  }[];
}

/**
 * 跨平台同步服务类
 */
export class CrossPlatformSyncService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * 清理资源
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

/**
 * 跨平台同步任务调度器
 */
export class CrossPlatformSyncScheduler {
  private syncService: CrossPlatformSyncService;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.syncService = new CrossPlatformSyncService();
  }

  /**
   * 停止定时同步任务
   */
  stopScheduledSync(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('⏹️  [CrossPlatformSyncScheduler] 定时同步任务已停止');
    }
  }

  /**
   * 获取同步状态
   */
  getSyncStatus(): {
    isRunning: boolean;
    intervalMinutes?: number;
  } {
    return {
      isRunning: this.intervalId !== null,
      intervalMinutes: this.intervalId ? 60 : undefined
    };
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    this.stopScheduledSync();
    await this.syncService.disconnect();
  }
}

export default CrossPlatformSyncService;
