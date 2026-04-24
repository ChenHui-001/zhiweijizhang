import { apiClient } from '../api-client';

// AI配置类型定义
export interface UserAIConfig {
  id: string;
  userId: string;
  configKey: string;
  configValue: string;
  configType: string;
  description?: string;
  isEnabled: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryMapping {
  id: string;
  userId: string;
  keyword: string;
  categoryId: string;
  categoryName?: string;
  categoryIcon?: string;
  categoryType?: string;
  matchType: string;
  priority: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountBookAIConfig {
  id: string;
  accountBookId: string;
  configKey: string;
  configValue: string;
  configType: string;
  description?: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// 用户AI配置API服务
export const userAIConfigService = {
  /**
   * 获取用户的所有AI配置
   */
  async getUserConfigs(): Promise<UserAIConfig[]> {
    try {
      console.log('获取用户AI配置列表');
      const response = await apiClient.get('/ai-config/user/configs');
      return response.data || [];
    } catch (error) {
      console.error('获取用户AI配置失败:', error);
      return [];
    }
  },

  /**
   * 获取用户指定类型的AI配置
   */
  async getUserConfigsByType(type: string): Promise<UserAIConfig[]> {
    try {
      console.log(`获取用户AI配置列表，类型: ${type}`);
      const response = await apiClient.get(`/ai-config/user/configs/type/${type}`);
      return response.data || [];
    } catch (error) {
      console.error('获取用户AI配置失败:', error);
      return [];
    }
  },

  /**
   * 创建或更新用户AI配置
   */
  async upsertUserConfig(data: {
    configKey: string;
    configValue: string;
    configType?: string;
    description?: string;
    isEnabled?: boolean;
    priority?: number;
  }): Promise<{ success: boolean; message?: string }> {
    try {
      console.log('保存用户AI配置:', data);
      const response = await apiClient.post('/ai-config/user/configs', data);
      return { success: true, message: response.message || '保存成功' };
    } catch (error: any) {
      console.error('保存用户AI配置失败:', error);
      return { success: false, message: error.message || '保存失败' };
    }
  },

  /**
   * 删除用户AI配置
   */
  async deleteUserConfig(configId: string): Promise<{ success: boolean; message?: string }> {
    try {
      console.log(`删除用户AI配置: ${configId}`);
      await apiClient.delete(`/ai-config/user/configs/${configId}`);
      return { success: true, message: '删除成功' };
    } catch (error: any) {
      console.error('删除用户AI配置失败:', error);
      return { success: false, message: error.message || '删除失败' };
    }
  },

  /**
   * 获取用户自定义提示词
   */
  async getUserPrompt(): Promise<UserAIConfig | null> {
    try {
      console.log('获取用户自定义提示词');
      const response = await apiClient.get('/ai-config/user/prompt');
      return response.data || null;
    } catch (error) {
      console.error('获取用户自定义提示词失败:', error);
      return null;
    }
  },

  /**
   * 保存用户自定义提示词
   */
  async saveUserPrompt(
    promptValue: string,
    description?: string,
    isEnabled: boolean = true
  ): Promise<{ success: boolean; message?: string }> {
    try {
      console.log('保存用户自定义提示词');
      const response = await apiClient.post('/ai-config/user/prompt', {
        promptValue,
        description,
        isEnabled,
      });
      return { success: true, message: response.message || '保存成功' };
    } catch (error: any) {
      console.error('保存用户自定义提示词失败:', error);
      return { success: false, message: error.message || '保存失败' };
    }
  },

  /**
   * 获取用户分类规则
   */
  async getUserRules(): Promise<UserAIConfig | null> {
    try {
      console.log('获取用户分类规则');
      const response = await apiClient.get('/ai-config/user/rules');
      return response.data || null;
    } catch (error) {
      console.error('获取用户分类规则失败:', error);
      return null;
    }
  },

  /**
   * 保存用户分类规则
   */
  async saveUserRules(
    rulesValue: string,
    description?: string,
    isEnabled: boolean = true
  ): Promise<{ success: boolean; message?: string }> {
    try {
      console.log('保存用户分类规则');
      const response = await apiClient.post('/ai-config/user/rules', {
        rulesValue,
        description,
        isEnabled,
      });
      return { success: true, message: response.message || '保存成功' };
    } catch (error: any) {
      console.error('保存用户分类规则失败:', error);
      return { success: false, message: error.message || '保存失败' };
    }
  },

  /**
   * 获取用户分类映射列表
   */
  async getUserMappings(): Promise<CategoryMapping[]> {
    try {
      console.log('获取用户分类映射列表');
      const response = await apiClient.get('/ai-config/user/mappings');
      return response.data || [];
    } catch (error) {
      console.error('获取用户分类映射列表失败:', error);
      return [];
    }
  },

  /**
   * 创建分类映射规则
   */
  async createMapping(data: {
    keyword: string;
    categoryId: string;
    matchType?: string;
    priority?: number;
  }): Promise<{ success: boolean; message?: string }> {
    try {
      console.log('创建分类映射规则:', data);
      const response = await apiClient.post('/ai-config/user/mappings', data);
      return { success: true, message: response.message || '创建成功' };
    } catch (error: any) {
      console.error('创建分类映射规则失败:', error);
      return { success: false, message: error.message || '创建失败' };
    }
  },

  /**
   * 批量创建分类映射规则
   */
  async batchCreateMappings(
    mappings: Array<{
      keyword: string;
      categoryId: string;
      matchType?: string;
      priority?: number;
    }>
  ): Promise<{ success: boolean; message?: string; count?: number }> {
    try {
      console.log('批量创建分类映射规则:', mappings.length);
      const response = await apiClient.post('/ai-config/user/mappings/batch', { mappings });
      return {
        success: true,
        message: response.message || '批量创建成功',
        count: response.data?.count || mappings.length,
      };
    } catch (error: any) {
      console.error('批量创建分类映射规则失败:', error);
      return { success: false, message: error.message || '批量创建失败' };
    }
  },

  /**
   * 更新分类映射规则
   */
  async updateMapping(
    mappingId: string,
    updates: {
      keyword?: string;
      categoryId?: string;
      matchType?: string;
      priority?: number;
      isEnabled?: boolean;
    }
  ): Promise<{ success: boolean; message?: string }> {
    try {
      console.log(`更新分类映射规则: ${mappingId}`, updates);
      const response = await apiClient.put(`/ai-config/user/mappings/${mappingId}`, updates);
      return { success: true, message: response.message || '更新成功' };
    } catch (error: any) {
      console.error('更新分类映射规则失败:', error);
      return { success: false, message: error.message || '更新失败' };
    }
  },

  /**
   * 删除分类映射规则
   */
  async deleteMapping(mappingId: string): Promise<{ success: boolean; message?: string }> {
    try {
      console.log(`删除分类映射规则: ${mappingId}`);
      await apiClient.delete(`/ai-config/user/mappings/${mappingId}`);
      return { success: true, message: '删除成功' };
    } catch (error: any) {
      console.error('删除分类映射规则失败:', error);
      return { success: false, message: error.message || '删除失败' };
    }
  },

  /**
   * 获取账本AI配置
   */
  async getAccountConfigs(accountBookId: string): Promise<AccountBookAIConfig[]> {
    try {
      console.log(`获取账本AI配置: ${accountBookId}`);
      const response = await apiClient.get(`/ai-config/account/${accountBookId}/configs`);
      return response.data || [];
    } catch (error) {
      console.error('获取账本AI配置失败:', error);
      return [];
    }
  },

  /**
   * 创建或更新账本AI配置
   */
  async upsertAccountConfig(
    accountBookId: string,
    data: {
      configKey: string;
      configValue: string;
      configType?: string;
      description?: string;
      isEnabled?: boolean;
    }
  ): Promise<{ success: boolean; message?: string }> {
    try {
      console.log(`保存账本AI配置: ${accountBookId}`, data);
      const response = await apiClient.post(`/ai-config/account/${accountBookId}/configs`, data);
      return { success: true, message: response.message || '保存成功' };
    } catch (error: any) {
      console.error('保存账本AI配置失败:', error);
      return { success: false, message: error.message || '保存失败' };
    }
  },

  /**
   * 删除账本AI配置
   */
  async deleteAccountConfig(
    accountBookId: string,
    configId: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      console.log(`删除账本AI配置: ${accountBookId}/${configId}`);
      await apiClient.delete(`/ai-config/account/${accountBookId}/configs/${configId}`);
      return { success: true, message: '删除成功' };
    } catch (error: any) {
      console.error('删除账本AI配置失败:', error);
      return { success: false, message: error.message || '删除失败' };
    }
  },

  /**
   * 导出用户AI配置
   */
  async exportUserConfig(): Promise<{
    success: boolean;
    data?: any;
    message?: string;
  }> {
    try {
      console.log('导出用户AI配置');
      const response = await apiClient.get('/ai-config/user/export');
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('导出用户AI配置失败:', error);
      return { success: false, message: error.message || '导出失败' };
    }
  },

  /**
   * 导入用户AI配置
   */
  async importUserConfig(data: any): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      console.log('导入用户AI配置');
      const response = await apiClient.post('/ai-config/user/import', data);
      return { success: true, message: response.message || '导入成功' };
    } catch (error: any) {
      console.error('导入用户AI配置失败:', error);
      return { success: false, message: error.message || '导入失败' };
    }
  },
};
