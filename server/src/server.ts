import app from './app';
import config from './config/config';
import { startAggregationService } from './admin/scripts/start-aggregation';
import { connectDatabase, disconnectDatabase } from './config/database';
import { UserDeletionService } from './services/user-deletion.service';
import TaskScheduler from './services/task-scheduler.service';
import WechatMediaCleanupTask from './tasks/wechat-media-cleanup.task';
import { FileStorageService } from './services/file-storage.service';
import { AICallLogAdminService } from './admin/services/ai-call-log.admin.service';
import { performanceMonitoringService } from './services/performance-monitoring.service';
import { MultiProviderLLMService } from './ai/llm/multi-provider-service';
import { ScheduledTaskAdminService } from './admin/services/scheduled-task.admin.service';
import { registerAllInternalTasks } from './admin/services/register-internal-tasks';

// 连接数据库
connectDatabase();

// 初始化文件存储服务
const initializeFileStorageService = async () => {
  try {
    console.log('初始化文件存储服务...');
    const fileStorageService = FileStorageService.getInstance();

    // 等待初始化完成
    let retryCount = 0;
    while (!fileStorageService.isStorageAvailable() && retryCount < 20) {
      await new Promise(resolve => setTimeout(resolve, 500));
      retryCount++;
    }

    if (fileStorageService.isStorageAvailable()) {
      console.log('✅ 文件存储服务初始化成功');
    } else {
      console.warn('⚠️ 文件存储服务初始化超时，但服务器继续启动');
    }
  } catch (error) {
    console.error('❌ 文件存储服务初始化失败:', error);
  }
};

// 启动服务器
const server = app.listen(config.port, '0.0.0.0', async () => {
  console.log(`服务器已启动，监听地址: 0.0.0.0:${config.port}`);
  console.log(`环境: ${config.env}`);

  // 初始化文件存储服务
  await initializeFileStorageService();

  // 初始化AI调用日志服务
  try {
    const aiCallLogService = new AICallLogAdminService();
    await aiCallLogService.initialize();
    console.log('✅ AI调用日志服务初始化成功');
  } catch (error) {
    console.error('❌ AI调用日志服务初始化失败:', error);
  }

  // 检查是否使用统一调度器
  const useUnifiedScheduler = process.env.USE_UNIFIED_SCHEDULER === 'true';

  if (useUnifiedScheduler) {
    console.log('🔄 使用统一计划任务调度器模式');

    // 注册所有内部任务
    try {
      registerAllInternalTasks();
      console.log('✅ 内部任务注册成功');
    } catch (error) {
      console.error('❌ 内部任务注册失败:', error);
    }

    // 启动计划任务服务（统一调度所有任务）
    try {
      scheduledTaskServiceInstance = new ScheduledTaskAdminService();
      await scheduledTaskServiceInstance.initializeScheduledTasks();
      console.log('✅ 计划任务服务启动成功');
    } catch (error) {
      console.error('❌ 计划任务服务启动失败:', error);
    }

    // 注意：预算结转任务仍然通过TaskScheduler启动（因为它已经在计划任务中）
    TaskScheduler.start();
  } else {
    console.log('🔄 使用传统独立任务调度器模式');

    // 启动数据聚合服务
    startAggregationService().catch(console.error);

    // 启动用户注销定时任务
    const userDeletionService = new UserDeletionService();
    userDeletionService.startScheduledDeletion();

    // 启动任务调度器（包含预算结转）
    TaskScheduler.start();

    // 启动微信媒体文件清理任务
    if (config.wechat) {
      const wechatCleanupTask = new WechatMediaCleanupTask();
      wechatCleanupTask.start();
    }

    // 注册内部任务（即使不使用统一调度器，也注册以便手动执行）
    try {
      registerAllInternalTasks();
      console.log('✅ 内部任务注册成功（可用于手动执行）');
    } catch (error) {
      console.error('❌ 内部任务注册失败:', error);
    }

    // 启动计划任务服务（用于管理其他脚本任务）
    try {
      scheduledTaskServiceInstance = new ScheduledTaskAdminService();
      await scheduledTaskServiceInstance.initializeScheduledTasks();
      console.log('✅ 计划任务服务启动成功');
    } catch (error) {
      console.error('❌ 计划任务服务启动失败:', error);
    }
  }

  // 启动性能监控服务
  try {
    await performanceMonitoringService.startMonitoring();
    console.log('✅ 性能监控服务启动成功');
  } catch (error) {
    console.error('❌ 性能监控服务启动失败:', error);
  }
});

// 处理进程终止信号
let scheduledTaskServiceInstance: ScheduledTaskAdminService | null = null;

const gracefulShutdown = async () => {
  console.log('正在关闭服务器...');

  // 停止计划任务服务
  try {
    if (scheduledTaskServiceInstance) {
      scheduledTaskServiceInstance.stopAllTasks();
      console.log('✅ 计划任务服务已停止');
    }
  } catch (error) {
    console.error('❌ 停止计划任务服务失败:', error);
  }

  // 停止性能监控服务
  try {
    performanceMonitoringService.stopMonitoring();
    console.log('✅ 性能监控服务已停止');
  } catch (error) {
    console.error('❌ 停止性能监控服务失败:', error);
  }

  // 清理多提供商LLM服务
  try {
    MultiProviderLLMService.destroy();
    console.log('✅ 多提供商LLM服务已清理');
  } catch (error) {
    console.error('❌ 清理多提供商LLM服务失败:', error);
  }

  server.close(async () => {
    console.log('服务器已关闭');
    await disconnectDatabase();
    process.exit(0);
  });
};

// 监听终止信号
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

export default server;
