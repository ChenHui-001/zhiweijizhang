import { logger } from '../utils/logger';
import { Router, Request, Response } from 'express';
import crypto from 'crypto';

const router = Router();

// RevenueCat Webhook处理 - 会员系统已禁用，仅记录日志
router.post('/revenuecat', async (req: Request, res: Response) => {
  try {
    logger.info('📨 [RevenueCatWebhook] 收到webhook请求（会员系统已禁用）:', {
      body: req.body
    });

    // 会员系统已移除，直接返回成功
    return res.status(200).json({
      success: true,
      message: 'Webhook received but membership system is disabled'
    });

  } catch (error: any) {
    logger.error('❌ [RevenueCatWebhook] 处理失败:', error);
    return res.status(500).json({
      success: false,
      message: 'Webhook processing failed',
      error: error.message
    });
  }
});

export default router;
