/**
 * Android H5支付路由
 * 处理Android客户端的H5支付请求
 */

import { logger } from '../utils/logger';
import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { H5PaymentService } from '../services/h5-payment.service';
import { getAndroidH5ProductById, getProductPrice, AndroidH5Product } from '../config/android-h5-products';
import { AppError } from '../errors/AppError';

const router = Router();

// H5支付配置
const h5PaymentConfig = {
  appId: process.env.H5_PAYMENT_APP_ID || '',
  appSecret: process.env.H5_PAYMENT_APP_SECRET || '',
  notifyUrl: process.env.H5_PAYMENT_NOTIFY_URL || `${process.env.API_BASE_URL}/api/android-h5-payment/notify`,
  apiBaseUrl: process.env.H5_PAYMENT_API_BASE_URL || 'https://open.h5zhifu.com'
};

const h5PaymentService = new H5PaymentService(h5PaymentConfig);

/**
 * 创建H5支付订单
 * POST /api/android-h5-payment/create-order
 */
router.post('/create-order', authenticate, async (req: Request, res: Response) => {
  try {
    const { productId, payType } = req.body;
    const userId = req.user!.id;

    logger.info('💰 [AndroidH5Payment] 创建支付订单请求:', {
      userId,
      productId,
      payType
    });

    // 验证参数
    if (!productId || !payType) {
      throw new AppError('缺少必要参数', 400);
    }

    if (!['wechat', 'alipay'].includes(payType)) {
      throw new AppError('不支持的支付方式', 400);
    }

    // 获取产品配置
    const product = getAndroidH5ProductById(productId);
    if (!product) {
      throw new AppError('产品不存在', 404);
    }

    if (!product.isActive) {
      throw new AppError('产品已下架', 400);
    }

    // 获取产品价格
    const amount = getProductPrice(productId, payType as 'wechat' | 'alipay');
    if (!amount) {
      throw new AppError('获取产品价格失败', 500);
    }

    // 生成订单号
    const outTradeNo = H5PaymentService.generateOrderId();

    // 构建支付请求
    const paymentRequest = {
      userId,
      productId,
      amount,
      description: product.name,
      payType: payType as 'wechat' | 'alipay',
      outTradeNo,
      attach: JSON.stringify({
        userId,
        productId,
        membershipTier: product.membershipTier,
        duration: product.duration
      })
    };

    // 创建支付订单
    const result = await h5PaymentService.createPaymentOrder(paymentRequest);

    if (result.success) {
      res.json({
        success: true,
        message: '支付订单创建成功',
        data: {
          outTradeNo,
          jumpUrl: result.data?.jumpUrl,
          tradeNo: result.data?.tradeNo,
          expireTime: result.data?.expireTime,
          amount,
          productName: product.name,
          payType
        }
      });
    } else {
      // H5支付API返回的错误码不是HTTP状态码，统一使用400
      const httpStatusCode = 400;
      throw new AppError(result.msg || '创建支付订单失败', httpStatusCode);
    }

  } catch (error: any) {
    logger.error('💰 [AndroidH5Payment] 创建订单失败:', error);
    
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.statusCode
      });
    } else {
      res.status(500).json({
        success: false,
        message: '创建支付订单失败',
        error: error.message
      });
    }
  }
});

/**
 * 查询支付状态
 * GET /api/android-h5-payment/query-status/:outTradeNo
 */
router.get('/query-status/:outTradeNo', authenticate, async (req: Request, res: Response) => {
  try {
    const { outTradeNo } = req.params;
    const userId = req.user!.id;

    logger.info('🔍 [AndroidH5Payment] 查询支付状态:', { userId, outTradeNo });

    if (!outTradeNo) {
      throw new AppError('订单号不能为空', 400);
    }

    const result = await h5PaymentService.queryPaymentStatus(outTradeNo);

    res.json({
      success: result.success,
      message: result.msg,
      data: result.data
    });

  } catch (error: any) {
    logger.error('🔍 [AndroidH5Payment] 查询状态失败:', error);
    
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: '查询支付状态失败',
        error: error.message
      });
    }
  }
});

