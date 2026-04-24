import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';
import { S3StorageService, S3Config } from './s3-storage.service';
import {
  CreateFileStorageDto,
  UpdateFileStorageDto,
  FileStorageQueryParams,
  FileStorageResponseDto,
  FileUploadRequestDto,
  FileUploadResponseDto,
  PresignedUrlRequestDto,
  PresignedUrlResponseDto,
  FileStorageConfigDto,
  toFileStorageResponseDto,
  BUCKET_CONFIG,
  FILE_SIZE_LIMITS,
  ALL_ALLOWED_TYPES,
  FileStorageType,
  FileStatus,
} from '../models/file-storage.model';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const prisma = new PrismaClient();

export class FileStorageService {
  private static instance: FileStorageService | null = null;
  private s3Service: S3StorageService | null = null;
  private config: FileStorageConfigDto | null = null;

  private constructor() {
    this.initializeStorage();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): FileStorageService {
    if (!FileStorageService.instance) {
      FileStorageService.instance = new FileStorageService();
    }
    return FileStorageService.instance;
  }

  /**
   * 初始化存储服务
   */
  private async initializeStorage(): Promise<void> {
    try {
      // 重置s3Service
      this.s3Service = null;
      this.config = await this.getStorageConfig();

      logger.info('🔄 重新初始化存储服务，配置:', {
        enabled: this.config.enabled,
        endpoint: this.config.endpoint,
        accessKeyId: this.config.accessKeyId ? `${this.config.accessKeyId.substring(0, 4)}...` : 'null',
      });

      if (this.config.enabled && this.config.storageType === FileStorageType.S3) {
        // 检查必要的配置是否存在
        if (!this.config.endpoint || !this.config.accessKeyId || !this.config.secretAccessKey) {
          logger.warn('S3存储已启用但配置不完整，跳过初始化');
          return;
        }

        // 根据端点自动判断是否需要forcePathStyle
        const needsPathStyle = this.shouldUsePathStyle(this.config.endpoint);

        const s3Config: S3Config = {
          endpoint: this.config.endpoint,
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
          region: this.config.region || 'us-east-1',
          forcePathStyle: needsPathStyle,
        };

        logger.info('🔧 S3配置详情:', {
          endpoint: s3Config.endpoint,
          region: s3Config.region,
          forcePathStyle: s3Config.forcePathStyle,
        });

        this.s3Service = new S3StorageService(s3Config);

        // 确保所有必要的存储桶存在
        await this.ensureBucketsExist();
        logger.info('✅ S3存储服务初始化成功');
      } else {
        logger.info('⚠️ S3存储未启用，跳过初始化');
      }
    } catch (error) {
      logger.error('❌ 存储服务初始化失败:', error);
      this.s3Service = null; // 确保在失败时重置服务
    }
  }

  /**
   * 检查存储服务是否可用
   */
  isStorageAvailable(): boolean {
    return this.s3Service !== null;
  }

  /**
   * 获取S3服务实例
   */
  getS3Service(): S3StorageService | null {
    return this.s3Service;
  }

  /**
   * 重新加载存储配置
   */
  async reloadConfig(): Promise<void> {
    logger.info('重新加载存储配置...');
    await this.initializeStorage();
  }

  /**
   * 根据端点判断是否需要使用路径样式
   */
  private shouldUsePathStyle(endpoint: string): boolean {
    if (!endpoint) return true;

    const lowerEndpoint = endpoint.toLowerCase();

    // MinIO和本地服务需要路径样式
    if (lowerEndpoint.includes('minio') ||
      lowerEndpoint.includes('localhost') ||
      lowerEndpoint.includes('127.0.0.1') ||
      lowerEndpoint.includes('192.168.') ||
      lowerEndpoint.includes('10.0.') ||
      lowerEndpoint.includes('172.16.') ||
      lowerEndpoint.includes('172.17.') ||
      lowerEndpoint.includes('172.18.') ||
      lowerEndpoint.includes('172.19.') ||
      lowerEndpoint.includes('172.2') ||
      lowerEndpoint.includes('172.30.') ||
      lowerEndpoint.includes('172.31.')) {
      logger.info('🔧 检测到MinIO或本地服务，使用路径样式');
      return true;
    }

    // AWS S3官方服务不需要路径样式（除非是特定区域）
    if (lowerEndpoint.includes('amazonaws.com')) {
      logger.info('🔧 检测到AWS S3，使用虚拟主机样式');
      return false;
    }

    // 腾讯云COS不需要路径样式
    if (lowerEndpoint.includes('myqcloud.com')) {
      logger.info('🔧 检测到腾讯云COS，使用虚拟主机样式');
      return false;
    }

    // 阿里云OSS不需要路径样式
    if (lowerEndpoint.includes('aliyuncs.com')) {
      logger.info('🔧 检测到阿里云OSS，使用虚拟主机样式');
      return false;
    }

    // 华为云OBS不需要路径样式
    if (lowerEndpoint.includes('myhuaweicloud.com')) {
      logger.info('🔧 检测到华为云OBS，使用虚拟主机样式');
      return false;
    }

    // 默认情况下，对于未知的服务，使用路径样式（更兼容）
    logger.info('🔧 未知S3服务，默认使用路径样式');
    return true;
  }

