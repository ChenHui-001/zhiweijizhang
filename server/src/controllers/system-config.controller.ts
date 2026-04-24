import { logger } from '../utils/logger';
import { Request, Response } from 'express';
import { SystemConfigService } from '../services/system-config.service';
import { LLMProviderService } from '../ai/llm/llm-provider-service';
import { TokenUsageService } from '../services/token-usage.service';

export class SystemConfigController {
  private systemConfigService: SystemConfigService;
  private tokenUsageService: TokenUsageService;
  private llmProviderService: LLMProviderService;

  constructor() {
    this.systemConfigService = new SystemConfigService();
    this.tokenUsageService = new TokenUsageService();
    this.llmProviderService = new LLMProviderService();
  }

  /**
   * 获取全局AI配置
   * 注意：此方法现在会检查用户级别的AI服务类型选择
   */
  async getGlobalAIConfig(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      // 🔥 首先检查全局AI配置是否启用
      const globalConfig = await this.systemConfigService.getGlobalAIConfig();

      // 如果有用户信息，检查用户的AI服务设置
      if (userId) {
        // 🔥🔥 最高优先级：检查用户级别的AI服务启用状态
        const userAIEnabled = await this.systemConfigService.getUserAIServiceEnabled(userId);
        logger.info(`🔍 [getGlobalAIConfig] 用户 ${userId} 的AI服务启用状态: ${userAIEnabled}`);

        if (!userAIEnabled) {
          logger.info(`❌ [getGlobalAIConfig] 用户已禁用AI服务，返回禁用状态`);
          res.json({
            success: true,
            data: {
              enabled: false,
              provider: '',
              model: '',
              baseUrl: '',
              temperature: 0.7,
              maxTokens: 1000,
              dailyTokenLimit: globalConfig.dailyTokenLimit,
              serviceType: 'disabled_by_user',
            },
          });
          return;
        }

        // 🔥 其次获取用户的AI服务类型选择
        const userServiceType = await this.systemConfigService.getUserAIServiceType(userId);
        logger.info(`🔍 [getGlobalAIConfig] 用户 ${userId} 的AI服务类型: ${userServiceType}`);

        if (userServiceType === 'custom') {
          // 🔥 用户选择了自定义服务，返回自定义服务信息
          logger.info(`🔍 [getGlobalAIConfig] 用户选择了自定义服务，获取自定义配置`);

          // 获取用户的自定义LLM设置
          const userLLMSetting = await this.llmProviderService.getUserDefaultLLMSetting(userId);

          if (userLLMSetting) {
            logger.info(`✅ [getGlobalAIConfig] 返回用户自定义LLM配置: ${userLLMSetting.name}`);
            res.json({
              success: true,
              data: {
                enabled: true,
                provider: userLLMSetting.provider,
                model: userLLMSetting.model,
                baseUrl: userLLMSetting.baseUrl,
                temperature: userLLMSetting.temperature,
                maxTokens: userLLMSetting.maxTokens,
                // 自定义服务没有每日Token限制，使用用户设置的maxTokens
                dailyTokenLimit: userLLMSetting.maxTokens || 1000,
                serviceType: 'custom',
                customServiceName: userLLMSetting.name,
              },
            });
            return;
          } else {
            logger.info(`⚠️ [getGlobalAIConfig] 用户选择了自定义服务但没有找到配置，返回需要配置提示`);
            // 没有找到自定义配置，返回提示用户需要配置自定义AI
            res.json({
              success: true,
              data: {
                enabled: false,
                provider: '',
                model: '',
                baseUrl: '',
                temperature: 0.7,
                maxTokens: 1000,
                dailyTokenLimit: 0,
                serviceType: 'custom',
                needsCustomConfig: true, // 标记需要配置自定义AI
                message: '请先在设置中配置自定义AI服务',
              },
            });
            return;
          }
        }

        // 🔥 用户选择了官方服务，或者自定义服务回退，检查全局服务状态
        if (!globalConfig.enabled) {
          logger.info(`❌ [getGlobalAIConfig] 全局AI服务未启用，返回禁用状态`);
          res.json({
            success: true,
            data: {
              enabled: false,
              provider: '',
              model: '',
              baseUrl: '',
              temperature: 0.7,
              maxTokens: 1000,
              dailyTokenLimit: globalConfig.dailyTokenLimit,
              serviceType: 'official',
            },
          });
          return;
        }

        logger.info(`🔍 [getGlobalAIConfig] 使用官方AI服务逻辑`);
        const settings = await this.llmProviderService.getLLMSettings(userId);

        // 如果是多提供商模式，返回多提供商配置信息
        if ((settings as any).isMultiProvider) {
          // 获取多提供商配置概览
          const multiProviderConfig =
            await this.llmProviderService.multiProviderService.loadMultiProviderConfig();

          if (multiProviderConfig?.enabled) {
            const activeProviders = multiProviderConfig.providers.filter((p) => p.enabled);

            res.json({
              success: true,
              data: {
                enabled: true,
                provider: 'multi-provider',
                model: `${activeProviders.length} 个提供商`,
                baseUrl: 'Multi-Provider Mode',
                temperature: 0.7,
                maxTokens: 1000,
                dailyTokenLimit: globalConfig.dailyTokenLimit, // 保持dailyTokenLimit字段以兼容前端
                isMultiProvider: true,
                providersCount: activeProviders.length,
                primaryProvider: activeProviders.length > 0 ? activeProviders[0].name : null,
                serviceType: 'official',
              },
            });
            return;
          }
        }

        // 否则返回实际的LLM设置（需要补充dailyTokenLimit字段）
        res.json({
          success: true,
          data: {
            enabled: true,
            provider: settings.provider,
            model: settings.model,
            baseUrl: settings.baseUrl,
            temperature: settings.temperature,
            maxTokens: settings.maxTokens,
            dailyTokenLimit: globalConfig.dailyTokenLimit, // 从全局配置获取dailyTokenLimit
            serviceType: 'official',
          },
        });
        return;
      }

      // 如果没有用户信息，直接返回全局配置
      res.json({
        success: true,
        data: {
          ...globalConfig,
          serviceType: 'official',
        },
      });
    } catch (error) {
      logger.error('获取全局AI配置错误:', error);
      res.status(500).json({
        success: false,
        message: '获取全局AI配置失败',
      });
    }
  }

  /**
   * 获取AI服务状态
   */
  async getAIServiceStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = await this.systemConfigService.getAIServiceStatus();

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error('获取AI服务状态错误:', error);
      res.status(500).json({
        success: false,
        message: '获取AI服务状态失败',
      });
    }
  }

  /**
   * 获取当前用户TOKEN使用量统计
   */
  async getTokenUsage(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: '用户未认证',
        });
        return;
      }

      const { startDate, endDate } = req.query;
      const usage = await this.tokenUsageService.getUserTokenUsage(userId, {
        startDate: startDate as string,
        endDate: endDate as string,
      });

      res.json({
        success: true,
        data: usage,
      });
    } catch (error) {
      logger.error('获取TOKEN使用量错误:', error);
      res.status(500).json({
        success: false,
        message: '获取TOKEN使用量失败',
      });
    }
  }

  /**
   * 获取今日TOKEN使用量
   */
  async getTodayTokenUsage(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: '用户未认证',
        });
        return;
      }

      const usage = await this.tokenUsageService.getTodayTokenUsage(userId);

      res.json({
        success: true,
        data: usage,
      });
    } catch (error) {
      logger.error('获取今日TOKEN使用量错误:', error);
      res.status(500).json({
        success: false,
        message: '获取今日TOKEN使用量失败',
      });
    }
  }

  /**
   * 更新全局AI配置 - 已禁用，仅管理员可操作
   */
  async updateGlobalAIConfig(req: Request, res: Response): Promise<void> {
    res.status(403).json({
      success: false,
      message: '普通用户无权修改全局AI配置，请联系管理员',
    });
  }

  /**
   * 获取用户的AI服务类型选择
   */
  async getUserAIServiceType(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: '用户未认证',
        });
        return;
      }

      const serviceType = await this.systemConfigService.getUserAIServiceType(userId);

      res.json({
        success: true,
        data: {
          serviceType,
        },
      });
    } catch (error) {
      logger.error('获取用户AI服务类型错误:', error);
      res.status(500).json({
        success: false,
        message: '获取用户AI服务类型失败',
      });
    }
  }

  /**
   * 切换AI服务类型
   */
  async switchAIServiceType(req: Request, res: Response): Promise<void> {
    try {
      const { serviceType, serviceId, accountId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: '用户未认证',
        });
        return;
      }

      const result = await this.systemConfigService.switchAIServiceType(
        userId,
        serviceType,
        serviceId,
        accountId,
      );

      res.json({
        success: result.success,
        message: result.message,
      });
    } catch (error) {
      logger.error('切换AI服务类型错误:', error);
      res.status(500).json({
        success: false,
        message: '切换AI服务类型失败',
      });
    }
  }

  /**
   * 获取用户级别的AI服务启用状态
   */
  async getUserAIServiceEnabled(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: '用户未认证',
        });
        return;
      }

      const enabled = await this.systemConfigService.getUserAIServiceEnabled(userId);

      res.json({
        success: true,
        data: { enabled },
      });
    } catch (error) {
      logger.error('获取用户AI服务状态错误:', error);
      res.status(500).json({
        success: false,
        message: '获取用户AI服务状态失败',
      });
    }
  }

  /**
   * 切换用户级别的AI服务启用状态
   */
  async toggleUserAIService(req: Request, res: Response): Promise<void> {
    try {
      const { enabled } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: '用户未认证',
        });
        return;
      }

      await this.systemConfigService.setUserAIServiceEnabled(userId, enabled);

      res.json({
        success: true,
        message: enabled ? 'AI服务已启用' : 'AI服务已禁用',
      });
    } catch (error) {
      logger.error('切换用户AI服务状态错误:', error);
      res.status(500).json({
        success: false,
        message: '切换AI服务状态失败',
      });
    }
  }

  /**
   * 测试AI服务连接
   */
  async testAIServiceConnection(req: Request, res: Response): Promise<void> {
    try {
      const { serviceType, serviceId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: '用户未认证',
        });
        return;
      }

      const startTime = Date.now();
      const result = await this.systemConfigService.testAIServiceConnection(
        userId,
        serviceType,
        serviceId,
      );
      const responseTime = Date.now() - startTime;

      res.json({
        success: result.success,
        message: result.message,
        responseTime,
      });
    } catch (error) {
      logger.error('测试AI服务连接错误:', error);
      res.status(500).json({
        success: false,
        message: '测试AI服务连接失败',
      });
    }
  }
}
