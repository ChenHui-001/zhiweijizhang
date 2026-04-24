import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import userAISmartAccountingService from '../services/user-ai-smart-accounting.service';

/**
 * 用户AI智能记账配置控制器
 * 处理用户AI配置相关的API请求
 */
export class UserAIConfigController {
  /**
   * 获取用户的所有AI配置
   * GET /api/ai-config/user/configs
   */
  public async getUserConfigs(req: Request, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: '未授权' });
      }

      logger.info(`获取用户 ${userId} 的AI配置`);

      const configs = await userAISmartAccountingService.getUserAIConfigs(userId);

      return res.json({
        success: true,
        data: configs,
      });
    } catch (error) {
      logger.error('获取用户AI配置失败:', error);
      return res.status(500).json({ error: '获取AI配置失败' });
    }
  }

  /**
   * 获取用户指定类型的AI配置
   * GET /api/ai-config/user/configs/type/:type
   */
  public async getUserConfigsByType(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { type } = req.params;

      if (!userId) {
        return res.status(401).json({ error: '未授权' });
      }

      logger.info(`获取用户 ${userId} 类型为 ${type} 的AI配置`);

      const configs = await userAISmartAccountingService.getUserAIConfigsByType(userId, type);

      return res.json({
        success: true,
        data: configs,
      });
    } catch (error) {
      logger.error('获取用户AI配置失败:', error);
      return res.status(500).json({ error: '获取AI配置失败' });
    }
  }

  /**
   * 创建或更新用户AI配置
   * POST /api/ai-config/user/configs
   */
  public async upsertUserConfig(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { configKey, configValue, configType, description, isEnabled, priority } = req.body;

      if (!userId) {
        return res.status(401).json({ error: '未授权' });
      }

      if (!configKey || !configValue) {
        return res.status(400).json({ error: '配置键和配置值不能为空' });
      }

      logger.info(`创建或更新用户 ${userId} 的AI配置: ${configKey}`);

      const result = await userAISmartAccountingService.upsertUserAIConfig(
        userId,
        configKey,
        configValue,
        configType || 'prompt',
        description,
        isEnabled !== false,
        priority || 0
      );

      return res.json({
        success: true,
        message: '配置保存成功',
        data: result,
      });
    } catch (error) {
      logger.error('保存用户AI配置失败:', error);
      return res.status(500).json({ error: '保存AI配置失败' });
    }
  }

  /**
   * 删除用户AI配置
   * DELETE /api/ai-config/user/configs/:configId
   */
  public async deleteUserConfig(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { configId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: '未授权' });
      }

      logger.info(`删除用户 ${userId} 的AI配置: ${configId}`);

      await userAISmartAccountingService.deleteUserAIConfig(userId, configId);

      return res.json({
        success: true,
        message: '配置删除成功',
      });
    } catch (error) {
      logger.error('删除用户AI配置失败:', error);
      return res.status(500).json({ error: '删除AI配置失败' });
    }
  }

  /**
   * 获取用户自定义提示词
   * GET /api/ai-config/user/prompt
   */
  public async getUserPrompt(req: Request, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: '未授权' });
      }

      logger.info(`获取用户 ${userId} 的自定义提示词`);

      const prompt = await userAISmartAccountingService.getUserCustomPrompt(userId);

      return res.json({
        success: true,
        data: prompt,
      });
    } catch (error) {
      logger.error('获取用户自定义提示词失败:', error);
      return res.status(500).json({ error: '获取自定义提示词失败' });
    }
  }

  /**
   * 保存用户自定义提示词
   * POST /api/ai-config/user/prompt
   */
  public async saveUserPrompt(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { promptValue, description, isEnabled } = req.body;

      if (!userId) {
        return res.status(401).json({ error: '未授权' });
      }

      if (!promptValue) {
        return res.status(400).json({ error: '提示词内容不能为空' });
      }

      logger.info(`保存用户 ${userId} 的自定义提示词`);

      const result = await userAISmartAccountingService.upsertUserAIConfig(
        userId,
        'custom_smart_accounting_prompt',
        promptValue,
        'prompt',
        description || '用户自定义智能记账提示词',
        isEnabled !== false,
        100
      );

      return res.json({
        success: true,
        message: '提示词保存成功',
        data: result,
      });
    } catch (error) {
      logger.error('保存用户自定义提示词失败:', error);
      return res.status(500).json({ error: '保存自定义提示词失败' });
    }
  }

  /**
   * 获取用户分类规则
   * GET /api/ai-config/user/rules
   */
  public async getUserRules(req: Request, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: '未授权' });
      }

      logger.info(`获取用户 ${userId} 的分类规则`);

      const rules = await userAISmartAccountingService.getUserClassificationRules(userId);

      return res.json({
        success: true,
        data: rules,
      });
    } catch (error) {
      logger.error('获取用户分类规则失败:', error);
      return res.status(500).json({ error: '获取分类规则失败' });
    }
  }

  /**
   * 保存用户分类规则
   * POST /api/ai-config/user/rules
   */
  public async saveUserRules(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { rulesValue, description, isEnabled } = req.body;

      if (!userId) {
        return res.status(401).json({ error: '未授权' });
      }

      if (!rulesValue) {
        return res.status(400).json({ error: '规则内容不能为空' });
      }

      logger.info(`保存用户 ${userId} 的分类规则`);

      const result = await userAISmartAccountingService.upsertUserAIConfig(
        userId,
        'classification_rules',
        rulesValue,
        'rule',
        description || '用户分类识别规则',
        isEnabled !== false,
        90
      );

      return res.json({
        success: true,
        message: '分类规则保存成功',
        data: result,
      });
    } catch (error) {
      logger.error('保存用户分类规则失败:', error);
      return res.status(500).json({ error: '保存分类规则失败' });
    }
  }

  /**
   * 获取用户分类映射列表
   * GET /api/ai-config/user/mappings
   */
  public async getUserMappings(req: Request, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: '未授权' });
      }

      logger.info(`获取用户 ${userId} 的分类映射列表`);

      const mappings = await userAISmartAccountingService.getUserCategoryMappings(userId);

      return res.json({
        success: true,
        data: mappings,
      });
    } catch (error) {
      logger.error('获取用户分类映射列表失败:', error);
      return res.status(500).json({ error: '获取分类映射列表失败' });
    }
  }

  /**
   * 创建分类映射规则
   * POST /api/ai-config/user/mappings
   */
  public async createMapping(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { keyword, categoryId, matchType, priority } = req.body;

      if (!userId) {
        return res.status(401).json({ error: '未授权' });
      }

      if (!keyword || !categoryId) {
        return res.status(400).json({ error: '关键词和分类ID不能为空' });
      }

      logger.info(`创建用户 ${userId} 的分类映射规则: ${keyword}`);

      const result = await userAISmartAccountingService.createCategoryMapping(
        userId,
        keyword,
        categoryId,
        matchType || 'contains',
        priority || 0
      );

      return res.json({
        success: true,
        message: '分类映射创建成功',
        data: result,
      });
    } catch (error) {
      logger.error('创建分类映射规则失败:', error);
      return res.status(500).json({ error: '创建分类映射失败' });
    }
  }

  /**
   * 批量创建分类映射规则
   * POST /api/ai-config/user/mappings/batch
   */
  public async batchCreateMappings(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { mappings } = req.body;

      if (!userId) {
        return res.status(401).json({ error: '未授权' });
      }

      if (!mappings || !Array.isArray(mappings) || mappings.length === 0) {
        return res.status(400).json({ error: '映射数据不能为空' });
      }

      logger.info(`批量创建用户 ${userId} 的分类映射规则，数量: ${mappings.length}`);

      const result = await userAISmartAccountingService.batchCreateCategoryMappings(userId, mappings);

      return res.json({
        success: true,
        message: `成功创建 ${result.count} 条分类映射规则`,
        data: result,
      });
    } catch (error) {
      logger.error('批量创建分类映射规则失败:', error);
      return res.status(500).json({ error: '批量创建分类映射失败' });
    }
  }

  /**
   * 更新分类映射规则
   * PUT /api/ai-config/user/mappings/:mappingId
   */
  public async updateMapping(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { mappingId } = req.params;
      const updates = req.body;

      if (!userId) {
        return res.status(401).json({ error: '未授权' });
      }

      logger.info(`更新用户 ${userId} 的分类映射规则: ${mappingId}`);

      const result = await userAISmartAccountingService.updateCategoryMapping(
        userId,
        mappingId,
        updates
      );

      return res.json({
        success: true,
        message: '分类映射更新成功',
        data: result,
      });
    } catch (error) {
      logger.error('更新分类映射规则失败:', error);
      return res.status(500).json({ error: '更新分类映射失败' });
    }
  }

  /**
   * 删除分类映射规则
   * DELETE /api/ai-config/user/mappings/:mappingId
   */
  public async deleteMapping(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { mappingId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: '未授权' });
      }

      logger.info(`删除用户 ${userId} 的分类映射规则: ${mappingId}`);

      await userAISmartAccountingService.deleteCategoryMapping(userId, mappingId);

      return res.json({
        success: true,
        message: '分类映射删除成功',
      });
    } catch (error) {
      logger.error('删除分类映射规则失败:', error);
      return res.status(500).json({ error: '删除分类映射失败' });
    }
  }

  /**
   * 获取账本AI配置
   * GET /api/ai-config/account/:accountId/configs
   */
  public async getAccountConfigs(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { accountId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: '未授权' });
      }

      logger.info(`获取账本 ${accountId} 的AI配置`);

      const configs = await userAISmartAccountingService.getAccountBookAIConfigs(accountId);

      return res.json({
        success: true,
        data: configs,
      });
    } catch (error) {
      logger.error('获取账本AI配置失败:', error);
      return res.status(500).json({ error: '获取账本AI配置失败' });
    }
  }

  /**
   * 创建或更新账本AI配置
   * POST /api/ai-config/account/:accountId/configs
   */
  public async upsertAccountConfig(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { accountId } = req.params;
      const { configKey, configValue, configType, description, isEnabled } = req.body;

      if (!userId) {
        return res.status(401).json({ error: '未授权' });
      }

      if (!configKey || !configValue) {
        return res.status(400).json({ error: '配置键和配置值不能为空' });
      }

      logger.info(`创建或更新账本 ${accountId} 的AI配置: ${configKey}`);

      const result = await userAISmartAccountingService.upsertAccountBookAIConfig(
        accountId,
        configKey,
        configValue,
        configType || 'parameter',
        description,
        isEnabled !== false
      );

      return res.json({
        success: true,
        message: '账本配置保存成功',
        data: result,
      });
    } catch (error) {
      logger.error('保存账本AI配置失败:', error);
      return res.status(500).json({ error: '保存账本AI配置失败' });
    }
  }

  /**
   * 删除账本AI配置
   * DELETE /api/ai-config/account/:accountId/configs/:configId
   */
  public async deleteAccountConfig(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { accountId, configId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: '未授权' });
      }

      logger.info(`删除账本 ${accountId} 的AI配置: ${configId}`);

      await userAISmartAccountingService.deleteAccountBookAIConfig(accountId, configId);

      return res.json({
        success: true,
        message: '账本配置删除成功',
      });
    } catch (error) {
      logger.error('删除账本AI配置失败:', error);
      return res.status(500).json({ error: '删除账本AI配置失败' });
    }
  }

  /**
   * 导出用户AI配置
   * GET /api/ai-config/user/export
   */
  public async exportUserConfig(req: Request, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: '未授权' });
      }

      logger.info(`导出用户 ${userId} 的AI配置`);

      const data = await userAISmartAccountingService.exportUserAIConfig(userId);

      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('导出用户AI配置失败:', error);
      return res.status(500).json({ error: '导出AI配置失败' });
    }
  }

  /**
   * 导入用户AI配置
   * POST /api/ai-config/user/import
   */
  public async importUserConfig(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const data = req.body;

      if (!userId) {
        return res.status(401).json({ error: '未授权' });
      }

      logger.info(`导入用户 ${userId} 的AI配置`);

      const result = await userAISmartAccountingService.importUserAIConfig(userId, data);

      return res.json({
        success: true,
        message: `成功导入 ${result.importedConfigs} 条配置和 ${result.importedMappings} 条映射规则`,
        data: result,
      });
    } catch (error) {
      logger.error('导入用户AI配置失败:', error);
      return res.status(500).json({ error: '导入AI配置失败' });
    }
  }
}

export default new UserAIConfigController();
