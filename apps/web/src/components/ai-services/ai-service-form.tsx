'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import '@/styles/ai-service-form.css';

const formSchema = z.object({
  name: z.string().min(1, '服务名称不能为空'),
  provider: z.string().min(1, '请选择服务提供商'),
  model: z.string().min(1, '请输入模型名称'),
  apiKey: z.string().min(1, 'API密钥不能为空'),
  baseUrl: z.string().optional(),
  temperature: z.coerce.number().min(0).max(2).default(0.7),
  maxTokens: z.coerce.number().min(100).max(128000).default(4000),
  description: z.string().optional(),
});

export type AIServiceFormValues = z.infer<typeof formSchema>;

interface AIServiceFormProps {
  initialData?: Partial<AIServiceFormValues & { id: string }>;
  onSubmit: (data: AIServiceFormValues) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const providers = [
  { value: 'siliconflow', label: '硅基流动', icon: '💧', desc: '高性价比', defaultUrl: 'https://api.siliconflow.cn/v1' },
  { value: 'deepseek', label: 'DeepSeek', icon: '🔮', desc: '深度求索', defaultUrl: 'https://api.deepseek.com/v1' },
  { value: 'zhipu', label: '智谱AI', icon: '🧠', desc: '国产大模型', defaultUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  { value: 'baidu', label: '文心一言', icon: '🌐', desc: '百度ERNIE', defaultUrl: 'https://qianfan.baidubce.com/v2' },
  { value: 'dashscope', label: '通义千问', icon: '💬', desc: '阿里云', defaultUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { value: 'anthropic', label: 'Claude', icon: '🧬', desc: 'Anthropic', defaultUrl: 'https://api.anthropic.com/v1' },
  { value: 'gemini', label: 'Gemini', icon: '✨', desc: 'Google', defaultUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  { value: 'moonshot', label: 'Moonshot', icon: '🌙', desc: '月之暗面', defaultUrl: 'https://api.moonshot.cn/v1' },
  { value: 'ollama', label: 'Ollama', icon: '🏠', desc: '本地部署', defaultUrl: 'http://localhost:11434/v1' },
  { value: 'minimax', label: 'MiniMax', icon: '🎯', desc: '海螺AI', defaultUrl: 'https://api.minimax.chat/v1' },
  { value: 'custom', label: '自定义', icon: '🔧', desc: '其他API', defaultUrl: '' },
];

const getModelOptions = (provider: string) => {
  const models: Record<string, Array<{value: string; label: string}>> = {
    siliconflow: [
      { value: 'Qwen/Qwen2.5-72B-Instruct', label: 'Qwen2.5-72B' },
      { value: 'Qwen/Qwen2.5-32B-Instruct', label: 'Qwen2.5-32B' },
      { value: 'deepseek-ai/DeepSeek-V2.5', label: 'DeepSeek-V2.5' },
      { value: 'THUDM/glm-4-9b-chat', label: 'GLM-4-9B' },
    ],
    deepseek: [
      { value: 'deepseek-chat', label: 'DeepSeek V3' },
      { value: 'deepseek-coder', label: 'DeepSeek Coder' },
    ],
    zhipu: [
      { value: 'glm-4-flash', label: 'GLM-4-Flash' },
      { value: 'glm-4', label: 'GLM-4' },
      { value: 'glm-4-plus', label: 'GLM-4-Plus' },
    ],
    baidu: [
      { value: 'ernie-4.0-8k-latest', label: 'ERNIE-4.0' },
      { value: 'ernie-3.5-8k', label: 'ERNIE-3.5' },
      { value: 'ernie-lite-8k', label: 'ERNIE-Lite' },
    ],
    dashscope: [
      { value: 'qwen-max', label: 'Qwen-Max' },
      { value: 'qwen-plus', label: 'Qwen-Plus' },
      { value: 'qwen-turbo', label: 'Qwen-Turbo' },
      { value: 'yi-large', label: 'Yi-Large' },
    ],
    anthropic: [
      { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
      { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    ],
    gemini: [
      { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
      { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    ],
    ollama: [
      { value: 'llama3.1:8b', label: 'Llama 3.1 8B' },
      { value: 'llama3.1:70b', label: 'Llama 3.1 70B' },
      { value: 'qwen2.5:7b', label: 'Qwen 2.5 7B' },
    ],
    moonshot: [
      { value: 'moonshot-v1-128k', label: 'Moonshot V1-128K' },
      { value: 'moonshot-v1-32k', label: 'Moonshot V1-32K' },
      { value: 'moonshot-v1-8k', label: 'Moonshot V1-8K' },
    ],
    minimax: [
      { value: 'abab6.5s-chat', label: 'ABAB6.5S' },
    ],
    custom: [],
  };
  return models[provider] || [];
};

export function AIServiceForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: AIServiceFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean; message: string} | null>(null);
  const [showCustomModel, setShowCustomModel] = useState(false);
  const [showCustomUrl, setShowCustomUrl] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<AIServiceFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || '',
      provider: initialData?.provider || '',
      model: initialData?.model || '',
      apiKey: initialData?.apiKey || '',
      baseUrl: initialData?.baseUrl || '',
      temperature: initialData?.temperature || 0.7,
      maxTokens: initialData?.maxTokens || 4000,
      description: initialData?.description || '',
    },
  });

  const selectedProvider = watch('provider');
  const selectedModel = watch('model');
  const currentBaseUrl = watch('baseUrl');

  useEffect(() => {
    if (initialData?.provider) {
      const models = getModelOptions(initialData.provider);
      const isCustom = models.length === 0 || !models.some(m => m.value === initialData.model);
      setShowCustomModel(isCustom);

      const provider = providers.find(p => p.value === initialData.provider);
      const isUrlCustom = Boolean(!provider?.defaultUrl ||
        (initialData.baseUrl && initialData.baseUrl !== provider?.defaultUrl));
      setShowCustomUrl(isUrlCustom);
    }
  }, [initialData]);

  const getDefaultUrl = (provider: string) => {
    return providers.find(p => p.value === provider)?.defaultUrl || '';
  };

  const handleProviderSelect = (providerValue: string) => {
    setValue('provider', providerValue);
    const models = getModelOptions(providerValue);
    const providerInfo = providers.find(p => p.value === providerValue);

    setShowCustomModel(models.length === 0);
    setShowCustomUrl(!providerInfo?.defaultUrl);

    if (providerInfo?.defaultUrl) {
      setValue('baseUrl', providerInfo.defaultUrl);
    }

    if (models.length > 0) {
      setValue('model', models[0].value);
    } else {
      setValue('model', '');
    }
  };

  const handleModelSelect = (model: string) => {
    setValue('model', model);
    setShowCustomModel(false);
  };

  const handleCustomModelToggle = () => {
    if (showCustomModel) {
      const models = getModelOptions(selectedProvider);
      if (models.length > 0) {
        setValue('model', models[0].value);
      }
    }
    setShowCustomModel(!showCustomModel);
  };

  const handleCustomUrlToggle = () => {
    if (showCustomUrl) {
      const defaultUrl = getDefaultUrl(selectedProvider);
      if (defaultUrl) {
        setValue('baseUrl', defaultUrl);
      }
    }
    setShowCustomUrl(!showCustomUrl);
  };

  const testConnection = async () => {
    const formData = watch();

    if (!formData.provider) {
      toast.error('请选择服务商');
      return;
    }
    if (!formData.model) {
      toast.error('请选择或输入模型');
      return;
    }
    if (!formData.apiKey) {
      toast.error('请输入API密钥');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const data = await apiClient.post('/ai/llm-settings/test', {
        provider: formData.provider,
        apiKey: formData.apiKey,
        baseUrl: formData.baseUrl || getDefaultUrl(formData.provider),
        model: formData.model,
      });

      setTestResult({ success: true, message: data.message || '连接成功！' });
      toast.success('连接成功');
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || '连接失败';
      setTestResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  const onFormSubmit = async (data: AIServiceFormValues) => {
    await onSubmit({
      ...data,
      baseUrl: data.baseUrl || getDefaultUrl(data.provider),
    });
  };

  const modelOptions = getModelOptions(selectedProvider);
  const hasPresetModels = modelOptions.length > 0;
  const providerInfo = providers.find(p => p.value === selectedProvider);
  const hasDefaultUrl = !!providerInfo?.defaultUrl;
  const selectedProviderInfo = providers.find(p => p.value === selectedProvider);

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="mobile-form">
      {/* 提供商选择 - 卡片式 */}
      <div className="form-section">
        <label className="section-label">选择服务商</label>
        <div className="provider-grid">
          {providers.map((p) => (
            <div
              key={p.value}
              className={`provider-card ${selectedProvider === p.value ? 'selected' : ''}`}
              onClick={() => handleProviderSelect(p.value)}
            >
              <span className="provider-icon">{p.icon}</span>
              <span className="provider-name">{p.label}</span>
              <span className="provider-desc">{p.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 选中的提供商信息 */}
      {selectedProvider && selectedProviderInfo && (
        <div className="selected-provider-info">
          <span className="selected-provider-icon">{selectedProviderInfo.icon}</span>
          <div className="selected-provider-details">
            <div className="selected-provider-name">{selectedProviderInfo.label}</div>
            <div className="selected-provider-model">
              {providerInfo?.defaultUrl || '需要配置API地址'}
            </div>
          </div>
        </div>
      )}

      {/* 服务名称 */}
      <div className="form-section">
        <label className="section-label">服务名称</label>
        <input
          type="text"
          {...register('name')}
          placeholder="例如：我的硅基流动"
          className="form-input"
        />
        {errors.name && <span style={{color: 'red', fontSize: '12px'}}>{errors.name.message}</span>}
      </div>

      {/* 模型选择 */}
      <div className="form-section">
        <label className="section-label">选择模型</label>
        {hasPresetModels && !showCustomModel ? (
          <>
            <div className="model-grid">
              {modelOptions.map((m) => (
                <div
                  key={m.value}
                  className={`model-chip ${selectedModel === m.value ? 'selected' : ''}`}
                  onClick={() => handleModelSelect(m.value)}
                >
                  {m.label}
                </div>
              ))}
            </div>
            <button type="button" onClick={handleCustomModelToggle} className="link-btn">
              + 自定义模型
            </button>
          </>
        ) : (
          <>
            <input
              type="text"
              {...register('model')}
              placeholder="输入模型名称"
              className="form-input"
            />
            {errors.model && <span style={{color: 'red', fontSize: '12px'}}>{errors.model.message}</span>}
            {hasPresetModels && (
              <button type="button" onClick={handleCustomModelToggle} className="link-btn">
                ← 选择预设模型
              </button>
            )}
          </>
        )}
      </div>

      {/* API密钥 */}
      <div className="form-section">
        <label className="section-label">API密钥</label>
        <input
          type="password"
          {...register('apiKey')}
          placeholder="输入API密钥"
          className="form-input"
        />
        {errors.apiKey && <span style={{color: 'red', fontSize: '12px'}}>{errors.apiKey.message}</span>}
      </div>

      {/* API地址 */}
      <div className="form-section">
        <label className="section-label">
          API地址 {hasDefaultUrl && !showCustomUrl && <span className="label-hint">(默认)</span>}
        </label>
        {hasDefaultUrl && !showCustomUrl ? (
          <>
            <div className="url-preview">{currentBaseUrl || getDefaultUrl(selectedProvider)}</div>
            <button type="button" onClick={handleCustomUrlToggle} className="link-btn">
              + 自定义地址
            </button>
          </>
        ) : (
          <>
            <input
              type="text"
              {...register('baseUrl')}
              placeholder="输入API地址"
              className="form-input"
            />
            {hasDefaultUrl && (
              <button type="button" onClick={handleCustomUrlToggle} className="link-btn">
                ← 使用默认地址
              </button>
            )}
          </>
        )}
      </div>

      {/* 高级设置 */}
      <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="advanced-toggle">
        {showAdvanced ? '▲ 收起高级设置' : '▼ 高级设置'}
      </button>

      {showAdvanced && (
        <div className="advanced-panel">
          <div className="form-row">
            <div className="form-section half">
              <label className="section-label">温度</label>
              <input type="number" step="0.1" min="0" max="2" {...register('temperature', { valueAsNumber: true })} className="form-input" />
            </div>
            <div className="form-section half">
              <label className="section-label">最大Token</label>
              <input type="number" step="100" min="100" max="128000" {...register('maxTokens', { valueAsNumber: true })} className="form-input" />
            </div>
          </div>
          <div className="form-section">
            <label className="section-label">描述（可选）</label>
            <textarea {...register('description')} placeholder="服务描述" rows={2} className="form-input" />
          </div>
        </div>
      )}

      {/* 测试连接 */}
      <div className="test-section">
        <button type="button" onClick={testConnection} disabled={testing} className="test-btn">
          {testing ? '测试中...' : '测试连接'}
        </button>
        {testResult && (
          <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
            {testResult.message}
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="action-section">
        <button type="button" onClick={onCancel} disabled={isSubmitting} className="cancel-btn">
          取消
        </button>
        <button type="submit" disabled={isSubmitting} className="submit-btn">
          {isSubmitting ? '保存中...' : '保存'}
        </button>
      </div>
    </form>
  );
}
