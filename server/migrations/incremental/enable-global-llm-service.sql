-- 启用全局AI服务配置
-- 用于支持用户使用自定义AI服务功能

-- 启用全局LLM配置（设置为true以支持AI功能）
UPDATE system_configs
SET value = 'true'
WHERE key = 'llm_global_enabled';

-- 如果记录不存在，则插入
INSERT INTO system_configs (key, value, description, category)
VALUES ('llm_global_enabled', 'true', '是否启用全局LLM配置', 'llm')
ON CONFLICT (key) DO NOTHING;
