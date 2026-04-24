import { logger } from '../utils/logger';
import express from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import config from '../config/config';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { FileStorageService } from '../services/file-storage.service';
import { BUCKET_CONFIG } from '../models/file-storage.model';

/**
 * 将S3 URL转换为代理URL
 * @param s3Url 原始S3 URL
 * @param apiBaseUrl API基础URL
 * @returns 代理URL
 */
function convertS3UrlToProxy(s3Url: string, apiBaseUrl: string): string {
  try {
    // 解析S3 URL，提取bucket和key
    // 格式: http://endpoint/bucket/key/path
    const url = new URL(s3Url);
    const pathParts = url.pathname.split('/').filter((part) => part.length > 0);

    if (pathParts.length < 2) {
      logger.warn('无效的S3 URL格式:', s3Url);
      return s3Url;
    }

    const bucket = pathParts[0];
    const key = pathParts.slice(1).join('/');

    // 构建代理API URL
    const proxyUrl = `${apiBaseUrl}/api/image-proxy/s3/${bucket}/${key}`;

    logger.info('🔄 S3 URL转换为代理URL:', { original: s3Url, proxy: proxyUrl });

    return proxyUrl;
  } catch (error) {
    logger.error('S3 URL转换失败:', error, s3Url);
    return s3Url; // 转换失败时返回原URL
  }
}

const router = express.Router();
const fileStorageService = FileStorageService.getInstance();

// 配置multer用于文件上传
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB限制
  },
  fileFilter: (req, file, cb) => {
    // 只允许图片文件
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'));
    }
  }
});

/**
 * 验证快捷指令临时token（JWT签名验证）
 */
function validateShortcutsToken(token: string): { valid: boolean; userId?: string } {
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as any;

    if (decoded.purpose !== 'shortcuts-upload') {
      logger.info('🔒 Token验证失败: purpose不匹配', decoded.purpose);
      return { valid: false };
    }

    const remainingHours = decoded.exp
      ? Math.floor((decoded.exp * 1000 - Date.now()) / (60 * 60 * 1000))
      : 0;
    logger.info('🔒 Token验证成功', { userId: decoded.userId, remainingHours });
    return { valid: true, userId: decoded.userId };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.info('🔒 Token验证失败: 已过期');
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.info('🔒 Token验证失败: 签名无效');
    } else {
      logger.info('🔒 Token验证失败: 解析错误', error);
    }
    return { valid: false };
  }
}

/**
 * @route POST /upload/shortcuts
 * @desc 快捷指令图片上传
 * @access Public (需要临时token)
 */
router.post('/shortcuts', upload.single('image'), async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: '缺少授权token' });
    }
    
    const tokenValidation = validateShortcutsToken(token);
    if (!tokenValidation.valid) {
      return res.status(401).json({ error: '无效或过期的token' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }
    
    // 使用对象存储服务上传到临时存储桶
    const uploadResult = await fileStorageService.uploadFile(
      req.file,
      {
        bucket: BUCKET_CONFIG.TEMP,
        category: 'shortcuts',
        description: '快捷指令临时图片',
        expiresIn: 3600, // 1小时后过期
      },
      tokenValidation.userId!
    );

    // 获取原始S3 URL
    const originalImageUrl = uploadResult.url;

    // 动态确定API基础URL
    let apiBaseUrl = process.env.EXTERNAL_DOMAIN || process.env.API_BASE_URL;
    if (!apiBaseUrl) {
      if (process.env.NODE_ENV === 'development') {
        apiBaseUrl = 'https://jz-dev.jacksonz.cn:4443';
      } else {
        apiBaseUrl = 'https://app.zhiweijz.cn:1443';
      }
    }

    // 转换为代理URL
    const imageUrl = convertS3UrlToProxy(originalImageUrl, apiBaseUrl);

    logger.info('🚀 [快捷指令上传] 文件上传成功:', {
      userId: tokenValidation.userId,
      fileName: uploadResult.filename,
      size: uploadResult.size,
      originalImageUrl,
      imageUrl
    });

    res.json({
      success: true,
      imageUrl,
      fileName: uploadResult.filename,
      size: uploadResult.size
    });
    
  } catch (error) {
    logger.error('快捷指令文件上传错误:', error);
    res.status(500).json({
      error: '文件上传失败',
      details: error instanceof Error ? error.message : '未知错误'
    });
  }
});

export default router;
