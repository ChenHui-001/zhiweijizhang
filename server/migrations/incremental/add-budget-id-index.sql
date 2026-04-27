/*META
VERSION: add-budget-id-index
DESCRIPTION: 为transactions表的budget_id字段添加索引，优化预算金额计算查询性能
AUTHOR: system
*/

-- =======================================
-- 增量迁移：添加budget_id索引
-- transactions表已有primary_budget_id、is_multi_budget、budget_allocation的索引，
-- 但budget_id字段本身没有独立索引，导致预算金额计算时全表扫描
-- 创建时间: 2025-04-27
-- =======================================

-- 为budget_id添加索引（NOT IN处理null值，避免对空值建立索引）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_budget_id
ON transactions (budget_id)
WHERE budget_id IS NOT NULL;

-- 为预算聚合查询添加复合索引（budget_id + type + date，覆盖预算金额计算场景）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_budget_type_date
ON transactions (budget_id, type, date)
WHERE budget_id IS NOT NULL AND type = 'EXPENSE';
