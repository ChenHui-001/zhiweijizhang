/**
 * React Query 缓存操作工具
 *
 * 用于全局操作 React Query 缓存，特别是在记账操作后刷新相关数据
 */

import { queryClient } from '@/app/providers';
import { DASHBOARD_KEYS } from '@/hooks/queries/useDashboardQueries';

/**
 * 刷新指定账本的所有仪表盘相关缓存
 * @param accountBookId 账本ID
 */
export function refreshDashboardCache(accountBookId: string) {
  console.log('🔄 [QueryCache] 刷新仪表盘缓存:', accountBookId);

  // 使相关的查询缓存失效，触发重新获取
  queryClient.invalidateQueries({
    queryKey: DASHBOARD_KEYS.all,
  });

  // 也可以选择性地只刷新特定账本的数据
  queryClient.invalidateQueries({
    queryKey: DASHBOARD_KEYS.monthlyStats(accountBookId),
  });

  queryClient.invalidateQueries({
    queryKey: DASHBOARD_KEYS.budgetStats(accountBookId),
  });

  queryClient.invalidateQueries({
    queryKey: DASHBOARD_KEYS.transactions(accountBookId),
  });

  console.log('🔄 [QueryCache] 仪表盘缓存刷新完成');
}

/**
 * 预加载指定账本的仪表盘数据
 * @param accountBookId 账本ID
 */
export function prefetchDashboardData(accountBookId: string) {
  console.log('🚀 [QueryCache] 预加载仪表盘数据:', accountBookId);

  // 预加载月度统计
  queryClient.prefetchQuery({
    queryKey: DASHBOARD_KEYS.monthlyStats(accountBookId),
    staleTime: 0, // 强制重新获取
  });

  // 预加载预算统计
  queryClient.prefetchQuery({
    queryKey: DASHBOARD_KEYS.budgetStats(accountBookId),
    staleTime: 0, // 强制重新获取
  });

  // 预加载交易记录
  queryClient.prefetchInfiniteQuery({
    queryKey: DASHBOARD_KEYS.transactions(accountBookId),
    initialPageParam: 1,
    staleTime: 0, // 强制重新获取
  });
}

/**
 * 清除指定账本的所有缓存
 * @param accountBookId 账本ID
 */
export function clearDashboardCache(accountBookId: string) {
  console.log('🗑️ [QueryCache] 清除仪表盘缓存:', accountBookId);

  queryClient.removeQueries({
    queryKey: DASHBOARD_KEYS.all,
  });
}

// 向后兼容：支持原有的 triggerTransactionChange 接口
export const triggerTransactionChange = refreshDashboardCache;