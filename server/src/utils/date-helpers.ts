/**
 * 日期处理工具函数
 * 用于统一处理预算日期边界问题
 */

/**
 * 获取本地日期字符串 (YYYY-MM-DD)
 * 修复 toISOString() 返回UTC日期导致的时区偏差问题
 *
 * @param date 日期（默认当前时间）
 * @returns 本地日期字符串，格式 YYYY-MM-DD
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 获取一天的结束时间（23:59:59.999）
 * 用于预算查询时包含当天的所有交易
 * 
 * @param date 日期
 * @returns 当天的23:59:59.999
 */
export function endOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23, 59, 59, 999
  );
}

/**
 * 获取一天的开始时间（00:00:00.000）
 * 
 * @param date 日期
 * @returns 当天的00:00:00.000
 */
export function startOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0, 0, 0, 0
  );
}

/**
 * 获取预算的日期查询范围
 * 确保包含开始日期和结束日期的所有时间
 * 
 * @param startDate 开始日期
 * @param endDate 结束日期
 * @returns Prisma日期查询条件
 */
export function getBudgetDateRange(startDate: Date, endDate: Date) {
  return {
    gte: startOfDay(startDate),
    lte: endOfDay(endDate),
  };
}