  /**
   * 获取存储服务状态
   */
  async getStorageStatus(): Promise<{ enabled: boolean; configured: boolean; healthy: boolean; message: string }> {
    logger.info('🔍 检查存储服务状态...');

    if (!this.config) {
      logger.info('❌ 存储配置未加载');
      return {
        enabled: false,
        configured: false,
        healthy: false,
        message: '存储配置未加载',
      };
    }

    logger.info('📋 当前存储配置:', {
      enabled: this.config.enabled,
      endpoint: this.config.endpoint,
      accessKeyId: this.config.accessKeyId ? `${this.config.accessKeyId.substring(0, 4)}...` : 'null',
    });

    if (!this.config.enabled) {
      logger.info('⚠️ S3存储未启用');
      return {
        enabled: false,
        configured: false,
        healthy: false,
        message: 'S3存储未启用',
      };
    }

    if (!this.s3Service) {
      logger.info('❌ S3服务实例不存在，配置可能不完整');
      return {
        enabled: true,
        configured: false,
        healthy: false,
        message: 'S3存储配置不完整',
      };
    }

    // 测试连接健康状态
    try {
      logger.info('🔗 测试S3连接...');
      const isHealthy = await this.s3Service.testConnection();
      const status = {
        enabled: true,
        configured: true,
        healthy: isHealthy,
        message: isHealthy ? 'S3存储服务正常' : 'S3存储连接异常',
      };
      logger.info('📊 存储状态检查结果:', status);
      return status;
    } catch (error) {
      logger.error('❌ S3连接测试失败:', error);
      return {
        enabled: true,
        configured: true,
        healthy: false,
        message: `S3存储连接失败: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  /**
   * 上传文件
   */
  async uploadFile(
    file: Express.Multer.File,
    uploadRequest: FileUploadRequestDto,
    uploadedBy: string,
  ): Promise<FileUploadResponseDto> {
    if (!this.s3Service) {
      throw new Error('文件存储服务未启用，请联系管理员配置S3存储');
    }

    // 验证文件
    this.validateFile(file, uploadRequest.bucket);

    // 生成文件键
    const key = this.s3Service.generateKeyWithPath(
      uploadRequest.category || 'general',
      file.originalname,
    );

    // 确保文件名正确编码（处理中文字符）
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

    // 确定压缩策略
    let compressionStrategy: 'avatar' | 'attachment' | 'multimodal' | 'general' = 'general';
    if (uploadRequest.bucket === BUCKET_CONFIG.AVATARS) {
      compressionStrategy = 'avatar';
    } else if (uploadRequest.bucket === BUCKET_CONFIG.ATTACHMENTS) {
      compressionStrategy = 'attachment';
    } else if (uploadRequest.category === 'multimodal' || uploadRequest.category === 'ai-recognition') {
      compressionStrategy = 'multimodal';
    }

    // 上传到S3（带压缩）
    const uploadResult = await this.s3Service.uploadFile(file.buffer, {
      bucket: uploadRequest.bucket,
      key,
      contentType: file.mimetype,
      compressionStrategy,
      enableCompression: true,
      userId: uploadedBy,
      metadata: {
        originalName: originalName,
        uploadedBy,
        category: uploadRequest.category || 'general',
        ...uploadRequest.metadata,
      },
    });

    // 保存到数据库
    const fileStorage = await prisma.fileStorage.create({
      data: {
        filename: path.basename(key),
        originalName: originalName,
        mimeType: file.mimetype,
        size: file.size,
        bucket: uploadRequest.bucket,
        key,
        url: uploadResult.url,
        storageType: FileStorageType.S3,
        uploadedBy,
        expiresAt: uploadRequest.expiresIn
          ? new Date(Date.now() + uploadRequest.expiresIn * 1000)
          : undefined,
        metadata: uploadRequest.metadata,
      },
    });

    return {
      fileId: fileStorage.id,
      filename: fileStorage.filename,
      originalName: fileStorage.originalName,
      url: fileStorage.url || uploadResult.url,
      size: fileStorage.size,
      mimeType: fileStorage.mimeType,
    };
  }

  /**
   * 获取文件信息
   */
  async getFileById(fileId: string): Promise<FileStorageResponseDto | null> {
    const fileStorage = await prisma.fileStorage.findUnique({
      where: { id: fileId },
    });

    return fileStorage ? toFileStorageResponseDto(fileStorage) : null;
  }

  /**
   * 获取文件信息（带权限验证）
   */
  async getFileInfo(fileId: string, userId: string): Promise<FileStorageResponseDto | null> {
    const fileStorage = await prisma.fileStorage.findUnique({
      where: {
        id: fileId,
        uploadedBy: userId,
        status: FileStatus.ACTIVE,
      },
    });

    return fileStorage ? toFileStorageResponseDto(fileStorage) : null;
  }

  /**
   * 获取文件信息（用于下载）
   */
  async getFile(fileId: string, userId: string): Promise<FileStorageResponseDto | null> {
    return this.getFileInfo(fileId, userId);
  }

  /**
   * 获取文件流（用于下载）
   */
  async getFileStream(fileId: string): Promise<NodeJS.ReadableStream> {
    const fileStorage = await prisma.fileStorage.findUnique({
      where: { id: fileId },
    });

    if (!fileStorage) {
      throw new Error('文件不存在');
    }

    if (!this.s3Service) {
      throw new Error('存储服务未初始化');
    }

    // 从S3获取文件流
    return this.s3Service.getFileStream(fileStorage.bucket, fileStorage.key);
  }

  /**
   * 删除文件
   */
  async deleteFile(fileId: string, userId: string): Promise<void> {
    const fileStorage = await prisma.fileStorage.findUnique({
      where: { id: fileId },
    });

    if (!fileStorage) {
      throw new Error('文件不存在');
    }

    if (fileStorage.uploadedBy !== userId) {
      throw new Error('无权限删除此文件');
    }

    // 从S3删除
    if (this.s3Service && fileStorage.storageType === FileStorageType.S3) {
      try {
        await this.s3Service.deleteFile(fileStorage.bucket, fileStorage.key);
      } catch (error) {
        logger.error('Failed to delete file from S3:', error);
        // 继续执行数据库删除，即使S3删除失败
      }
    }

    // 从数据库删除（软删除）
    await prisma.fileStorage.update({
      where: { id: fileId },
      data: { status: FileStatus.DELETED },
    });
  }

  /**
   * 生成预签名URL
   */
  async generatePresignedUrl(request: PresignedUrlRequestDto): Promise<PresignedUrlResponseDto> {
    if (!this.s3Service) {
      throw new Error('存储服务未初始化');
    }

    const expiresIn = request.expiresIn || 3600;
    const url = await this.s3Service.generatePresignedUrl({
      bucket: request.bucket,
      key: request.key,
      operation: request.operation,
      expiresIn,
      contentType: request.contentType,
    });

    return {
      url,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  /**
   * 查询文件列表
   */
  async getFiles(params: FileStorageQueryParams): Promise<{
    files: FileStorageResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      uploadedBy,
      bucket,
      storageType,
      status = FileStatus.ACTIVE,
      mimeType,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: any = {
      status,
      ...(uploadedBy && { uploadedBy }),
      ...(bucket && { bucket }),
      ...(storageType && { storageType }),
      ...(mimeType && { mimeType: { contains: mimeType } }),
    };

    const [files, total] = await Promise.all([
      prisma.fileStorage.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.fileStorage.count({ where }),
    ]);

    return {
      files: files.map(toFileStorageResponseDto),
      total,
      page,
      limit,
    };
  }

  /**
   * 测试存储连接
   */
  async testConnection(): Promise<boolean> {
    if (!this.s3Service) {
      return false;
    }

    return await this.s3Service.testConnection();
  }

  /**
   * 获取存储配置
   * 优先级：环境变量 > 数据库配置
   */
  private async getStorageConfig(): Promise<FileStorageConfigDto> {
    const configs = await prisma.systemConfig.findMany({
      where: {
        category: 'storage',
      },
    });

    const configMap = configs.reduce((acc, config) => {
      if (config.value) {
        acc[config.key] = config.value;
      }
      return acc;
    }, {} as Record<string, string>);

    // 环境变量配置
    const envEnabled = process.env.MINIO_ENABLE === 'true';
    const envEndpoint = process.env.MINIO_ENDPOINT;
    const envPort = process.env.MINIO_PORT;
    const envUseSSL = process.env.MINIO_USE_SSL === 'true';
    const envAccessKey = process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER;
    const envSecretKey = process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD;
    const envBucket = process.env.MINIO_BUCKET;

    // 构建endpoint
    let endpoint = configMap.s3_endpoint;
    if (envEndpoint) {
      const protocol = envUseSSL ? 'https://' : 'http://';
      endpoint = `${protocol}${envEndpoint}:${envPort || '9000'}`;
    }

    // 检查是否启用：环境变量或数据库配置
    const isEnabled = envEnabled || configMap.s3_enabled === 'true';

    return {
      enabled: isEnabled,
      storageType: FileStorageType.S3,
      endpoint: endpoint,
      accessKeyId: envAccessKey || configMap.s3_access_key_id,
      secretAccessKey: envSecretKey || configMap.s3_secret_access_key,
      region: configMap.s3_region || 'us-east-1',
      buckets: {
        avatars: envBucket || configMap.s3_bucket_avatars || BUCKET_CONFIG.AVATARS,
        attachments: envBucket || configMap.s3_bucket_attachments || BUCKET_CONFIG.ATTACHMENTS,
        temp: envBucket || configMap.s3_bucket_temp || BUCKET_CONFIG.TEMP,
        system: envBucket || configMap.s3_bucket_system || BUCKET_CONFIG.SYSTEM,
      },
      maxFileSize: parseInt(configMap.file_max_size || '10485760'),
      allowedTypes: configMap.file_allowed_types?.split(',') || ALL_ALLOWED_TYPES,
    };
  }

  /**
   * 确保存储桶存在
   */
  private async ensureBucketsExist(): Promise<void> {
    if (!this.s3Service || !this.config) {
      return;
    }

    const buckets = Object.values(this.config.buckets);

    for (const bucket of buckets) {
      try {
        await this.s3Service.createBucket(bucket);
      } catch (error) {
        logger.error(`Failed to create bucket ${bucket}:`, error);
      }
    }
  }

  /**
   * 验证文件
   */
  private validateFile(file: Express.Multer.File, bucket: string): void {
    if (!this.config) {
      throw new Error('存储配置未加载');
    }

    // 检查文件大小
    let maxSize = this.config.maxFileSize;
    if (bucket === this.config.buckets.avatars) {
      maxSize = FILE_SIZE_LIMITS.AVATAR;
    } else if (bucket === this.config.buckets.attachments) {
      maxSize = FILE_SIZE_LIMITS.ATTACHMENT;
    }

    if (file.size > maxSize) {
      throw new Error(`文件大小超过限制 (${Math.round(maxSize / 1024 / 1024)}MB)`);
    }

    // 检查文件类型
    if (!this.config.allowedTypes.includes(file.mimetype)) {
      throw new Error(`不支持的文件类型: ${file.mimetype}`);
    }
  }

  /**
   * 清理过期文件
   */
  async cleanupExpiredFiles(): Promise<number> {
    const expiredFiles = await prisma.fileStorage.findMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
        status: FileStatus.ACTIVE,
      },
    });

    let deletedCount = 0;

    for (const file of expiredFiles) {
      try {
        if (this.s3Service && file.storageType === FileStorageType.S3) {
          await this.s3Service.deleteFile(file.bucket, file.key);
        }

        await prisma.fileStorage.update({
          where: { id: file.id },
          data: { status: FileStatus.EXPIRED },
        });

        deletedCount++;
      } catch (error) {
        logger.error(`Failed to cleanup expired file ${file.id}:`, error);
      }
    }

    return deletedCount;
  }
}

/**
 * 获取全局文件存储服务实例
 * @deprecated 使用 FileStorageService.getInstance() 代替
 */
export function getGlobalFileStorageService(): FileStorageService | null {
  return FileStorageService.getInstance();
}

/**
 * 销毁服务实例
 */
export function destroyFileStorageService(): void {
  (FileStorageService as any).instance = null;
}

/**
 * 重新加载全局文件存储服务配置
 */
export async function reloadGlobalFileStorageConfig(): Promise<void> {
  const instance = FileStorageService.getInstance();
  await instance.reloadConfig();
}
