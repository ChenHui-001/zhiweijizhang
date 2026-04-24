import { Router } from 'express';
import userAIConfigController from '../controllers/user-ai-config.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

/**
 * 用户AI智能记账配置路由
 */

// 用户级别的AI配置路由
router.get('/user/configs', authenticate, userAIConfigController.getUserConfigs.bind(userAIConfigController));
router.get('/user/configs/type/:type', authenticate, userAIConfigController.getUserConfigsByType.bind(userAIConfigController));
router.post('/user/configs', authenticate, userAIConfigController.upsertUserConfig.bind(userAIConfigController));
router.delete('/user/configs/:configId', authenticate, userAIConfigController.deleteUserConfig.bind(userAIConfigController));

// 用户自定义提示词
router.get('/user/prompt', authenticate, userAIConfigController.getUserPrompt.bind(userAIConfigController));
router.post('/user/prompt', authenticate, userAIConfigController.saveUserPrompt.bind(userAIConfigController));

// 用户分类规则
router.get('/user/rules', authenticate, userAIConfigController.getUserRules.bind(userAIConfigController));
router.post('/user/rules', authenticate, userAIConfigController.saveUserRules.bind(userAIConfigController));

// 用户分类映射
router.get('/user/mappings', authenticate, userAIConfigController.getUserMappings.bind(userAIConfigController));
router.post('/user/mappings', authenticate, userAIConfigController.createMapping.bind(userAIConfigController));
router.post('/user/mappings/batch', authenticate, userAIConfigController.batchCreateMappings.bind(userAIConfigController));
router.put('/user/mappings/:mappingId', authenticate, userAIConfigController.updateMapping.bind(userAIConfigController));
router.delete('/user/mappings/:mappingId', authenticate, userAIConfigController.deleteMapping.bind(userAIConfigController));

// 账本级别AI配置
router.get('/account/:accountId/configs', authenticate, userAIConfigController.getAccountConfigs.bind(userAIConfigController));
router.post('/account/:accountId/configs', authenticate, userAIConfigController.upsertAccountConfig.bind(userAIConfigController));
router.delete('/account/:accountId/configs/:configId', authenticate, userAIConfigController.deleteAccountConfig.bind(userAIConfigController));

// 导入导出
router.get('/user/export', authenticate, userAIConfigController.exportUserConfig.bind(userAIConfigController));
router.post('/user/import', authenticate, userAIConfigController.importUserConfig.bind(userAIConfigController));

export default router;
