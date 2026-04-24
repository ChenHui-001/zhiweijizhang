'use client';

import { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout/page-container';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { userAIConfigService, CategoryMapping, UserAIConfig } from '@/lib/api/user-ai-config';
import '@/styles/ai-config.css';

// 提示词模板
const PROMPT_TEMPLATE = `你是专业财务助手，能从用户描述中精准提取记账信息。

核心要求：
1. 金额提取：只提取数字金额，忽略货币符号
2. 日期识别：支持"今天"、"昨天"、"前天"等相对日期
3. 分类匹配：严格匹配提供的分类列表
4. 类型判断：根据关键词判断收入/支出

分类列表：
{{categories}}

预算列表：
{{budgets}}

输出要求：
- 只返回JSON格式
- 金额必须是数字类型
- 日期必须是 YYYY-MM-DD 格式
- confidence表示分类置信度

返回格式：
{
  "amount": 128.50,
  "date": "2025-05-19",
  "categoryId": "分类UUID",
  "categoryName": "分类名称",
  "type": "EXPENSE",
  "confidence": 0.95,
  "note": "备注"
}`;

// 分类规则模板
const RULES_TEMPLATE = JSON.stringify(
  {
    income_keywords: ['工资', '奖金', '收入', '赚', '收', '到账', '分红', '利息', '退款'],
    expense_keywords: ['买', '花', '支付', '消费', '支出', '花费', '付', '购买', '订单'],
    food_keywords: ['吃饭', '餐厅', '外卖', '美食', '午餐', '晚餐', '早餐', '咖啡'],
    transport_keywords: ['打车', '滴滴', '公交', '地铁', '出租车', '加油', '停车'],
    shopping_keywords: ['淘宝', '京东', '天猫', '购物', '商场', '超市', '便利店'],
  },
  null,
  2
);

export default function AIConfigPage() {
  const [activeTab, setActiveTab] = useState('prompt');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 自定义提示词
  const [customPrompt, setCustomPrompt] = useState('');
  const [promptEnabled, setPromptEnabled] = useState(true);

  // 分类规则
  const [customRules, setCustomRules] = useState('');
  const [rulesEnabled, setRulesEnabled] = useState(true);

  // 分类映射
  const [mappings, setMappings] = useState<CategoryMapping[]>([]);
  const [newMapping, setNewMapping] = useState({ keyword: '', categoryId: '', matchType: 'contains' });
  const [showAddMapping, setShowAddMapping] = useState(false);

  // 加载数据
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 加载自定义提示词
      const promptConfig = await userAIConfigService.getUserPrompt();
      if (promptConfig && promptConfig.configValue) {
        setCustomPrompt(promptConfig.configValue);
        setPromptEnabled(promptConfig.isEnabled);
      } else {
        setCustomPrompt(PROMPT_TEMPLATE);
      }

      // 加载分类规则
      const rulesConfig = await userAIConfigService.getUserRules();
      if (rulesConfig && rulesConfig.configValue) {
        try {
          const rules = JSON.parse(rulesConfig.configValue);
          setCustomRules(JSON.stringify(rules, null, 2));
          setRulesEnabled(rulesConfig.isEnabled);
        } catch {
          setCustomRules(RULES_TEMPLATE);
        }
      } else {
        setCustomRules(RULES_TEMPLATE);
      }

      // 加载分类映射
      const mappingsData = await userAIConfigService.getUserMappings();
      setMappings(mappingsData);
    } catch (error) {
      console.error('加载AI配置失败:', error);
      toast.error('加载AI配置失败');
    } finally {
      setLoading(false);
    }
  };

  // 保存自定义提示词
  const handleSavePrompt = async () => {
    setSaving(true);
    try {
      const result = await userAIConfigService.saveUserPrompt(
        customPrompt,
        '用户自定义智能记账提示词',
        promptEnabled
      );
      if (result.success) {
        toast.success('提示词保存成功');
      } else {
        toast.error(result.message || '保存失败');
      }
    } catch (error) {
      console.error('保存提示词失败:', error);
      toast.error('保存提示词失败');
    } finally {
      setSaving(false);
    }
  };

  // 保存分类规则
  const handleSaveRules = async () => {
    setSaving(true);
    try {
      // 验证JSON格式
      try {
        JSON.parse(customRules);
      } catch {
        toast.error('分类规则必须是有效的JSON格式');
        setSaving(false);
        return;
      }

      const result = await userAIConfigService.saveUserRules(
        customRules,
        '用户分类识别规则',
        rulesEnabled
      );
      if (result.success) {
        toast.success('分类规则保存成功');
      } else {
        toast.error(result.message || '保存失败');
      }
    } catch (error) {
      console.error('保存分类规则失败:', error);
      toast.error('保存分类规则失败');
    } finally {
      setSaving(false);
    }
  };

  // 添加分类映射
  const handleAddMapping = async () => {
    if (!newMapping.keyword || !newMapping.categoryId) {
      toast.error('请填写关键词和选择分类');
      return;
    }

    try {
      const result = await userAIConfigService.createMapping(newMapping);
      if (result.success) {
        toast.success('分类映射创建成功');
        setShowAddMapping(false);
        setNewMapping({ keyword: '', categoryId: '', matchType: 'contains' });
        // 重新加载映射列表
        const mappingsData = await userAIConfigService.getUserMappings();
        setMappings(mappingsData);
      } else {
        toast.error(result.message || '创建失败');
      }
    } catch (error) {
      console.error('创建分类映射失败:', error);
      toast.error('创建分类映射失败');
    }
  };

  // 删除分类映射
  const handleDeleteMapping = async (mappingId: string) => {
    try {
      const result = await userAIConfigService.deleteMapping(mappingId);
      if (result.success) {
        toast.success('分类映射删除成功');
        // 更新列表
        setMappings(mappings.filter((m) => m.id !== mappingId));
      } else {
        toast.error(result.message || '删除失败');
      }
    } catch (error) {
      console.error('删除分类映射失败:', error);
      toast.error('删除分类映射失败');
    }
  };

  // 重置为默认
  const handleResetToDefault = (type: 'prompt' | 'rules') => {
    if (type === 'prompt') {
      setCustomPrompt(PROMPT_TEMPLATE);
      toast.info('已重置为默认提示词');
    } else {
      setCustomRules(RULES_TEMPLATE);
      toast.info('已重置为默认规则');
    }
  };

  if (loading) {
    return (
      <PageContainer title="AI智能配置" showBackButton={true} activeNavItem="profile">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">加载中...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="AI智能配置" showBackButton={true} activeNavItem="profile">
      <div className="ai-config-container p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="prompt">自定义提示词</TabsTrigger>
            <TabsTrigger value="rules">分类规则</TabsTrigger>
            <TabsTrigger value="mappings">分类映射</TabsTrigger>
          </TabsList>

          {/* 自定义提示词 */}
          <TabsContent value="prompt" className="space-y-4">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">智能记账提示词</h3>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={promptEnabled}
                    onChange={(e) => setPromptEnabled(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">启用</span>
                </label>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                自定义AI记账的提示词模板。可以修改分类匹配规则、日期识别模式等。
              </p>

              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="w-full h-96 p-3 border border-gray-300 rounded-lg font-mono text-sm resize-none"
                placeholder="输入自定义提示词..."
              />

              <div className="flex justify-between mt-4">
                <button
                  onClick={() => handleResetToDefault('prompt')}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  重置为默认
                </button>
                <button
                  onClick={handleSavePrompt}
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </TabsContent>

          {/* 分类规则 */}
          <TabsContent value="rules" className="space-y-4">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">分类识别规则</h3>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rulesEnabled}
                    onChange={(e) => setRulesEnabled(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">启用</span>
                </label>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                定义关键词规则，帮助AI更准确地识别收支类型和分类。JSON格式。
              </p>

              <textarea
                value={customRules}
                onChange={(e) => setCustomRules(e.target.value)}
                className="w-full h-96 p-3 border border-gray-300 rounded-lg font-mono text-sm resize-none"
                placeholder="输入分类规则..."
              />

              <div className="flex justify-between mt-4">
                <button
                  onClick={() => handleResetToDefault('rules')}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  重置为默认
                </button>
                <button
                  onClick={handleSaveRules}
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </TabsContent>

          {/* 分类映射 */}
          <TabsContent value="mappings" className="space-y-4">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">关键词分类映射</h3>
                <button
                  onClick={() => setShowAddMapping(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  添加映射
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                设置关键词到分类的直接映射。例如：关键词"咖啡"→分类"餐饮"。
              </p>

              {mappings.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  暂无分类映射规则
                </div>
              ) : (
                <div className="space-y-2">
                  {mappings.map((mapping) => (
                    <div
                      key={mapping.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                          {mapping.keyword}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                          {mapping.categoryName || mapping.categoryId}
                        </span>
                        <span className="text-xs text-gray-500">
                          {mapping.matchType}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteMapping(mapping.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 添加映射弹窗 */}
            {showAddMapping && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-md">
                  <h3 className="text-lg font-semibold mb-4">添加分类映射</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">关键词</label>
                      <input
                        type="text"
                        value={newMapping.keyword}
                        onChange={(e) =>
                          setNewMapping({ ...newMapping, keyword: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="例如：咖啡"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">分类ID</label>
                      <input
                        type="text"
                        value={newMapping.categoryId}
                        onChange={(e) =>
                          setNewMapping({ ...newMapping, categoryId: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="分类UUID"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        请输入目标分类的UUID
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">匹配类型</label>
                      <select
                        value={newMapping.matchType}
                        onChange={(e) =>
                          setNewMapping({ ...newMapping, matchType: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="contains">包含</option>
                        <option value="exact">完全匹配</option>
                        <option value="regex">正则表达式</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-6">
                    <button
                      onClick={() => setShowAddMapping(false)}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleAddMapping}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      添加
                    </button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