/**
 * 获取Android H5支付产品列表
 * GET /api/android-h5-payment/products
 */
router.get('/products', authenticate, async (req: Request, res: Response) => {
  try {
    const { getActiveAndroidH5Products, getAndroidH5ProductsSummary } = require('../config/android-h5-products');
    
    const products = getActiveAndroidH5Products();
    const summary = getAndroidH5ProductsSummary();

    res.json({
      success: true,
      message: '获取产品列表成功',
      data: {
        products: products.map((product: AndroidH5Product) => ({
          id: product.id,
          name: product.name,
          description: product.description,
          membershipTier: product.membershipTier,
          duration: product.duration,
          displayPrice: product.displayPrice,
          originalPrice: product.originalPrice,
          discountPercentage: product.discountPercentage,
          monthlyPoints: product.monthlyPoints,
          hasCharityAttribution: product.hasCharityAttribution,
          hasPrioritySupport: product.hasPrioritySupport,
          isPopular: product.isPopular,
          sortOrder: product.sortOrder,
          prices: {
            wechat: product.wechatPrice,
            alipay: product.alipayPrice
          }
        })),
        summary
      }
    });

  } catch (error: any) {
    logger.error('📋 [AndroidH5Payment] 获取产品列表失败:', error);
    
    res.status(500).json({
      success: false,
      message: '获取产品列表失败',
      error: error.message
    });
  }
});

/**
 * H5支付回调通知
 * POST /api/android-h5-payment/notify
 */
router.post('/notify', async (req: Request, res: Response) => {
  try {
    logger.info('📞 [AndroidH5Payment] 收到支付回调:', req.body);

    const notification = req.body;

    // 验证必要字段
    const requiredFields = ['appId', 'outTradeNo', 'tradeNo', 'amount', 'payType', 'status', 'paidTime', 'sign'];
    for (const field of requiredFields) {
      if (!notification[field]) {
        logger.error(`📞 [AndroidH5Payment] 缺少必要字段: ${field}`);
        return res.status(400).send('FAIL');
      }
    }

    // 只处理支付成功的通知
    if (notification.status !== 'PAID') {
      logger.info('📞 [AndroidH5Payment] 非支付成功状态，忽略:', notification.status);
      return res.send('SUCCESS');
    }

    // 处理支付回调
    const success = await h5PaymentService.handlePaymentNotification(notification);

    if (success) {
      logger.info('📞 [AndroidH5Payment] 支付回调处理成功');
      res.send('SUCCESS');
    } else {
      logger.error('📞 [AndroidH5Payment] 支付回调处理失败');
      res.status(500).send('FAIL');
    }

  } catch (error: any) {
    logger.error('📞 [AndroidH5Payment] 支付回调异常:', error);
    res.status(500).send('FAIL');
  }
});

/**
 * 获取支付配置状态（用于调试）
 * GET /api/android-h5-payment/config-status
 */
router.get('/config-status', authenticate, async (req: Request, res: Response) => {
  try {
    const { validateAndroidH5ProductConfig } = require('../config/android-h5-products');
    
    const configValid = validateAndroidH5ProductConfig();
    const hasRequiredEnvVars = !!(
      process.env.H5_PAYMENT_APP_ID &&
      process.env.H5_PAYMENT_APP_SECRET &&
      process.env.H5_PAYMENT_NOTIFY_URL
    );

    res.json({
      success: true,
      data: {
        productConfigValid: configValid,
        environmentConfigured: hasRequiredEnvVars,
        config: {
          appId: process.env.H5_PAYMENT_APP_ID ? '已配置' : '未配置',
          appSecret: process.env.H5_PAYMENT_APP_SECRET ? '已配置' : '未配置',
          notifyUrl: h5PaymentConfig.notifyUrl,
          apiBaseUrl: h5PaymentConfig.apiBaseUrl
        }
      }
    });

  } catch (error: any) {
    logger.error('⚙️ [AndroidH5Payment] 获取配置状态失败:', error);
    
    res.status(500).json({
      success: false,
      message: '获取配置状态失败',
      error: error.message
    });
  }
});

export default router;
