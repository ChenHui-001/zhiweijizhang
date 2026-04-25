import { logger } from '../utils/logger';
import * as cron from 'node-cron';
import { BudgetSchedulerService } from '../services/budget-scheduler.service';

/**
 * 定时任务调度器
 */
class TaskScheduler {
  /**
   * 启动所有定时任务
   */
  static start(): void {
    logger.info('[定时任务] 启动定时任务调度器...');

    // 每月1号凌晨2点执行预算结转和创建任务
    cron.schedule('0 2 1 * *', async () => {
      logger.info('[定时任务] 开始执行预算结转和创建任务...');
      try {
        const budgetScheduler = new BudgetSchedulerService();
        await budgetScheduler.runAllScheduledTasks();
        logger.info('[定时任务] 预算结转和创建任务完成');
      } catch (error) {
        logger.error('[定时任务] 预算结转和创建任务失败:', error);
      }
    }, {
      timezone: 'Asia/Shanghai' // 使用北京时间
    });

    logger.info('[定时任务] 定时任务调度器启动完成（已启用预算结转定时任务）');
  }

  /**
   * 手动执行预算结转任务（用于测试和修复）
   */
  static async runBudgetRolloverTasks(): Promise<void> {
    logger.info('[手动任务] 开始执行预算结转任务...');
    try {
      const budgetScheduler = new BudgetSchedulerService();
      await budgetScheduler.runAllScheduledTasks();
      logger.info('[手动任务] 预算结转任务完成');
    } catch (error) {
      logger.error('[手动任务] 预算结转任务失败:', error);
      throw error;
    }
  }
}

export default TaskScheduler;
