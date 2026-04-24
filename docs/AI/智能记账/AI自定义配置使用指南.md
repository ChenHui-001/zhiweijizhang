# AI智能记账自定义配置使用指南

## 📖 功能概述

本功能允许用户自定义AI智能记账的配置，包括：
1. **自定义提示词** - 修改AI记账的提示词模板
2. **分类规则** - 定义关键词识别规则
3. **分类映射** - 设置关键词到分类的直接映射

## 🚀 使用方法

### 1. 访问配置页面

路径：`/settings/ai-config`

### 2. 自定义提示词

在"自定义提示词"标签页中，您可以：

- **启用/禁用**：控制是否使用自定义提示词
- **编辑模板**：修改AI记账的提示词
- **变量说明**：
  - `{{categories}}` - 分类列表（系统自动填充）
  - `{{budgets}}` - 预算列表（系统自动填充）
  - `{{description}}` - 用户输入的描述
  - `{{currentDate}}` - 当前日期

#### 示例提示词

```markdown
你是专业财务助手，能从用户描述中精准提取记账信息。

核心要求：
1. 金额提取：只提取数字金额
2. 日期识别：支持"今天"、"昨天"等相对日期
3. 分类匹配：严格匹配提供的分类列表
4. 类型判断：根据关键词判断收入/支出

分类列表：
{{categories}}

返回JSON格式：
{
  "amount": 128.50,
  "date": "2025-05-19",
  "categoryId": "分类UUID",
  "categoryName": "分类名称",
  "type": "EXPENSE",
  "confidence": 0.95,
  "note": "备注"
}
```

### 3. 分类规则

在"分类规则"标签页中，您可以定义关键词规则：

```json
{
  "income_keywords": ["工资", "奖金", "收入", "赚", "收", "到账"],
  "expense_keywords": ["买", "花", "支付", "消费", "支出"],
  "food_keywords": ["吃饭", "餐厅", "外卖", "咖啡"],
  "transport_keywords": ["打车", "滴滴", "公交", "地铁"],
  "shopping_keywords": ["淘宝", "京东", "天猫", "购物"]
}
```

这些关键词会帮助AI更准确地判断收支类型。

### 4. 分类映射

在"分类映射"标签页中，您可以设置关键词到分类的直接映射：

| 关键词 | 映射分类 | 匹配类型 |
|--------|----------|----------|
| 咖啡 | 餐饮 | 包含 |
| 星巴克 | 餐饮 | 包含 |
| 打车 | 交通 | 包含 |
| 地铁 | 交通 | 包含 |

#### 匹配类型说明

- **包含**：只要描述中包含关键词即匹配（如"买了一杯咖啡"匹配"咖啡"）
- **完全匹配**：描述必须与关键词完全一致
- **正则表达式**：使用正则表达式进行匹配

## 💡 最佳实践

### 1. 提示词优化建议

- 保持提示词简洁明了
- 明确分类的优先级
- 添加常见消费场景的示例
- 包含日期和金额的识别规则

### 2. 关键词设置建议

- 使用常用的消费场景关键词
- 避免过于宽泛的关键词
- 定期更新关键词列表
- 注意关键词的大小写

### 3. 分类映射建议

- 为常用消费设置直接映射
- 优先使用"包含"匹配类型
- 保持映射规则简洁
- 定期检查和优化映射

## 🔧 API接口

### 用户AI配置

```
GET    /api/ai-config/user/configs           # 获取用户所有AI配置
GET    /api/ai-config/user/prompt            # 获取自定义提示词
POST   /api/ai-config/user/prompt            # 保存自定义提示词
GET    /api/ai-config/user/rules             # 获取分类规则
POST   /api/ai-config/user/rules            # 保存分类规则
```

### 分类映射

```
GET    /api/ai-config/user/mappings          # 获取映射列表
POST   /api/ai-config/user/mappings         # 创建映射
PUT    /api/ai-config/user/mappings/:id     # 更新映射
DELETE /api/ai-config/user/mappings/:id     # 删除映射
```

### 账本AI配置

```
GET    /api/ai-config/account/:id/configs    # 获取账本配置
POST   /api/ai-config/account/:id/configs   # 保存账本配置
DELETE /api/ai-config/account/:id/configs/:configId  # 删除账本配置
```

### 导入导出

```
GET    /api/ai-config/user/export            # 导出配置
POST   /api/ai-config/user/import            # 导入配置
```

## 📊 数据库表

### user_ai_smart_accounting_configs

用户AI配置表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户ID |
| config_key | VARCHAR | 配置键 |
| config_value | TEXT | 配置值 |
| config_type | VARCHAR | 配置类型：prompt, rule, parameter |
| description | TEXT | 描述 |
| is_enabled | BOOLEAN | 是否启用 |
| priority | INT | 优先级 |

### user_category_mappings

分类映射表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户ID |
| keyword | VARCHAR | 关键词 |
| category_id | UUID | 分类ID |
| match_type | VARCHAR | 匹配类型：contains, exact, regex |
| priority | INT | 优先级 |
| is_enabled | BOOLEAN | 是否启用 |

### account_book_ai_configs

账本AI配置表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| account_book_id | UUID | 账本ID |
| config_key | VARCHAR | 配置键 |
| config_value | TEXT | 配置值 |
| config_type | VARCHAR | 配置类型 |
| description | TEXT | 描述 |
| is_enabled | BOOLEAN | 是否启用 |

## 🐛 故障排除

### 配置不生效

1. 检查配置是否启用（is_enabled = true）
2. 确认提示词格式正确（JSON格式）
3. 查看服务器日志
4. 重启智能记账功能

### 分类映射不匹配

1. 检查关键词是否正确
2. 确认匹配类型设置正确
3. 验证分类ID是否存在
4. 检查优先级设置

### 性能问题

1. 减少自定义提示词长度
2. 优化分类映射数量
3. 使用缓存功能
4. 定期清理过期配置

## 📝 更新日志

### v1.9.0 (2025-04-23)

- 新增用户AI自定义配置功能
- 新增自定义提示词功能
- 新增分类规则功能
- 新增分类映射功能
- 新增账本级别AI配置
- 新增配置导入导出功能
- 优化智能记账提示词
- 创建增强版智能记账服务

## 🤝 反馈与建议

如果您在使用过程中遇到问题或有改进建议，请通过以下方式反馈：

- 提交Issue到GitHub
- 联系开发团队
- 在社区论坛发帖

## 📄 许可证

本功能遵循项目统一的开源许可证。
