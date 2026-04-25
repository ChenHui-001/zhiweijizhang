import { Request, Response, NextFunction } from 'express';

/**
 * 每日首次访问中间件（已禁用）
 * 会员系统已移除，此中间件不再提供任何功能
 */
export async function dailyFirstVisitGift(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  next();
}
