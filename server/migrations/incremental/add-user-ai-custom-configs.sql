/*META
VERSION: 1.9.0
DESCRIPTION: Add user AI custom configuration tables for smart accounting optimization
AUTHOR: Claude Code Assistant
*/

-- =====================================================
-- 1. 用户智能记账AI配置表
-- =====================================================
CREATE TABLE IF NOT EXISTS user_ai_smart_accounting_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    config_key VARCHAR(100) NOT NULL,
    config_value TEXT,
    config_type VARCHAR(50) DEFAULT 'prompt',
    description TEXT,
    is_enabled BOOLEAN DEFAULT true,
    priority INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, config_key)
);

CREATE INDEX idx_user_ai_configs_user_id ON user_ai_smart_accounting_configs(user_id);
CREATE INDEX idx_user_ai_configs_key ON user_ai_smart_accounting_configs(config_key);
CREATE INDEX idx_user_ai_configs_type ON user_ai_smart_accounting_configs(config_type);

COMMENT ON TABLE user_ai_smart_accounting_configs IS '用户智能记账AI配置表';
COMMENT ON COLUMN user_ai_smart_accounting_configs.config_key IS '配置键：custom_prompt, classification_rules, amount_patterns等';
COMMENT ON COLUMN user_ai_smart_accounting_configs.config_type IS '配置类型：prompt, rule, mapping, parameter';
COMMENT ON COLUMN user_ai_smart_accounting_configs.is_enabled IS '是否启用该配置';

-- =====================================================
-- 2. 用户分类映射规则表
-- =====================================================
CREATE TABLE IF NOT EXISTS user_category_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    keyword VARCHAR(200) NOT NULL,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    match_type VARCHAR(50) DEFAULT 'contains',
    priority INT DEFAULT 0,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_category_mappings_user_id ON user_category_mappings(user_id);
CREATE INDEX idx_user_category_mappings_keyword ON user_category_mappings(keyword);
CREATE INDEX idx_user_category_mappings_category_id ON user_category_mappings(category_id);
CREATE INDEX idx_user_category_mappings_priority ON user_category_mappings(priority);

COMMENT ON TABLE user_category_mappings IS '用户分类映射规则表';
COMMENT ON COLUMN user_category_mappings.keyword IS '关键词或模式：如"咖啡"、"打车"';
COMMENT ON COLUMN user_category_mappings.match_type IS '匹配类型：contains, exact, regex';
COMMENT ON COLUMN user_category_mappings.priority IS '优先级，数字越大优先级越高';

-- =====================================================
-- 3. 账本级别AI配置表
-- =====================================================
CREATE TABLE IF NOT EXISTS account_book_ai_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_book_id UUID NOT NULL REFERENCES account_books(id) ON DELETE CASCADE,
    config_key VARCHAR(100) NOT NULL,
    config_value TEXT,
    config_type VARCHAR(50) DEFAULT 'parameter',
    description TEXT,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(account_book_id, config_key)
);

CREATE INDEX idx_account_book_ai_configs_account_id ON account_book_ai_configs(account_book_id);
CREATE INDEX idx_account_book_ai_configs_key ON account_book_ai_configs(config_key);

COMMENT ON TABLE account_book_ai_configs IS '账本级别AI配置表';
COMMENT ON COLUMN account_book_ai_configs.config_key IS '配置键：default_model, temperature, max_tokens, custom_prompt, default_category等';

-- =====================================================
-- 4. 插入默认的用户AI配置模板
-- =====================================================

-- 默认智能记账提示词（增强版）
INSERT INTO user_ai_smart_accounting_configs (user_id, config_key, config_value, config_type, description, is_enabled)
VALUES (
    (SELECT id FROM users LIMIT 1),
    'enhanced_smart_accounting_prompt',
    '你是专业财务助手，能从用户描述中精准提取记账信息。

核心要求：
1. 金额提取：只提取数字金额，忽略货币符号
2. 日期识别：支持"今天"、"昨天"、"前天"、"本周"、"上周"等相对日期
3. 分类匹配：严格匹配提供的分类列表，优先使用最具体的分类
4. 类型判断：根据关键词判断收入/支出（买、花、付、支出→支出；收、得、工资、奖金→收入）
5. 预算匹配：若提到具体人名或预算名称，精确匹配

分类列表：
{{categories}}

预算列表：
{{budgets}}

输出要求：
- 只返回JSON格式，不要包含任何其他文字
- 金额必须是数字类型
- 日期必须是 YYYY-MM-DD 格式
- confidence表示分类置信度（0-1之间的小数）

返回JSON格式：
{
  "amount": 128.50,
  "date": "2025-05-19",
  "categoryId": "分类UUID",
  "categoryName": "分类名称",
  "type": "EXPENSE",
  "budgetName": "预算名称(可选)",
  "budgetId": "预算UUID(可选)",
  "confidence": 0.95,
  "note": "简洁的备注"
}',
    'prompt',
    '增强版智能记账提示词模板',
    true
);

-- 默认分类规则
INSERT INTO user_ai_smart_accounting_configs (user_id, config_key, config_value, config_type, description, is_enabled)
VALUES (
    (SELECT id FROM users LIMIT 1),
    'classification_rules',
    '{
  "income_keywords": ["工资", "奖金", "收入", "赚", "收", "到账", "分红", "利息", "退款"],
  "expense_keywords": ["买", "花", "支付", "消费", "支出", "花费", "付", "购买", "订单"],
  "food_keywords": ["吃饭", "餐厅", "外卖", "美食", "午餐", "晚餐", "早餐"],
  "transport_keywords": ["打车", "滴滴", "公交", "地铁", "出租车", "加油", "停车"],
  "shopping_keywords": ["淘宝", "京东", "天猫", "购物", "商场", "超市", "便利店"]
}',
    'rule',
    '分类识别关键词规则',
    true
);

-- 默认金额识别模式
INSERT INTO user_ai_smart_accounting_configs (user_id, config_key, config_value, config_type, description, is_enabled)
VALUES (
    (SELECT id FROM users LIMIT 1),
    'amount_patterns',
    '{
  "patterns": [
    {"pattern": "花了(\\d+(?:\\.\\d+)?)", "description": "花了X元"},
    {"pattern": "支付了(\\d+(?:\\.\\d+)?)", "description": "支付了X元"},
    {"pattern": "消费(\\d+(?:\\.\\d+)?)", "description": "消费X元"},
    {"pattern": "收了(\\d+(?:\\.\\d+)?)", "description": "收了X元"},
    {"pattern": "工资(\\d+(?:\\.\\d+)?)", "description": "工资X元"}
  ],
  "currency_units": ["元", "块", "rmb", "CNY"],
  "default_currency": "CNY"
}',
    'parameter',
    '金额识别正则表达式模式',
    true
);

-- =====================================================
-- 5. 更新版本记录
-- =====================================================
INSERT INTO schema_versions (version, description, applied_at)
VALUES ('1.9.0', 'Add user AI custom configuration tables for smart accounting', NOW())
ON CONFLICT (version) DO UPDATE SET
    description = EXCLUDED.description,
    applied_at = NOW();

-- =====================================================
-- 6. 记录迁移日志
-- =====================================================
INSERT INTO internal_scheduled_tasks (name, task_type, config, is_enabled, last_run_at, next_run_at, created_at)
VALUES (
    'migration_1.9.0_user_ai_config',
    'migration',
    '{"migration_version": "1.9.0", "description": "User AI custom configuration tables"}',
    false,
    NOW(),
    NOW(),
    NOW()
);
