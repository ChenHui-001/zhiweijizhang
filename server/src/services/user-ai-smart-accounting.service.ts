import prisma from '../config/database';
import { logger } from '../utils/logger';

/**
 * 用户AI智能记账配置服务
 * 管理用户级别的AI配置、自定义提示词和分类映射规则
 */
export class UserAISmartAccountingService {
  /**
   * 获取用户的所有AI配置
   * @param userId 用户ID
   * @returns 用户AI配置列表
   */
  async getUserAIConfigs(userId: string) {
    try {
      logger.info(`获取用户 ${userId} 的AI配置`);

      const configs = await prisma.$queryRaw`
        SELECT 
          id,
          user_id as "userId",
          config_key as "configKey",
          config_value as "configValue",
          config_type as "configType",
          description,
          is_enabled as "isEnabled",
          priority,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM user_ai_smart_accounting_configs
        WHERE user_id = ${userId}
        ORDER BY priority DESC, created_at ASC
      `;

      return configs;
    } catch (error) {
      logger.error('获取用户AI配置失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户指定类型的AI配置
   * @param userId 用户ID
   * @param configType 配置类型：prompt, rule, mapping, parameter
   * @returns 配置列表
   */
  async getUserAIConfigsByType(userId: string, configType: string) {
    try {
      logger.info(`获取用户 ${userId} 类型为 ${configType} 的AI配置`);

      const configs = await prisma.$queryRaw`
        SELECT 
          id,
          user_id as "userId",
          config_key as "configKey",
          config_value as "configValue",
          config_type as "configType",
          description,
          is_enabled as "isEnabled",
          priority,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM user_ai_smart_accounting_configs
        WHERE user_id = ${userId} AND config_type = ${configType}
        ORDER BY priority DESC, created_at ASC
      `;

      return configs;
    } catch (error) {
      logger.error('获取用户AI配置失败:', error);
      throw error;
    }
  }

  /**
   * 创建或更新用户AI配置
   * @param userId 用户ID
   * @param configKey 配置键
   * @param configValue 配置值
   * @param configType 配置类型
   * @param description 配置描述
   * @param isEnabled 是否启用
   * @param priority 优先级
   * @returns 创建或更新后的配置
   */
  async upsertUserAIConfig(
    userId: string,
    configKey: string,
    configValue: string,
    configType: string = 'prompt',
    description?: string,
    isEnabled: boolean = true,
    priority: number = 0
  ) {
    try {
      logger.info(`创建或更新用户 ${userId} 的AI配置: ${configKey}`);

      const result = await prisma.$executeRaw`
        INSERT INTO user_ai_smart_accounting_configs (
          user_id, config_key, config_value, config_type, description, is_enabled, priority
        ) VALUES (
          ${userId}, ${configKey}, ${configValue}, ${configType}, ${description}, ${isEnabled}, ${priority}
        )
        ON CONFLICT (user_id, config_key) 
        DO UPDATE SET
          config_value = ${configValue},
          config_type = ${configType},
          description = ${description},
          is_enabled = ${isEnabled},
          priority = ${priority},
          updated_at = NOW()
        RETURNING *
      `;

      return result;
    } catch (error) {
      logger.error('创建或更新用户AI配置失败:', error);
      throw error;
    }
  }

  /**
   * 删除用户AI配置
   * @param userId 用户ID
   * @param configId 配置ID
   * @returns 是否删除成功
   */
  async deleteUserAIConfig(userId: string, configId: string) {
    try {
      logger.info(`删除用户 ${userId} 的AI配置: ${configId}`);

      await prisma.$executeRaw`
        DELETE FROM user_ai_smart_accounting_configs
        WHERE id = ${configId} AND user_id = ${userId}
      `;

      return true;
    } catch (error) {
      logger.error('删除用户AI配置失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户的自定义提示词
   * @param userId 用户ID
   * @returns 自定义提示词配置
   */
  async getUserCustomPrompt(userId: string) {
    try {
      logger.info(`获取用户 ${userId} 的自定义提示词`);

      const configs = await prisma.$queryRaw`
        SELECT 
          id,
          config_key as "configKey",
          config_value as "configValue",
          description,
          is_enabled as "isEnabled"
        FROM user_ai_smart_accounting_configs
        WHERE user_id = ${userId} 
          AND config_type = 'prompt' 
          AND is_enabled = true
        ORDER BY priority DESC
        LIMIT 1
      `;

      return (configs as any[]).length > 0 ? (configs as any[])[0] : null;
    } catch (error) {
      logger.error('获取用户自定义提示词失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户的分类规则
   * @param userId 用户ID
   * @returns 分类规则配置
   */
  async getUserClassificationRules(userId: string) {
    try {
      logger.info(`获取用户 ${userId} 的分类规则`);

      const configs = await prisma.$queryRaw`
        SELECT 
          id,
          config_key as "configKey",
          config_value as "configValue",
          description,
          is_enabled as "isEnabled"
        FROM user_ai_smart_accounting_configs
        WHERE user_id = ${userId} 
          AND config_key = 'classification_rules'
          AND is_enabled = true
        LIMIT 1
      `;

      return (configs as any[]).length > 0 ? (configs as any[])[0] : null;
    } catch (error) {
      logger.error('获取用户分类规则失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户的所有分类映射规则
   * @param userId 用户ID
   * @returns 分类映射列表
   */
  async getUserCategoryMappings(userId: string): Promise<any[]> {
    try {
      logger.info(`获取用户 ${userId} 的分类映射规则`);

      const mappings = await prisma.$queryRaw`
        SELECT 
          m.id,
          m.user_id as "userId",
          m.keyword,
          m.category_id as "categoryId",
          m.match_type as "matchType",
          m.priority,
          m.is_enabled as "isEnabled",
          c.name as "categoryName",
          c.icon as "categoryIcon",
          c.type as "categoryType"
        FROM user_category_mappings m
        LEFT JOIN categories c ON m.category_id = c.id
        WHERE m.user_id = ${userId} AND m.is_enabled = true
        ORDER BY m.priority DESC, m.created_at ASC
      `;

      return mappings as any[];
    } catch (error) {
      logger.error('获取用户分类映射规则失败:', error);
      throw error;
    }
  }

  /**
   * 创建分类映射规则
   * @param userId 用户ID
   * @param keyword 关键词
   * @param categoryId 分类ID
   * @param matchType 匹配类型：contains, exact, regex
   * @param priority 优先级
   * @returns 创建的映射规则
   */
  async createCategoryMapping(
    userId: string,
    keyword: string,
    categoryId: string,
    matchType: string = 'contains',
    priority: number = 0
  ) {
    try {
      logger.info(`创建用户 ${userId} 的分类映射规则: ${keyword} -> ${categoryId}`);

      const result = await prisma.$executeRaw`
        INSERT INTO user_category_mappings (
          user_id, keyword, category_id, match_type, priority, is_enabled
        ) VALUES (
          ${userId}, ${keyword}, ${categoryId}, ${matchType}, ${priority}, true
        )
        RETURNING *
      `;

      return result;
    } catch (error) {
      logger.error('创建分类映射规则失败:', error);
      throw error;
    }
  }

  /**
   * 批量创建分类映射规则
   * @param userId 用户ID
   * @param mappings 映射规则数组
   * @returns 创建结果
   */
  async batchCreateCategoryMappings(
    userId: string,
    mappings: Array<{ keyword: string; categoryId: string; matchType?: string; priority?: number }>
  ) {
    try {
      logger.info(`批量创建用户 ${userId} 的分类映射规则，数量: ${mappings.length}`);

      for (const mapping of mappings) {
        await this.createCategoryMapping(
          userId,
          mapping.keyword,
          mapping.categoryId,
          mapping.matchType || 'contains',
          mapping.priority || 0
        );
      }

      return { success: true, count: mappings.length };
    } catch (error) {
      logger.error('批量创建分类映射规则失败:', error);
      throw error;
    }
  }

  /**
   * 更新分类映射规则
   * @param userId 用户ID
   * @param mappingId 映射ID
   * @param updates 更新内容
   * @returns 更新结果
   */
  async updateCategoryMapping(
    userId: string,
    mappingId: string,
    updates: { keyword?: string; categoryId?: string; matchType?: string; priority?: number; isEnabled?: boolean }
  ) {
    try {
      logger.info(`更新用户 ${userId} 的分类映射规则: ${mappingId}`);

      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.keyword !== undefined) {
        setClauses.push(`keyword = $${paramIndex++}`);
        values.push(updates.keyword);
      }
      if (updates.categoryId !== undefined) {
        setClauses.push(`category_id = $${paramIndex++}`);
        values.push(updates.categoryId);
      }
      if (updates.matchType !== undefined) {
        setClauses.push(`match_type = $${paramIndex++}`);
        values.push(updates.matchType);
      }
      if (updates.priority !== undefined) {
        setClauses.push(`priority = $${paramIndex++}`);
        values.push(updates.priority);
      }
      if (updates.isEnabled !== undefined) {
        setClauses.push(`is_enabled = $${paramIndex++}`);
        values.push(updates.isEnabled);
      }

      if (setClauses.length === 0) {
        return { success: false, message: '没有需要更新的字段' };
      }

      setClauses.push(`updated_at = NOW()`);
      values.push(mappingId, userId);

      const query = `
        UPDATE user_category_mappings 
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
        RETURNING *
      `;

      await prisma.$executeRawUnsafe(query, ...values);

      return { success: true };
    } catch (error) {
      logger.error('更新分类映射规则失败:', error);
      throw error;
    }
  }

  /**
   * 删除分类映射规则
   * @param userId 用户ID
   * @param mappingId 映射ID
   * @returns 删除结果
   */
  async deleteCategoryMapping(userId: string, mappingId: string) {
    try {
      logger.info(`删除用户 ${userId} 的分类映射规则: ${mappingId}`);

      await prisma.$executeRaw`
        DELETE FROM user_category_mappings
        WHERE id = ${mappingId} AND user_id = ${userId}
      `;

      return { success: true };
    } catch (error) {
      logger.error('删除分类映射规则失败:', error);
      throw error;
    }
  }

  /**
   * 根据关键词匹配分类
   * @param userId 用户ID
   * @param text 输入文本
   * @returns 匹配的分类ID和关键词
   */
  async matchCategoryByKeyword(userId: string, text: string) {
    try {
      logger.info(`根据关键词匹配分类，用户: ${userId}, 文本: ${text}`);

      const mappings = await this.getUserCategoryMappings(userId);

      for (const mapping of mappings) {
        const keyword = mapping.keyword.toLowerCase();
        const inputText = text.toLowerCase();

        let isMatch = false;

        switch (mapping.matchType) {
          case 'exact':
            isMatch = inputText === keyword;
            break;
          case 'regex':
            try {
              const regex = new RegExp(keyword, 'i');
              isMatch = regex.test(inputText);
            } catch (e) {
              logger.warn(`无效的正则表达式: ${keyword}`);
            }
            break;
          case 'contains':
          default:
            isMatch = inputText.includes(keyword);
            break;
        }

        if (isMatch) {
          logger.info(`关键词匹配成功: ${mapping.keyword} -> ${mapping.categoryId}`);
          return {
            matched: true,
            categoryId: mapping.categoryId,
            categoryName: mapping.categoryName,
            keyword: mapping.keyword,
            matchType: mapping.matchType,
          };
        }
      }

      return { matched: false };
    } catch (error) {
      logger.error('根据关键词匹配分类失败:', error);
      throw error;
    }
  }

  /**
   * 获取账本的AI配置
   * @param accountBookId 账本ID
   * @returns 账本AI配置列表
   */
  async getAccountBookAIConfigs(accountBookId: string) {
    try {
      logger.info(`获取账本 ${accountBookId} 的AI配置`);

      const configs = await prisma.$queryRaw`
        SELECT 
          id,
          account_book_id as "accountBookId",
          config_key as "configKey",
          config_value as "configValue",
          config_type as "configType",
          description,
          is_enabled as "isEnabled",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM account_book_ai_configs
        WHERE account_book_id = ${accountBookId}
        ORDER BY config_key
      `;

      return configs;
    } catch (error) {
      logger.error('获取账本AI配置失败:', error);
      throw error;
    }
  }

  /**
   * 创建或更新账本AI配置
   * @param accountBookId 账本ID
   * @param configKey 配置键
   * @param configValue 配置值
   * @param configType 配置类型
   * @param description 配置描述
   * @param isEnabled 是否启用
   * @returns 创建或更新结果
   */
  async upsertAccountBookAIConfig(
    accountBookId: string,
    configKey: string,
    configValue: string,
    configType: string = 'parameter',
    description?: string,
    isEnabled: boolean = true
  ) {
    try {
      logger.info(`创建或更新账本 ${accountBookId} 的AI配置: ${configKey}`);

      const result = await prisma.$executeRaw`
        INSERT INTO account_book_ai_configs (
          account_book_id, config_key, config_value, config_type, description, is_enabled
        ) VALUES (
          ${accountBookId}, ${configKey}, ${configValue}, ${configType}, ${description}, ${isEnabled}
        )
        ON CONFLICT (account_book_id, config_key) 
        DO UPDATE SET
          config_value = ${configValue},
          config_type = ${configType},
          description = ${description},
          is_enabled = ${isEnabled},
          updated_at = NOW()
        RETURNING *
      `;

      return result;
    } catch (error) {
      logger.error('创建或更新账本AI配置失败:', error);
      throw error;
    }
  }

  /**
   * 删除账本AI配置
   * @param accountBookId 账本ID
   * @param configId 配置ID
   * @returns 删除结果
   */
  async deleteAccountBookAIConfig(accountBookId: string, configId: string) {
    try {
      logger.info(`删除账本 ${accountBookId} 的AI配置: ${configId}`);

      await prisma.$executeRaw`
        DELETE FROM account_book_ai_configs
        WHERE id = ${configId} AND account_book_id = ${accountBookId}
      `;

      return { success: true };
    } catch (error) {
      logger.error('删除账本AI配置失败:', error);
      throw error;
    }
  }

  /**
   * 获取账本的AI配置值
   * @param accountBookId 账本ID
   * @param configKey 配置键
   * @returns 配置值
   */
  async getAccountBookConfigValue(accountBookId: string, configKey: string) {
    try {
      logger.info(`获取账本 ${accountBookId} 的配置值: ${configKey}`);

      const configs = await prisma.$queryRaw`
        SELECT config_value as "configValue"
        FROM account_book_ai_configs
        WHERE account_book_id = ${accountBookId} 
          AND config_key = ${configKey}
          AND is_enabled = true
        LIMIT 1
      `;

      return (configs as any[]).length > 0 ? (configs as any[])[0].configValue : null;
    } catch (error) {
      logger.error('获取账本配置值失败:', error);
      throw error;
    }
  }

  /**
   * 导出用户AI配置（用于迁移或备份）
   * @param userId 用户ID
   * @returns 完整的AI配置数据
   */
  async exportUserAIConfig(userId: string) {
    try {
      logger.info(`导出用户 ${userId} 的AI配置`);

      const aiConfigs = await this.getUserAIConfigs(userId);
      const categoryMappings = await this.getUserCategoryMappings(userId);

      return {
        aiConfigs,
        categoryMappings,
        exportedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('导出用户AI配置失败:', error);
      throw error;
    }
  }

  /**
   * 导入用户AI配置
   * @param userId 用户ID
   * @param data 要导入的配置数据
   * @returns 导入结果
   */
  async importUserAIConfig(userId: string, data: { aiConfigs?: any[]; categoryMappings?: any[] }) {
    try {
      logger.info(`导入用户 ${userId} 的AI配置`);

      let importedConfigs = 0;
      let importedMappings = 0;

      if (data.aiConfigs && Array.isArray(data.aiConfigs)) {
        for (const config of data.aiConfigs) {
          await this.upsertUserAIConfig(
            userId,
            config.configKey,
            config.configValue,
            config.configType,
            config.description,
            config.isEnabled,
            config.priority
          );
          importedConfigs++;
        }
      }

      if (data.categoryMappings && Array.isArray(data.categoryMappings)) {
        for (const mapping of data.categoryMappings) {
          await this.createCategoryMapping(
            userId,
            mapping.keyword,
            mapping.categoryId,
            mapping.matchType,
            mapping.priority
          );
          importedMappings++;
        }
      }

      return {
        success: true,
        importedConfigs,
        importedMappings,
      };
    } catch (error) {
      logger.error('导入用户AI配置失败:', error);
      throw error;
    }
  }
}

export default new UserAISmartAccountingService();
