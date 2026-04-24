# 项目问题修复总结

## 修复日期
2026-04-24

## P0 优先级修复

### 1. Git 仓库初始化
- 状态: ✅ 已完成
- 提交: c406979

### 2. npm workspaces 配置修正
- 修改: `package.json` workspaces 从 `["packages/*", "apps/*"]` 改为 `["packages/*"]`
- 原因: apps/android 和 apps/ios 是 React Native 项目，不应该由 workspaces 管理
- 状态: ✅ 已完成

### 3. tsconfig.json 修复
- 修改: 更新 paths 配置，移除不存在的 `@client/*` 和 `@shared/*`
- include/exclude: 调整为只包含 server/src
- 状态: ✅ 已完成

## P1 优先级修复

### 4. 清理备份目录
- 删除: `apps/web/src/pages_backup/`
- 状态: ✅ 已完成

### 5. 统一中间件目录
- 合并: `server/src/middlewares/` → `server/src/middleware/`
- 更新: 32 个文件的 import 路径
- 状态: ✅ 已完成

### 6. packages/web vs apps/web 关系确认
- 结论: 这是正常的设计关系
- packages/web: 内部共享组件库（通过 workspaces 管理）
- apps/web: Next.js 主应用（通过 tsconfig paths 引用 packages/web/src）
- 状态: ✅ 已确认，无需修改

## P2 优先级修复

### 7. .env.docker 配置完善
- 添加: 所有 docker-compose.yml 所需的 60+ 环境变量
- 包括: 数据库、MinIO、Nginx、微信公众号、支付配置等
- 状态: ✅ 已完成

## P3 优先级

### 8. 其他问题确认
- packages/core 依赖问题: 通过 tsconfig paths + declaration files 正确处理
- 状态: ✅ 确认为正常设计

## Git 提交记录
- c406979: refactor: 修复项目结构和配置问题
