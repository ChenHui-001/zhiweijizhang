import { logger } from '../utils/logger';
import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// 同步客户信息API - 会员系统已禁用
router.post('/sync-customer', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    logger.info('📱 [SyncCustomer] 收到客户信息同步请求（会员系统已禁用）:', { userId });

    return res.json({
      success: true,
      message: '会员系统已禁用，无需同步'
    });
  } catch (error: any) {
    logger.error('📱 [SyncCustomer] 处理失败:', error);
    return res.status(500).json({
      success: false,
      message: '同步客户信息失败',
      error: error.message
    });
  }
});

// 同步购买信息API - 会员系统已禁用
router.post('/sync-purchase', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    logger.info('📱 [SyncPurchase] 收到购买同步请求（会员系统已禁用）:', { userId });

    return res.json({
      success: true,
      message: '会员系统已禁用，无需同步'
    });
  } catch (error: any) {
    logger.error('📱 [SyncPurchase] 处理失败:', error);
    return res.status(500).json({
      success: false,
      message: '同步购买信息失败',
      error: error.message
    });
  }
});

export default router;
