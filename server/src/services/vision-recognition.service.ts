import { logger } from '../utils/logger';
import axios from 'axios';
import {
  VisionRecognitionRequest,
  VisionRecognitionResponse,
  MultimodalAIResponse,
  MultimodalAIError,
  MultimodalAIErrorType,
  VisionRecognitionConfig,
} from '../models/multimodal-ai.model';
import multimodalAIConfigService from './multimodal-ai-config.service';
import { VisionProviderManager } from '../ai/vision/vision-provider-manager';

/**
 * 视觉识别服务
 * 支持多个视觉识别提供商，包括硅基流动、火山方舟等
 */
export class VisionRecognitionService {
  private providerManager: VisionProviderManager;

  constructor() {
    this.providerManager = new VisionProviderManager();
  }

  /**
   * 图片识别 - 直接调用原始方法，无需积分检查
   * @param request 图片识别请求
   * @param userId 用户ID
   */
  async recognizeImageWithStandalonePointsDeduction(request: VisionRecognitionRequest, userId: string): Promise<MultimodalAIResponse> {
    logger.info(`✅ [图片识别] 用户 ${userId} 使用图片识别功能`);
    return await this.recognizeImage(request);
  }

  /**
   * 图片识别 - 用于智能记账，直接调用原始方法，无需积分检查
   * @param request 图片识别请求
   * @param userId 用户ID
   */
  async recognizeImageWithPointsDeduction(request: VisionRecognitionRequest, userId: string): Promise<MultimodalAIResponse> {
    logger.info(`✅ [图片识别] 用户 ${userId} 使用图片识别功能（智能记账）`);
    return await this.recognizeImage(request);
  }

  /**
   * 图片识别（原始方法，不扣除记账点）
   */
  async recognizeImage(request: VisionRecognitionRequest): Promise<MultimodalAIResponse> {
    const startTime = Date.now();

    try {
      // 获取配置
      const config = await multimodalAIConfigService.getVisionConfig();

      // 检查功能是否启用
      if (!config.enabled) {
        throw new MultimodalAIError(
          MultimodalAIErrorType.INVALID_CONFIG,
          '视觉识别功能未启用'
        );
      }

      // 验证配置
      this.validateConfig(config);

      // 验证输入
      this.validateRequest(request, config);

      // 调用视觉识别API
      const result = await this.callVisionAPI(request, config);

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: result,
        usage: {
          duration,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      if (error instanceof MultimodalAIError) {
        return {
          success: false,
          error: error.message,
          usage: { duration },
        };
      }

      logger.error('图片识别失败:', error);
      return {
        success: false,
        error: '图片识别服务暂时不可用',
        usage: { duration },
      };
    }
  }

  /**
   * 测试视觉识别服务连接
   */
  async testConnection(config?: Partial<VisionRecognitionConfig>): Promise<boolean> {
    try {
      const visionConfig = config
        ? { ...await multimodalAIConfigService.getVisionConfig(), ...config }
        : await multimodalAIConfigService.getVisionConfig();

      if (!visionConfig.enabled || !visionConfig.apiKey) {
        return false;
      }

      // 使用提供商管理器测试连接
      return await this.providerManager.testProviderConnection(visionConfig);
    } catch (error) {
      logger.error('测试视觉识别连接失败:', error);
      return false;
    }
  }

  /**
   * 调用视觉识别API进行图片识别
   */
  private async callVisionAPI(
    request: VisionRecognitionRequest,
    config: VisionRecognitionConfig
  ): Promise<VisionRecognitionResponse> {
    try {
      // 使用提供商管理器进行识别
      return await this.providerManager.recognizeImage(request, config);
    } catch (error) {
      // 如果是已知的多模态AI错误，直接抛出
      if (error instanceof MultimodalAIError) {
        throw error;
      }

      // 其他错误转换为多模态AI错误
      logger.error('视觉识别API调用失败:', error);
      throw new MultimodalAIError(
        MultimodalAIErrorType.API_ERROR,
        `视觉识别失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }



  /**
   * 验证配置
   */
  private validateConfig(config: VisionRecognitionConfig): void {
    if (!config.apiKey) {
      throw new MultimodalAIError(
        MultimodalAIErrorType.INVALID_CONFIG,
        '视觉识别API密钥未配置'
      );
    }

    if (!config.baseUrl) {
      throw new MultimodalAIError(
        MultimodalAIErrorType.INVALID_CONFIG,
        '视觉识别API地址未配置'
      );
    }

    if (!config.model) {
      throw new MultimodalAIError(
        MultimodalAIErrorType.INVALID_CONFIG,
        '视觉识别模型未配置'
      );
    }
  }

  /**
   * 验证请求
   */
  private validateRequest(request: VisionRecognitionRequest, config: VisionRecognitionConfig): void {
    // 检查是否提供了图片数据
    if (!request.imageFile && !request.imageUrl && !request.imageBase64) {
      throw new MultimodalAIError(
        MultimodalAIErrorType.PROCESSING_ERROR,
        '未提供图片数据'
      );
    }

    // 验证文件（如果是文件上传）
    if (request.imageFile) {
      this.validateImageFile(request.imageFile, config);
    }
  }

  /**
   * 验证图片文件
   */
  private validateImageFile(file: Express.Multer.File, config: VisionRecognitionConfig): void {
    // 检查文件大小
    if (file.size > config.maxFileSize) {
      throw new MultimodalAIError(
        MultimodalAIErrorType.FILE_TOO_LARGE,
        `图片文件大小超过限制 (${config.maxFileSize} 字节)`
      );
    }

    // 检查文件格式
    const fileExtension = this.getFileExtension(file.originalname);
    if (!config.allowedFormats.includes(fileExtension)) {
      throw new MultimodalAIError(
        MultimodalAIErrorType.UNSUPPORTED_FORMAT,
        `不支持的图片格式: ${fileExtension}。支持的格式: ${config.allowedFormats.join(', ')}`
      );
    }

    // 检查MIME类型
    if (!file.mimetype.startsWith('image/')) {
      throw new MultimodalAIError(
        MultimodalAIErrorType.UNSUPPORTED_FORMAT,
        '文件不是有效的图片格式'
      );
    }
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
  }

  /**
   * 获取支持的图片格式
   */
  async getSupportedFormats(): Promise<string[]> {
    const config = await multimodalAIConfigService.getVisionConfig();
    return config.allowedFormats;
  }

  /**
   * 获取最大文件大小
   */
  async getMaxFileSize(): Promise<number> {
    const config = await multimodalAIConfigService.getVisionConfig();
    return config.maxFileSize;
  }
}
