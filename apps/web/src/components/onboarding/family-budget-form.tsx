'use client';

import { useState, useEffect, useMemo } from 'react';
import { BudgetApiService } from '@/api/budget-api';
import { FamilyApiService } from '@/api/family-api';
import { toast } from 'sonner';
import styles from './family-budget-form.module.css';

interface FamilyMember {
  id: string;
  name: string;
  role: 'admin' | 'member';
  isRegistered: boolean;
  isCustodial: boolean;
  userId?: string;
  isCurrentUser?: boolean;
}

interface FamilyBudgetFormProps {
  accountBookId: string;
  familyId: string;
  onBudgetsUpdated: (budgets: Record<string, number>) => void;
  onLoading: (loading: boolean) => void;
}

export function FamilyBudgetForm({
  accountBookId,
  familyId,
  onBudgetsUpdated,
  onLoading,
}: FamilyBudgetFormProps) {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [memberBudgets, setMemberBudgets] = useState<Record<string, number>>({});
  const [currentBudgets, setCurrentBudgets] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<'ADMIN' | 'MEMBER' | null>(null);
  const [currentUser, setCurrentUser] = useState<FamilyMember | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  // 当 familyId 或 accountBookId 改变时重置初始化状态
  useEffect(() => {
    console.log('🔄 [FamilyBudgetForm] Props changed, resetting initialization state');
    setHasInitialized(false);
    setFamilyMembers([]);
    setMemberBudgets({});
    setCurrentBudgets([]);
    setUserRole(null);
    setCurrentUser(null);
    setIsLoading(false);
  }, [familyId, accountBookId]);

  // 获取家庭成员和现有预算
  useEffect(() => {
    console.log('🔄 [FamilyBudgetForm] useEffect triggered with:', {
      hasInitialized,
      familyId,
      accountBookId,
      shouldRun: !hasInitialized && familyId && accountBookId,
    });

    // 防止重复初始化
    if (hasInitialized || !familyId || !accountBookId) {
      console.log('⏭️ [FamilyBudgetForm] Skipping fetchData due to conditions:', {
        hasInitialized,
        familyId: !!familyId,
        accountBookId: !!accountBookId,
      });
      return;
    }

    const fetchData = async () => {
      try {
        setIsLoading(true);
        onLoading(true);

        console.log(
          '💰 [FamilyBudgetForm] Fetching data for accountBookId:',
          accountBookId,
          'familyId:',
          familyId,
        );

        // 1. 获取家庭信息，确定所有家庭成员
        console.log('👥 [FamilyBudgetForm] Fetching family data for familyId:', familyId);
        const familyData = await FamilyApiService.getFamilyById(familyId);
        console.log('👥 [FamilyBudgetForm] Family data:', familyData);

        if (!familyData || !familyData.members) {
          throw new Error('无法获取家庭成员信息');
        }

        // 2. 获取该账本下的所有个人预算（budgetType = PERSONAL）
        const budgets = await BudgetApiService.getBudgets({
          accountBookId,
          budgetType: 'PERSONAL',
        });
        setCurrentBudgets(budgets);
        console.log('💰 [FamilyBudgetForm] Personal budgets for account book:', budgets);

        // 3. 为每个家庭成员构建成员信息和预算映射
        const memberBudgetMap: Record<string, number> = {};
        const processedMembers: any[] = [];

        // 处理注册用户（从家庭成员中获取）
        familyData.members.forEach((familyMember: any) => {
          if (familyMember.userId) {
            // 查找该用户在当前账本下的最新个人预算
            const userBudgets = budgets.filter(
              (budget: any) => budget.userId === familyMember.userId && !budget.categoryId,
            );

            // 选择最新的预算记录
            let latestBudget: typeof budgets[0] | null = null;
            if (userBudgets.length > 0) {
              latestBudget = userBudgets.reduce((latest, current) => {
                return new Date(current.startDate) > new Date(latest.startDate) ? current : latest;
              });
            }

            const memberId = `user_${familyMember.userId}`;
            const memberInfo = {
              id: memberId,
              userId: familyMember.userId,
              name:
                familyMember.name ||
                familyMember.user?.name ||
                `用户${familyMember.userId.slice(-4)}`,
              role: familyMember.role,
              isRegistered: true,
              isCustodial: false,
              isCurrentUser: familyMember.isCurrentUser,
            };

            processedMembers.push(memberInfo);
            memberBudgetMap[memberId] = latestBudget ? latestBudget.amount : 0;

            console.log('👤 [FamilyBudgetForm] Processed registered member:', {
              memberId,
              name: memberInfo.name,
              role: memberInfo.role,
              isCurrentUser: memberInfo.isCurrentUser,
              budgetAmount: memberBudgetMap[memberId],
              latestBudget: latestBudget
                ? {
                    id: latestBudget.id,
                    amount: latestBudget.amount,
                    startDate: latestBudget.startDate,
                  }
                : null,
            });
          }
        });

        // 处理托管成员（从预算记录中获取）
        const custodialBudgets = budgets.filter(
          (budget: any) => budget.familyMemberId && budget.familyMember && !budget.categoryId,
        );

        // 按托管成员ID分组，选择最新的预算
        const custodialBudgetMap = new Map();
        custodialBudgets.forEach((budget: any) => {
          const memberId = budget.familyMemberId;
          if (
            !custodialBudgetMap.has(memberId) ||
            new Date(budget.startDate) > new Date(custodialBudgetMap.get(memberId).startDate)
          ) {
            custodialBudgetMap.set(memberId, budget);
          }
        });

        // 添加托管成员到处理列表
        custodialBudgetMap.forEach((budget: any) => {
          const memberInfo = {
            id: budget.familyMemberId,
            name: budget.familyMember.name,
            role: 'member',
            isRegistered: false,
            isCustodial: true,
            isCurrentUser: false,
          };

          processedMembers.push(memberInfo);
          memberBudgetMap[budget.familyMemberId] = budget.amount;

          console.log('👶 [FamilyBudgetForm] Processed custodial member:', {
            memberId: budget.familyMemberId,
            name: memberInfo.name,
            budgetAmount: budget.amount,
            budget: {
              id: budget.id,
              amount: budget.amount,
              startDate: budget.startDate,
            },
          });
        });

        console.log('👥 [FamilyBudgetForm] All processed members:', processedMembers);
        setFamilyMembers(processedMembers);

        // 找到当前用户并设置角色
        const currentUserMember = processedMembers.find((member: any) => member.isCurrentUser);
        if (currentUserMember) {
          setUserRole(currentUserMember.role === 'ADMIN' ? 'ADMIN' : 'MEMBER');
          setCurrentUser(currentUserMember);
          console.log(
            '👤 [FamilyBudgetForm] Current user role:',
            currentUserMember.role,
            'Setting userRole to:',
            currentUserMember.role === 'ADMIN' ? 'ADMIN' : 'MEMBER',
          );
        }

        setMemberBudgets(memberBudgetMap);
        // 初始化完成后通知父组件
        onBudgetsUpdated(memberBudgetMap);
        setHasInitialized(true);
        console.log('💰 [FamilyBudgetForm] Initialized member budgets:', memberBudgetMap);
      } catch (error) {
        console.error('❌ [FamilyBudgetForm] Failed to fetch data:', error);
        console.error('❌ [FamilyBudgetForm] Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          accountBookId,
          familyId,
        });
        toast.error('获取家庭数据失败');
      } finally {
        setIsLoading(false);
        onLoading(false);
      }
    };

    fetchData();
    // 移除 onBudgetsUpdated 和 onLoading 从依赖项，避免无限循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId, accountBookId, hasInitialized]);

  // 处理预算金额变化
  const handleBudgetChange = (memberId: string, value: string) => {
    const amount = parseInt(value) || 0;
    const newBudgets = {
      ...memberBudgets,
      [memberId]: amount,
    };
    setMemberBudgets(newBudgets);
    onBudgetsUpdated(newBudgets);
  };

  // 批量设置预算
  const handleBatchSetBudget = (amount: number) => {
    const newBudgets: Record<string, number> = { ...memberBudgets };

    if (userRole === 'ADMIN') {
      // 管理员可以为所有成员设置
      familyMembers.forEach((member) => {
        newBudgets[member.id] = amount;
      });
    } else if (currentUser) {
      // 普通成员只能为自己设置
      newBudgets[currentUser.id] = amount;
    }

    setMemberBudgets(newBudgets);
    onBudgetsUpdated(newBudgets);
  };

  // 获取可编辑的成员列表
  const editableMembers = useMemo(() => {
    console.log('🔍 [FamilyBudgetForm] getEditableMembers called with:', {
      userRole,
      familyMembersLength: familyMembers.length,
      familyMembers: familyMembers.map((m) => ({
        id: m.id,
        name: m.name,
        role: m.role,
        isCustodial: m.isCustodial,
        isCurrentUser: m.isCurrentUser,
      })),
      currentUser: currentUser
        ? {
            id: currentUser.id,
            name: currentUser.name,
            role: currentUser.role,
          }
        : null,
    });

    if (userRole === 'ADMIN') {
      console.log(
        '🔍 [FamilyBudgetForm] Admin user, returning all family members:',
        familyMembers.length,
      );
      return familyMembers;
    } else if (currentUser) {
      console.log('🔍 [FamilyBudgetForm] Regular user, returning only current user');
      return [currentUser];
    }
    console.log('🔍 [FamilyBudgetForm] No role or user, returning empty array');
    return [];
  }, [userRole, familyMembers, currentUser]);
  console.log(
    '🔍 [FamilyBudgetForm] Final editable members:',
    editableMembers.length,
    editableMembers,
  );

  if (isLoading) {
    return (
      <div className={styles['family-budget-loading']}>
        <div className={styles['loading-spinner']}></div>
        <span>加载家庭预算数据中...</span>
      </div>
    );
  }

  return (
    <div className={styles['family-budget-form']}>
      <div className={styles['family-budget-header']}>
        <h4 className={styles['family-budget-title']}>
          {userRole === 'ADMIN' ? '设置家庭成员预算' : '设置您的个人预算'}
        </h4>
        <div className={styles['family-budget-description']}>
          {userRole === 'ADMIN'
            ? '作为管理员，您可以为每位家庭成员设置月度预算金额'
            : '设置您的月度预算金额'}
        </div>
      </div>

      {/* 批量设置工具 */}
      {userRole === 'ADMIN' && familyMembers.length > 1 && (
        <div className={styles['batch-budget-section']}>
          <div className={styles['batch-budget-title']}>快速批量设置</div>
          <div className={styles['batch-budget-buttons']}>
            {[1000, 2000, 3000, 5000].map((amount) => (
              <button
                key={amount}
                className={styles['batch-budget-button']}
                onClick={() => handleBatchSetBudget(amount)}
              >
                全部设为 ¥{amount}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 成员预算设置 */}
      <div className={styles['member-budgets-section']}>
        {editableMembers.map((member) => {
          // 查找该成员的现有预算信息
          let existingBudget;
          if (member.isCustodial) {
            // 托管成员：通过 familyMemberId 查找
            existingBudget = currentBudgets.find(
              (budget) => budget.familyMemberId === member.id && !budget.categoryId,
            );
          } else if (member.userId) {
            // 注册用户：通过 userId 查找
            existingBudget = currentBudgets.find(
              (budget) => budget.userId === member.userId && !budget.categoryId,
            );
          }

          return (
            <div key={member.id} className={styles['member-budget-item']}>
              <div className={styles['member-info']}>
                <div className={styles['member-name']}>
                  {member.name}
                  {member.isCurrentUser && (
                    <span className={styles['current-user-badge']}>（您）</span>
                  )}
                </div>
                <div className={styles['member-details']}>
                  <span className={styles['member-role']}>
                    {member.role === 'admin' ? '管理员' : '成员'}
                  </span>
                  {member.isCustodial && <span className={styles['member-type']}>托管成员</span>}
                  {!member.isRegistered && <span className={styles['member-status']}>未注册</span>}
                </div>
              </div>

              <div className={styles['budget-input-section']}>
                <div className={styles['budget-input-group']}>
                  <span className={styles['budget-currency']}>¥</span>
                  <input
                    type="number"
                    className={styles['budget-input']}
                    placeholder="3000"
                    value={memberBudgets[member.id] || ''}
                    onChange={(e) => handleBudgetChange(member.id, e.target.value)}
                    min="0"
                    step="100"
                  />
                </div>

                {existingBudget && (
                  <div className={styles['budget-status']}>
                    <span className={styles['current-budget']}>
                      当前预算：¥{existingBudget.amount}
                    </span>
                    {existingBudget.spent !== undefined && (
                      <span className={styles['budget-spent']}>
                        已使用：¥{existingBudget.spent}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 预算汇总 */}
      <div className={styles['budget-summary']}>
        <div className={styles['summary-title']}>预算汇总</div>
        <div className={styles['summary-content']}>
          <div className={styles['summary-item']}>
            <span className={styles['summary-label']}>设置成员数：</span>
            <span className={styles['summary-value']}>
              {Object.values(memberBudgets).filter((amount) => amount > 0).length} /{' '}
              {editableMembers.length}
            </span>
          </div>
          <div className={styles['summary-item']}>
            <span className={styles['summary-label']}>总预算金额：</span>
            <span className={styles['summary-value']}>
              ¥{Object.values(memberBudgets).reduce((sum, amount) => sum + amount, 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
