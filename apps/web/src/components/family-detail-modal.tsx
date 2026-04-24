'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { getApiBaseUrl } from '@/lib/server-config';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AvatarDisplay } from '@/components/ui/avatar-display';
import './family-detail-modal.css';

interface FamilyMember {
  memberId: string;
  userId: string | null;
  username: string;
  avatar: string | null;
  role: 'ADMIN' | 'MEMBER';
  joinedAt: string;
  isCurrentUser: boolean;
  isCustodial?: boolean;
  statistics?: {
    totalExpense: number;
    percentage: number;
    transactionCount: number;
  };
  // 兼容旧的数据结构
  id?: string;
  email?: string;
  name?: string;
  createdAt?: string;
}

interface Family {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  members: FamilyMember[];
  memberCount: number;
  creator?: {
    id: string;
  };
  userPermissions?: {
    canInvite: boolean;
    canRemove: boolean;
    canChangeRoles: boolean;
  };
}

interface StatisticsData {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  memberStats: {
    memberId: string;
    memberName: string;
    totalExpense: number;
    percentage: number;
  }[];
  categoryStats: {
    categoryId: string;
    categoryName: string;
    totalExpense: number;
    percentage: number;
  }[];
}

interface CustodialMember {
  id: string;
  familyId: string;
  userId?: string;
  name: string;
  gender?: string;
  birthDate?: string;
  role: string;
  isRegistered: boolean;
  isCustodial: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FamilyDetailModalProps {
  familyId: string;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (familyId: string) => void;
  onManageMembers?: (familyId: string) => void;
}

export default function FamilyDetailModal({
  familyId,
  isOpen,
  onClose,
  onEdit,
  onManageMembers,
}: FamilyDetailModalProps) {
  const router = useRouter();
  const { token, isAuthenticated, user } = useAuthStore();
  const [family, setFamily] = useState<Family | null>(null);
  const [statistics, setStatistics] = useState<StatisticsData | null>(null);
  const [custodialMembers, setCustodialMembers] = useState<CustodialMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 编辑家庭信息状态
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
  });
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  // 危险操作状态
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // 托管成员管理状态
  const [isAddCustodialDialogOpen, setIsAddCustodialDialogOpen] = useState(false);
  const [isEditCustodialDialogOpen, setIsEditCustodialDialogOpen] = useState(false);
  const [isDeleteCustodialDialogOpen, setIsDeleteCustodialDialogOpen] = useState(false);
  const [selectedCustodialMember, setSelectedCustodialMember] = useState<CustodialMember | null>(
    null,
  );
  const [custodialFormData, setCustodialFormData] = useState({
    name: '',
    gender: '男',
    birthDate: '',
  });
  const [isCustodialSubmitting, setIsCustodialSubmitting] = useState(false);

  // 检查用户是否为管理员
  const isAdmin =
    family?.creator?.id === user?.id ||
    family?.members.some(
      (member) => (member.userId === user?.id || member.isCurrentUser) && member.role === 'ADMIN',
    ) ||
    family?.userPermissions?.canInvite ||
    false;

  // 获取家庭详情
  const fetchFamilyDetail = async () => {
    if (!token || familyId === 'placeholder') {
      setError('无效的家庭ID或未提供认证令牌');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('🔍 开始获取家庭详情数据:', { familyId, token: !!token });

      // 获取API基础URL
      const baseURL = getApiBaseUrl();

      // 并行获取家庭详情、成员统计、家庭统计数据和托管成员
      const [familyResponse, memberStatsResponse, statsResponse, custodialResponse] =
        await Promise.all([
          fetch(`${baseURL}/families/${familyId}`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`${baseURL}/families/${familyId}/members/statistics?period=month`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`${baseURL}/families/${familyId}/statistics?period=month`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`${baseURL}/families/${familyId}/custodial-members`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

      console.log('📊 API响应状态:', {
        family: familyResponse.status,
        memberStats: memberStatsResponse.status,
        stats: statsResponse.status,
        custodial: custodialResponse.status,
      });

      if (familyResponse.ok) {
        const familyData = await familyResponse.json();
        console.log('✅ 家庭详情获取成功:', familyData);

        // 如果成员统计API成功，使用统计数据中的成员信息（包含消费数据）
        if (memberStatsResponse.ok) {
          const memberStatsData = await memberStatsResponse.json();
          // 将详细的成员统计数据合并到家庭数据中
          familyData.members = memberStatsData.members || [];
          familyData.userPermissions = memberStatsData.userPermissions;
          console.log('✅ 成员统计数据获取成功:', memberStatsData);
        } else {
          console.warn('⚠️ 成员统计API失败:', memberStatsResponse.status);
          try {
            const errorData = await memberStatsResponse.json();
            console.warn('成员统计API错误详情:', errorData);
          } catch (e) {
            console.warn('无法解析成员统计API错误响应');
          }
        }

        setFamily(familyData);
        // 初始化编辑表单数据
        setEditFormData({
          name: familyData.name,
          description: familyData.description || '',
        });
      } else {
        console.error('❌ 家庭详情API失败:', familyResponse.status);
        try {
          const errorData = await familyResponse.json();
          console.error('家庭详情API错误详情:', errorData);
          setError(errorData.message || '获取家庭详情失败');
        } catch (e) {
          console.error('无法解析家庭详情API错误响应');
          setError('获取家庭详情失败');
        }
      }

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStatistics(statsData);
        console.log('✅ 家庭统计数据获取成功:', statsData);
      } else {
        console.warn('⚠️ 家庭统计API失败:', statsResponse.status);
        try {
          const errorData = await statsResponse.json();
          console.warn('家庭统计API错误详情:', errorData);
        } catch (e) {
          console.warn('无法解析家庭统计API错误响应');
        }
      }

      if (custodialResponse.ok) {
        const custodialData = await custodialResponse.json();
        setCustodialMembers(custodialData.members || []);
        console.log('✅ 托管成员数据获取成功:', custodialData);
      } else {
        console.warn('⚠️ 托管成员API失败:', custodialResponse.status);
        try {
          const errorData = await custodialResponse.json();
          console.warn('托管成员API错误详情:', errorData);
        } catch (e) {
          console.warn('无法解析托管成员API错误响应');
        }
      }
    } catch (error) {
      console.error('❌ 获取家庭详情失败:', error);
      setError('获取家庭详情失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  // 初始化数据获取
  useEffect(() => {
    if (isOpen && familyId && isAuthenticated) {
      fetchFamilyDetail();
    }
  }, [isOpen, familyId, isAuthenticated, token]);

  // 管理 body 类以防止背景滚动和适配 iOS
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('family-detail-modal-open');
      // 检测 iOS 环境并添加相应类
      if (typeof window !== 'undefined') {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isCapacitor = !!(window as any).Capacitor;
        if (isIOS) {
          document.body.classList.add('ios-app');
        }
        if (isCapacitor) {
          document.body.classList.add('capacitor-ios');
        }
        // iPhone 16 Pro 检测
        if (window.screen.width === 402 && window.screen.height === 874) {
          document.body.classList.add('iphone-16-pro');
        }
      }
    } else {
      document.body.classList.remove('family-detail-modal-open');
    }

    return () => {
      document.body.classList.remove('family-detail-modal-open');
    };
  }, [isOpen]);

  // 隐藏所有可能的顶部工具栏和底部导航栏
  useEffect(() => {
    if (isOpen) {
      // 查找所有可能的头部元素
      const selectors = [
        '.app-container .header',
        '.header',
        '.page-header',
        '.ios-header',
        '.capacitor-header',
        '.top-bar',
        '.navigation-header',
        '.app-header',
        // iOS Capacitor 特定选择器
        '.capacitor-ios .header',
        '.ios-app .header',
        // 可能的状态栏
        '.status-bar',
        '.capacitor-status-bar',
      ];

      const hiddenElements: HTMLElement[] = [];

      // 隐藏所有找到的头部元素
      selectors.forEach((selector) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
          const htmlElement = element as HTMLElement;
          if (htmlElement && htmlElement.style.display !== 'none') {
            htmlElement.style.display = 'none';
            hiddenElements.push(htmlElement);
          }
        });
      });

      // 隐藏底部导航栏
      const bottomNavSelectors = [
        '.bottom-nav',
        '.bottom-navigation',
        '.tab-bar',
        '.capacitor-tab-bar',
      ];

      bottomNavSelectors.forEach((selector) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
          const htmlElement = element as HTMLElement;
          if (htmlElement && htmlElement.style.display !== 'none') {
            htmlElement.style.display = 'none';
            hiddenElements.push(htmlElement);
          }
        });
      });

      // 特殊处理：隐藏 body 上可能的工具栏
      const body = document.body;
      const originalOverflow = body.style.overflow;
      body.style.overflow = 'hidden';

      // iOS Capacitor 特殊处理：隐藏可能的原生工具栏
      if (typeof window !== 'undefined' && (window as any).Capacitor) {
        // 尝试隐藏 Capacitor 的状态栏
        try {
          const { StatusBar } = (window as any).Capacitor.Plugins;
          if (StatusBar) {
            StatusBar.hide();
          }
        } catch (error) {
          console.log('StatusBar plugin not available:', error);
        }
      }

      return () => {
        // 恢复所有隐藏的元素
        hiddenElements.forEach((element) => {
          element.style.display = '';
        });

        // 恢复 body 样式
        body.style.overflow = originalOverflow;

        // 恢复状态栏
        if (typeof window !== 'undefined' && (window as any).Capacitor) {
          try {
            const { StatusBar } = (window as any).Capacitor.Plugins;
            if (StatusBar) {
              StatusBar.show();
            }
          } catch (error) {
            console.log('StatusBar plugin not available:', error);
          }
        }
      };
    }
  }, [isOpen]);

  // 确保头部组件始终可见
  useEffect(() => {
    if (isOpen) {
      // 延迟确保DOM已渲染
      const timer = setTimeout(() => {
        const header = document.querySelector('.family-detail-modal-header') as HTMLElement;
        if (header) {
          console.log('🔍 检查头部组件状态:', {
            display: header.style.display,
            visibility: header.style.visibility,
            opacity: header.style.opacity,
            zIndex: header.style.zIndex,
            position: header.style.position,
            height: header.style.height,
            offsetHeight: header.offsetHeight,
            clientHeight: header.clientHeight,
          });

          // 强制确保头部可见
          header.style.display = 'flex';
          header.style.visibility = 'visible';
          header.style.opacity = '1';
          header.style.zIndex = '100001';
          header.style.position = 'sticky';
          header.style.top = '0';
          header.style.height = '64px';
          header.style.minHeight = '64px';
          header.style.maxHeight = '64px';
          header.style.flexShrink = '0';
          header.style.width = '100%';
          header.style.backgroundColor = 'var(--background-color)';
          header.style.borderBottom = '1px solid var(--border-color)';
          header.style.justifyContent = 'space-between';
          header.style.alignItems = 'center';
          header.style.padding = '0 16px';
          header.style.boxSizing = 'border-box';

          console.log('✅ 头部组件样式已强制设置');
        } else {
          console.error('❌ 未找到头部组件');
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isOpen, isLoading]);

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // 格式化金额
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // 获取成员头像文本（取名字的第一个字）
  const getAvatarText = (name: string) => {
    return name && name.length > 0 ? name.charAt(0).toUpperCase() : '?';
  };

  // 计算年龄（与动态页面保持一致的逻辑）
  const calculateAge = (birthDate: string) => {
    if (!birthDate) return '';
    try {
      const birth = new Date(birthDate);
      const today = new Date();

      // 计算年龄
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }

      // 如果年龄小于1岁，显示月份
      if (age < 1) {
        let months = today.getMonth() - birth.getMonth();
        if (today.getDate() < birth.getDate()) {
          months--;
        }
        if (months < 0) {
          months += 12;
        }
        return months === 0 ? '新生儿' : `${months}个月`;
      }

      return `${age}岁`;
    } catch (error) {
      console.error('年龄计算失败:', birthDate, error);
      return '';
    }
  };

  // 处理编辑家庭信息
  const handleEditFamily = () => {
    if (family) {
      setEditFormData({
        name: family.name,
        description: family.description || '',
      });
      setIsEditDialogOpen(true);
    }
  };

  // 处理保存编辑
  const handleSaveEdit = async () => {
    if (!editFormData.name.trim()) {
      toast.error('家庭名称不能为空');
      return;
    }

    if (!token) {
      toast.error('未提供认证令牌');
      return;
    }

    setIsEditSubmitting(true);
    try {
      const baseURL = getApiBaseUrl();
      const response = await fetch(`${baseURL}/families/${familyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editFormData.name.trim(),
          description: editFormData.description.trim() || undefined,
        }),
      });

      if (response.ok) {
        const updatedFamily = await response.json();
        setFamily(updatedFamily);
        setIsEditDialogOpen(false);
        toast.success('家庭信息更新成功');
      } else {
        const error = await response.json();
        toast.error(error.message || '更新家庭信息失败');
      }
    } catch (error) {
      console.error('更新家庭信息失败:', error);
      toast.error('更新家庭信息失败');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  // 处理退出家庭
  const handleLeaveFamily = async () => {
    if (!token) {
      toast.error('未提供认证令牌');
      return;
    }

    setIsProcessing(true);
    try {
      const baseURL = getApiBaseUrl();
      const response = await fetch(`${baseURL}/families/${familyId}/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast.success('已退出家庭');
        setIsLeaveDialogOpen(false);
        onClose();
        router.push('/families');
      } else {
        const error = await response.json();
        toast.error(error.message || '退出家庭失败');
      }
    } catch (error) {
      console.error('退出家庭失败:', error);
      toast.error('退出家庭失败');
    } finally {
      setIsProcessing(false);
    }
  };

  // 处理解散家庭
  const handleDeleteFamily = async () => {
    if (!token) {
      toast.error('未提供认证令牌');
      return;
    }

    setIsProcessing(true);
    try {
      const baseURL = getApiBaseUrl();
      const response = await fetch(`${baseURL}/families/${familyId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast.success('家庭已解散');
        setIsDeleteDialogOpen(false);
        onClose();
        router.push('/families');
      } else {
        const error = await response.json();
        toast.error(error.message || '解散家庭失败');
      }
    } catch (error) {
      console.error('解散家庭失败:', error);
      toast.error('解散家庭失败');
    } finally {
      setIsProcessing(false);
    }
  };

  // 重置托管成员表单
  const resetCustodialForm = () => {
    setCustodialFormData({
      name: '',
      gender: '男',
      birthDate: '',
    });
  };

  // 处理添加托管成员
  const handleAddCustodialMember = async () => {
    if (!custodialFormData.name.trim()) {
      toast.error('姓名不能为空');
      return;
    }

    if (!token) {
      toast.error('未提供认证令牌');
      return;
    }

    setIsCustodialSubmitting(true);
    try {
      const baseURL = getApiBaseUrl();
      const response = await fetch(`${baseURL}/families/${familyId}/custodial-members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: custodialFormData.name.trim(),
          gender: custodialFormData.gender,
          birthDate: custodialFormData.birthDate || undefined,
        }),
      });

      if (response.ok) {
        const newMember = await response.json();
        setCustodialMembers((prev) => [...prev, newMember]);
        setIsAddCustodialDialogOpen(false);
        resetCustodialForm();
        toast.success('托管成员添加成功');
      } else {
        const error = await response.json();
        toast.error(error.message || '添加托管成员失败');
      }
    } catch (error) {
      console.error('添加托管成员失败:', error);
      toast.error('添加托管成员失败');
    } finally {
      setIsCustodialSubmitting(false);
    }
  };

  // 处理编辑托管成员
  const handleEditCustodialMember = (member: CustodialMember) => {
    setSelectedCustodialMember(member);
    setCustodialFormData({
      name: member.name,
      gender: member.gender || '男',
      birthDate: member.birthDate || '',
    });
    setIsEditCustodialDialogOpen(true);
  };

  // 处理更新托管成员
  const handleUpdateCustodialMember = async () => {
    if (!custodialFormData.name.trim()) {
      toast.error('姓名不能为空');
      return;
    }

    if (!selectedCustodialMember || !token) {
      toast.error('未提供认证令牌或选择的成员');
      return;
    }

    setIsCustodialSubmitting(true);
    try {
      const baseURL = getApiBaseUrl();
      const response = await fetch(
        `${baseURL}/families/${familyId}/custodial-members/${selectedCustodialMember.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: custodialFormData.name.trim(),
            gender: custodialFormData.gender,
            birthDate: custodialFormData.birthDate || undefined,
          }),
        },
      );

      if (response.ok) {
        const updatedMember = await response.json();
        setCustodialMembers((prev) =>
          prev.map((member) => (member.id === selectedCustodialMember.id ? updatedMember : member)),
        );
        setIsEditCustodialDialogOpen(false);
        setSelectedCustodialMember(null);
        resetCustodialForm();
        toast.success('托管成员更新成功');
      } else {
        const error = await response.json();
        toast.error(error.message || '更新托管成员失败');
      }
    } catch (error) {
      console.error('更新托管成员失败:', error);
      toast.error('更新托管成员失败');
    } finally {
      setIsCustodialSubmitting(false);
    }
  };

  // 处理删除托管成员
  const handleDeleteCustodialMember = async () => {
    if (!selectedCustodialMember || !token) {
      toast.error('未提供认证令牌或选择的成员');
      return;
    }

    setIsCustodialSubmitting(true);
    try {
      const baseURL = getApiBaseUrl();
      const response = await fetch(
        `${baseURL}/families/${familyId}/custodial-members/${selectedCustodialMember.id}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        setCustodialMembers((prev) =>
          prev.filter((member) => member.id !== selectedCustodialMember.id),
        );
        setIsDeleteCustodialDialogOpen(false);
        setSelectedCustodialMember(null);
        toast.success('托管成员删除成功');
      } else {
        const error = await response.json();
        toast.error(error.message || '删除托管成员失败');
      }
    } catch (error) {
      console.error('删除托管成员失败:', error);
      toast.error('删除托管成员失败');
    } finally {
      setIsCustodialSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // 调试信息
  console.log('🔍 FamilyDetailModal 渲染状态:', {
    isOpen,
    familyId,
    isLoading,
    error,
    family: !!family,
  });

  return (
    <div
      className="family-detail-modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        minHeight: '100vh',
        maxHeight: '100vh',
        backgroundColor: 'var(--background-color)',
        zIndex: 9999999, // 进一步增加 z-index 值
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        // 移动端优化
        WebkitOverflowScrolling: 'touch',
        // 确保可以接收触摸事件
        touchAction: 'manipulation',
        // 强制硬件加速
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
        // 动画效果
        animation: 'fadeIn 0.3s ease-out',
        // iOS 安全区域适配 - 使用更强的覆盖
        paddingTop: 'max(0px, env(safe-area-inset-top))',
        paddingBottom: 'max(0px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0px, env(safe-area-inset-left))',
        paddingRight: 'max(0px, env(safe-area-inset-right))',
        // iOS Capacitor 特殊处理
        marginTop: 'calc(-1 * env(safe-area-inset-top, 0px))',
        // 确保完全覆盖
        isolation: 'isolate',
      }}
    >
      <style jsx>{`
        .family-detail-modal-overlay {
          z-index: 9999999 !important;
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          min-height: 100vh !important;
          max-height: 100vh !important;
        }

        /* 确保模态框在最顶层，覆盖所有其他元素 */
        .family-detail-modal-overlay * {
          z-index: inherit;
        }

        /* 确保模态框头部始终可见 */
        .family-detail-modal-header {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          z-index: 10000001 !important;
          position: sticky !important;
          top: 0 !important;
          height: 64px !important;
          min-height: 64px !important;
          max-height: 64px !important;
          flex-shrink: 0 !important;
          background-color: var(--background-color) !important;
          border-bottom: 1px solid var(--border-color) !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }

        /* 确保头部按钮可见 */
        .family-detail-modal-header .icon-button {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
        }

        /* 确保头部标题可见 */
        .family-detail-modal-header .header-title {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
        }

        /* 强制隐藏所有可能的工具栏 */
        body.family-detail-modal-open .header:not(.family-detail-modal-header),
        body.family-detail-modal-open .page-header:not(.family-detail-modal-header),
        body.family-detail-modal-open .ios-header:not(.family-detail-modal-header),
        body.family-detail-modal-open .capacitor-header:not(.family-detail-modal-header),
        body.family-detail-modal-open .top-bar:not(.family-detail-modal-header),
        body.family-detail-modal-open .navigation-header:not(.family-detail-modal-header),
        body.family-detail-modal-open .app-header:not(.family-detail-modal-header),
        body.family-detail-modal-open .bottom-nav,
        body.family-detail-modal-open .bottom-navigation,
        body.family-detail-modal-open .tab-bar {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          height: 0 !important;
          overflow: hidden !important;
        }

        /* iOS Capacitor 特殊适配 */
        @supports (padding: max(0px)) {
          .family-detail-modal-overlay {
            padding-top: max(0px, env(safe-area-inset-top)) !important;
            padding-bottom: max(0px, env(safe-area-inset-bottom)) !important;
            padding-left: max(0px, env(safe-area-inset-left)) !important;
            padding-right: max(0px, env(safe-area-inset-right)) !important;
            margin-top: calc(-1 * env(safe-area-inset-top, 0px)) !important;
          }
        }

        /* Capacitor iOS 特殊处理 */
        .capacitor-ios .family-detail-modal-overlay {
          top: 0 !important;
          padding-top: 0 !important;
          margin-top: 0 !important;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>

      {/* 使用完全相同的应用容器结构 */}
      <div
        className="app-container"
        style={{
          maxWidth: '100vw',
          margin: 0,
          width: '100vw',
          height: '100vh',
          minHeight: '100vh',
          position: 'relative',
          overflow: 'hidden',
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 模态框专用头部 */}
        <div
          className="header family-detail-modal-header"
          data-testid="family-detail-modal-header"
          style={{
            height: '64px',
            minHeight: '64px',
            maxHeight: '64px',
            display: 'flex !important',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 16px',
            backgroundColor: 'var(--background-color)',
            borderBottom: '1px solid var(--border-color)',
            position: 'sticky',
            top: 0,
            zIndex: 100001, // 确保头部在最顶层
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            // 确保头部始终可见
            visibility: 'visible',
            opacity: '1',
            // 防止被其他元素覆盖
            isolation: 'isolate',
            // 强制硬件加速
            transform: 'translateZ(0)',
            WebkitTransform: 'translateZ(0)',
            // 确保宽度
            width: '100%',
            boxSizing: 'border-box',
            // 防止收缩
            flexShrink: 0,
          }}
        >
          <button
            className="icon-button"
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '18px',
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--hover-color, rgba(0, 0, 0, 0.05))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <i className="fas fa-arrow-left"></i>
          </button>
          <div
            className="header-title"
            style={{
              fontSize: '18px',
              fontWeight: '600',
              color: 'var(--text-primary)',
              textAlign: 'center',
              flex: 1,
              margin: '0 8px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            家庭详情
          </div>
          <button
            className="icon-button"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '18px',
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--hover-color, rgba(0, 0, 0, 0.05))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <i className="fas fa-ellipsis-v"></i>
          </button>
        </div>

        {/* 主要内容 */}
        <div
          className="main-content"
          style={{
            paddingBottom: '20px',
            overflowY: 'auto',
            overflowX: 'hidden',
            flex: 1,
            width: '100%',
            maxWidth: '100%',
            position: 'relative',
            // 移动端优化
            WebkitOverflowScrolling: 'touch',
            // 确保不会覆盖头部
            marginTop: 0,
            paddingTop: 0,
            // 确保内容区域高度正确
            height: 'calc(100vh - 64px)',
            maxHeight: 'calc(100vh - 64px)',
          }}
        >
          {isLoading ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '300px',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  border: '4px solid var(--border-color)',
                  borderTop: '4px solid var(--primary-color)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              ></div>
              <div
                style={{
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  fontWeight: '500',
                }}
              >
                加载中...
              </div>
            </div>
          ) : error || !family ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '300px',
                textAlign: 'center',
                padding: '0 20px',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  backgroundColor: '#fee2e2',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                }}
              >
                <i
                  className="fas fa-exclamation-triangle"
                  style={{
                    color: '#ef4444',
                    fontSize: '24px',
                  }}
                ></i>
              </div>
              <h2
                style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  marginBottom: '8px',
                  color: 'var(--text-primary)',
                }}
              >
                无法加载家庭信息
              </h2>
              <p
                style={{
                  color: 'var(--text-secondary)',
                  marginBottom: '24px',
                }}
              >
                {error || '找不到该家庭或您没有权限访问'}
              </p>
              <button
                onClick={onClose}
                style={{
                  backgroundColor: 'var(--primary-color)',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                }}
              >
                返回
              </button>
            </div>
          ) : (
            <div style={{ padding: '0 20px' }}>
              {/* 家庭信息主卡片 */}
              <div
                style={{
                  backgroundColor: 'var(--background-color)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '20px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                }}
              >
                {/* 家庭图标 */}
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    backgroundColor: 'var(--primary-color)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <i
                    className="fas fa-home"
                    style={{
                      color: 'white',
                      fontSize: '24px',
                    }}
                  ></i>
                </div>

                {/* 家庭信息 */}
                <div style={{ flex: 1 }}>
                  <h1
                    style={{
                      fontSize: '20px',
                      fontWeight: '700',
                      color: 'var(--text-primary)',
                      marginBottom: '8px',
                    }}
                  >
                    {family.name}
                  </h1>

                  {family.description && (
                    <p
                      style={{
                        color: 'var(--text-secondary)',
                        fontSize: '14px',
                        marginBottom: '12px',
                      }}
                    >
                      {family.description}
                    </p>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '14px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <i className="fas fa-calendar-alt"></i>
                      <span>创建于 {formatDate(family.createdAt)}</span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '14px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <i className="fas fa-users"></i>
                      <span>{family.memberCount || family.members.length}名成员</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 家庭管理操作 */}
              <div style={{ marginBottom: '20px' }}>
                <h2
                  style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    color: 'var(--text-primary)',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <i className="fas fa-cogs"></i>
                  家庭管理
                </h2>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  {/* 管理成员按钮 */}
                  <button
                    onClick={() => onManageMembers?.(familyId)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '16px',
                      backgroundColor: 'transparent',
                      border: '2px solid var(--primary-color)',
                      borderRadius: '12px',
                      color: 'var(--primary-color)',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      minHeight: '48px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--primary-color)';
                      e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--primary-color)';
                    }}
                  >
                    <i className="fas fa-users"></i>
                    管理成员
                  </button>

                  {/* 编辑家庭信息按钮 */}
                  {isAdmin && (
                    <button
                      onClick={handleEditFamily}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '16px',
                        backgroundColor: 'var(--primary-color)',
                        border: 'none',
                        borderRadius: '12px',
                        color: 'white',
                        fontSize: '16px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        minHeight: '48px',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                      }}
                    >
                      <i className="fas fa-edit"></i>
                      编辑家庭信息
                    </button>
                  )}
                </div>
              </div>

              {/* 家庭成员网格 */}
              <div style={{ marginBottom: '20px' }}>
                <h2
                  style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    color: 'var(--text-primary)',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <i className="fas fa-users"></i>
                  家庭成员
                </h2>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '12px',
                  }}
                >
                  {family.members.slice(0, 6).map((member) => (
                    <div
                      key={member.memberId || member.id}
                      style={{
                        backgroundColor: 'var(--background-color)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        padding: '16px',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      {/* 成员头像 */}
                      <AvatarDisplay
                        avatar={member.avatar ?? undefined}
                        username={member.username || member.name}
                        userId={member.userId ?? undefined}
                        size="medium"
                        alt={`${member.username || member.name || '用户'}的头像`}
                      />

                      {/* 成员姓名 */}
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: '500',
                          color: 'var(--text-primary)',
                          textAlign: 'center',
                          lineHeight: '1.2',
                        }}
                      >
                        {member.username || member.name || '未知用户'}
                        {member.isCurrentUser && (
                          <span
                            style={{
                              fontSize: '12px',
                              color: 'var(--primary-color)',
                              marginLeft: '4px',
                            }}
                          >
                            (我)
                          </span>
                        )}
                      </div>

                      {/* 角色标签 */}
                      <div
                        style={{
                          fontSize: '12px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: member.role === 'ADMIN' ? '#fef3c7' : '#f3f4f6',
                          color: member.role === 'ADMIN' ? '#d97706' : '#6b7280',
                          fontWeight: '500',
                        }}
                      >
                        {member.role === 'ADMIN' ? '管理员' : '成员'}
                      </div>

                      {/* 消费统计（如果有） */}
                      {member.statistics && (
                        <div
                          style={{
                            fontSize: '12px',
                            color: 'var(--text-secondary)',
                            textAlign: 'center',
                          }}
                        >
                          本月: {formatCurrency(member.statistics.totalExpense)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {family.members.length > 6 && (
                  <div
                    style={{
                      textAlign: 'center',
                      marginTop: '12px',
                    }}
                  >
                    <button
                      onClick={() => onManageMembers?.(familyId)}
                      style={{
                        color: 'var(--primary-color)',
                        fontSize: '14px',
                        fontWeight: '500',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      查看全部 {family.members.length} 名成员
                    </button>
                  </div>
                )}
              </div>

              {/* 托管成员 */}
              {(custodialMembers.length > 0 || isAdmin) && (
                <div style={{ marginBottom: '20px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '16px',
                    }}
                  >
                    <h2
                      style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        color: 'var(--text-primary)',
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <i className="fas fa-child"></i>
                      托管成员
                    </h2>
                    {isAdmin && (
                      <button
                        onClick={() => setIsAddCustodialDialogOpen(true)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '8px 12px',
                          backgroundColor: 'var(--primary-color)',
                          border: 'none',
                          borderRadius: '8px',
                          color: 'white',
                          fontSize: '14px',
                          fontWeight: '500',
                          cursor: 'pointer',
                        }}
                      >
                        <i className="fas fa-plus"></i>
                        添加
                      </button>
                    )}
                  </div>

                  {custodialMembers.length > 0 ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      {custodialMembers.slice(0, 3).map((member) => (
                        <div
                          key={member.id}
                          style={{
                            backgroundColor: 'var(--background-color)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            padding: '16px',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '12px',
                            }}
                          >
                            {/* 托管成员头像 */}
                            <div
                              style={{
                                width: '40px',
                                height: '40px',
                                backgroundColor: '#f59e0b',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '16px',
                                flexShrink: 0,
                              }}
                            >
                              <i className="fas fa-child"></i>
                            </div>

                            {/* 托管成员信息 */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: '16px',
                                  fontWeight: '500',
                                  color: 'var(--text-primary)',
                                  marginBottom: '8px',
                                }}
                              >
                                {member.name}
                              </div>

                              {/* 第一行：性别和年龄 */}
                              <div
                                style={{
                                  fontSize: '14px',
                                  color: 'var(--text-secondary)',
                                  marginBottom: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                }}
                              >
                                {member.gender && <span>{member.gender}</span>}
                                {member.birthDate && <span>{calculateAge(member.birthDate)}</span>}
                              </div>

                              {/* 第二行：添加时间 */}
                              <div
                                style={{
                                  fontSize: '14px',
                                  color: 'var(--text-secondary)',
                                }}
                              >
                                添加于 {formatDate(member.createdAt)}
                              </div>
                            </div>

                            {/* 管理按钮 */}
                            {isAdmin && (
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '8px',
                                  flexShrink: 0,
                                }}
                              >
                                <button
                                  onClick={() => handleEditCustodialMember(member)}
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    border: 'none',
                                    backgroundColor: '#3b82f6',
                                    color: 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '14px',
                                  }}
                                >
                                  <i className="fas fa-edit"></i>
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedCustodialMember(member);
                                    setIsDeleteCustodialDialogOpen(true);
                                  }}
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    border: 'none',
                                    backgroundColor: '#ef4444',
                                    color: 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '14px',
                                  }}
                                >
                                  <i className="fas fa-trash"></i>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {custodialMembers.length > 3 && (
                        <div
                          style={{
                            textAlign: 'center',
                            marginTop: '8px',
                          }}
                        >
                          <button
                            onClick={() => onManageMembers?.(familyId)}
                            style={{
                              color: 'var(--primary-color)',
                              fontSize: '14px',
                              fontWeight: '500',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              textDecoration: 'underline',
                            }}
                          >
                            查看全部 {custodialMembers.length} 名托管成员
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '40px 20px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <i
                        className="fas fa-child"
                        style={{
                          fontSize: '32px',
                          marginBottom: '12px',
                          display: 'block',
                        }}
                      ></i>
                      <p style={{ marginBottom: '16px' }}>暂无托管成员</p>
                      {isAdmin && (
                        <button
                          onClick={() => setIsAddCustodialDialogOpen(true)}
                          style={{
                            padding: '12px 24px',
                            backgroundColor: 'var(--primary-color)',
                            border: 'none',
                            borderRadius: '8px',
                            color: 'white',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer',
                          }}
                        >
                          添加托管成员
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 统计数据双列卡片 */}
              {statistics && (
                <div style={{ marginBottom: '20px' }}>
                  <h2
                    style={{
                      fontSize: '18px',
                      fontWeight: '700',
                      color: 'var(--text-primary)',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <i className="fas fa-chart-pie"></i>
                    家庭统计
                  </h2>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '12px',
                    }}
                  >
                    {/* 本月支出 */}
                    <div
                      style={{
                        backgroundColor: 'var(--background-color)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        padding: '20px',
                        textAlign: 'center',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '24px',
                          fontWeight: '700',
                          color: '#ef4444',
                          marginBottom: '4px',
                        }}
                      >
                        {formatCurrency(statistics.totalExpense)}
                      </div>
                      <div
                        style={{
                          fontSize: '14px',
                          color: 'var(--text-secondary)',
                          fontWeight: '500',
                        }}
                      >
                        本月支出
                      </div>
                    </div>

                    {/* 本月收入 */}
                    <div
                      style={{
                        backgroundColor: 'var(--background-color)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        padding: '20px',
                        textAlign: 'center',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '24px',
                          fontWeight: '700',
                          color: '#10b981',
                          marginBottom: '4px',
                        }}
                      >
                        {formatCurrency(statistics.totalIncome)}
                      </div>
                      <div
                        style={{
                          fontSize: '14px',
                          color: 'var(--text-secondary)',
                          fontWeight: '500',
                        }}
                      >
                        本月收入
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 成员消费排行 */}
              {statistics?.memberStats && statistics.memberStats.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h2
                    style={{
                      fontSize: '18px',
                      fontWeight: '700',
                      color: 'var(--text-primary)',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <i className="fas fa-trophy"></i>
                    成员消费排行
                  </h2>

                  <div
                    style={{
                      backgroundColor: 'var(--background-color)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      overflow: 'hidden',
                    }}
                  >
                    {statistics.memberStats.slice(0, 5).map((member, index) => (
                      <div
                        key={member.memberId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '16px',
                          borderBottom:
                            index < Math.min(statistics.memberStats.length, 5) - 1
                              ? '1px solid var(--border-color)'
                              : 'none',
                        }}
                      >
                        {/* 排名 */}
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor:
                              index === 0
                                ? '#fbbf24'
                                : index === 1
                                  ? '#9ca3af'
                                  : index === 2
                                    ? '#d97706'
                                    : 'var(--background-secondary)',
                            color: index < 3 ? 'white' : 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            fontWeight: '600',
                            marginRight: '12px',
                          }}
                        >
                          {index + 1}
                        </div>

                        {/* 成员信息 */}
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontSize: '16px',
                              fontWeight: '500',
                              color: 'var(--text-primary)',
                              marginBottom: '2px',
                            }}
                          >
                            {member.memberName}
                          </div>
                          <div
                            style={{
                              fontSize: '14px',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {member.percentage.toFixed(1)}%
                          </div>
                        </div>

                        {/* 金额 */}
                        <div
                          style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            color: 'var(--text-primary)',
                          }}
                        >
                          {formatCurrency(member.totalExpense)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 分类消费排行 */}
              {statistics?.categoryStats && statistics.categoryStats.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h2
                    style={{
                      fontSize: '18px',
                      fontWeight: '700',
                      color: 'var(--text-primary)',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <i className="fas fa-chart-pie"></i>
                    分类消费排行
                  </h2>

                  <div
                    style={{
                      backgroundColor: 'var(--background-color)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      overflow: 'hidden',
                    }}
                  >
                    {statistics.categoryStats.slice(0, 5).map((category, index) => (
                      <div
                        key={category.categoryId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '16px',
                          borderBottom:
                            index < Math.min(statistics.categoryStats.length, 5) - 1
                              ? '1px solid var(--border-color)'
                              : 'none',
                        }}
                      >
                        {/* 排名 */}
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor:
                              index === 0
                                ? '#fbbf24'
                                : index === 1
                                  ? '#9ca3af'
                                  : index === 2
                                    ? '#d97706'
                                    : 'var(--background-secondary)',
                            color: index < 3 ? 'white' : 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            fontWeight: '600',
                            marginRight: '12px',
                          }}
                        >
                          {index + 1}
                        </div>

                        {/* 分类信息 */}
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontSize: '16px',
                              fontWeight: '500',
                              color: 'var(--text-primary)',
                              marginBottom: '2px',
                            }}
                          >
                            {category.categoryName}
                          </div>
                          <div
                            style={{
                              fontSize: '14px',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {category.percentage.toFixed(1)}%
                          </div>
                        </div>

                        {/* 金额 */}
                        <div
                          style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            color: 'var(--text-primary)',
                          }}
                        >
                          {formatCurrency(category.totalExpense)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 危险操作区域 */}
              <div style={{ marginBottom: '20px' }}>
                <h2
                  style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    color: 'var(--text-primary)',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <i className="fas fa-exclamation-triangle"></i>
                  危险操作
                </h2>

                <div
                  style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '12px',
                    padding: '16px',
                  }}
                >
                  {isAdmin ? (
                    <>
                      <button
                        onClick={() => setIsDeleteDialogOpen(true)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          width: '100%',
                          padding: '12px',
                          backgroundColor: '#ef4444',
                          border: 'none',
                          borderRadius: '8px',
                          color: 'white',
                          fontSize: '16px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          marginBottom: '8px',
                        }}
                      >
                        <i className="fas fa-trash-alt"></i>
                        解散家庭
                      </button>
                      <p
                        style={{
                          fontSize: '14px',
                          color: '#dc2626',
                          textAlign: 'center',
                          margin: 0,
                        }}
                      >
                        解散家庭将永久移除所有相关数据，此操作不可恢复。
                      </p>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setIsLeaveDialogOpen(true)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          width: '100%',
                          padding: '12px',
                          backgroundColor: '#f59e0b',
                          border: 'none',
                          borderRadius: '8px',
                          color: 'white',
                          fontSize: '16px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          marginBottom: '8px',
                        }}
                      >
                        <i className="fas fa-sign-out-alt"></i>
                        退出家庭
                      </button>
                      <p
                        style={{
                          fontSize: '14px',
                          color: '#d97706',
                          textAlign: 'center',
                          margin: 0,
                        }}
                      >
                        退出家庭后，您将无法访问该家庭的数据。
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 编辑家庭信息对话框 */}
      {isEditDialogOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 10000000, // 增加 z-index 确保在模态框之上
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setIsEditDialogOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--background-color)',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '400px',
              overflow: 'hidden',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 对话框头部 */}
            <div
              style={{
                padding: '20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                编辑家庭信息
              </h3>
              <button
                onClick={() => setIsEditDialogOpen(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: 'var(--background-secondary)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* 对话框内容 */}
            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: 'var(--text-primary)',
                    marginBottom: '8px',
                  }}
                >
                  家庭名称 *
                </label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '16px',
                    backgroundColor: 'var(--background-color)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="请输入家庭名称"
                  maxLength={30}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: 'var(--text-primary)',
                    marginBottom: '8px',
                  }}
                >
                  家庭描述
                </label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, description: e.target.value })
                  }
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '16px',
                    backgroundColor: 'var(--background-color)',
                    color: 'var(--text-primary)',
                    resize: 'vertical',
                    minHeight: '80px',
                  }}
                  placeholder="请输入家庭描述（可选）"
                  maxLength={100}
                />
              </div>

              {/* 对话框按钮 */}
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                }}
              >
                <button
                  onClick={() => setIsEditDialogOpen(false)}
                  disabled={isEditSubmitting}
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary)',
                    fontSize: '16px',
                    fontWeight: '500',
                    cursor: isEditSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isEditSubmitting ? 0.6 : 1,
                  }}
                >
                  取消
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isEditSubmitting || !editFormData.name.trim()}
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: 'var(--primary-color)',
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor:
                      isEditSubmitting || !editFormData.name.trim() ? 'not-allowed' : 'pointer',
                    opacity: isEditSubmitting || !editFormData.name.trim() ? 0.6 : 1,
                  }}
                >
                  {isEditSubmitting ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 退出家庭确认对话框 */}
      <ConfirmDialog
        isOpen={isLeaveDialogOpen}
        title="退出家庭"
        message={`确定要退出"${family?.name}"吗？此操作无法撤销。`}
        confirmText={isProcessing ? '处理中...' : '退出'}
        cancelText="取消"
        onConfirm={handleLeaveFamily}
        onCancel={() => setIsLeaveDialogOpen(false)}
        isDangerous
      />

      {/* 解散家庭确认对话框 */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="解散家庭"
        message={`确定要解散"${family?.name}"吗？此操作将永久删除该家庭及其所有数据，无法撤销。`}
        confirmText={isProcessing ? '处理中...' : '解散'}
        cancelText="取消"
        onConfirm={handleDeleteFamily}
        onCancel={() => setIsDeleteDialogOpen(false)}
        isDangerous
      />

      {/* 添加托管成员对话框 */}
      {isAddCustodialDialogOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 10000001, // 增加 z-index 确保在模态框之上
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => {
            setIsAddCustodialDialogOpen(false);
            resetCustodialForm();
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--background-color)',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '400px',
              overflow: 'hidden',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 对话框头部 */}
            <div
              style={{
                padding: '20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                添加托管成员
              </h3>
              <button
                onClick={() => {
                  setIsAddCustodialDialogOpen(false);
                  resetCustodialForm();
                }}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: 'var(--background-secondary)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* 对话框内容 */}
            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: 'var(--text-primary)',
                    marginBottom: '8px',
                  }}
                >
                  姓名 *
                </label>
                <input
                  type="text"
                  value={custodialFormData.name}
                  onChange={(e) =>
                    setCustodialFormData({ ...custodialFormData, name: e.target.value })
                  }
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '16px',
                    backgroundColor: 'var(--background-color)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="请输入姓名"
                  maxLength={30}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: 'var(--text-primary)',
                    marginBottom: '8px',
                  }}
                >
                  性别
                </label>
                <select
                  value={custodialFormData.gender}
                  onChange={(e) =>
                    setCustodialFormData({ ...custodialFormData, gender: e.target.value })
                  }
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '16px',
                    backgroundColor: 'var(--background-color)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="男">男</option>
                  <option value="女">女</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: 'var(--text-primary)',
                    marginBottom: '8px',
                  }}
                >
                  出生日期
                </label>
                <input
                  type="date"
                  value={custodialFormData.birthDate}
                  onChange={(e) =>
                    setCustodialFormData({ ...custodialFormData, birthDate: e.target.value })
                  }
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '16px',
                    backgroundColor: 'var(--background-color)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              {/* 对话框按钮 */}
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                }}
              >
                <button
                  onClick={() => {
                    setIsAddCustodialDialogOpen(false);
                    resetCustodialForm();
                  }}
                  disabled={isCustodialSubmitting}
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary)',
                    fontSize: '16px',
                    fontWeight: '500',
                    cursor: isCustodialSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isCustodialSubmitting ? 0.6 : 1,
                  }}
                >
                  取消
                </button>
                <button
                  onClick={handleAddCustodialMember}
                  disabled={isCustodialSubmitting || !custodialFormData.name.trim()}
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: 'var(--primary-color)',
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor:
                      isCustodialSubmitting || !custodialFormData.name.trim()
                        ? 'not-allowed'
                        : 'pointer',
                    opacity: isCustodialSubmitting || !custodialFormData.name.trim() ? 0.6 : 1,
                  }}
                >
                  {isCustodialSubmitting ? '添加中...' : '添加'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 编辑托管成员对话框 */}
      {isEditCustodialDialogOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 10000001, // 增加 z-index 确保在模态框之上
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => {
            setIsEditCustodialDialogOpen(false);
            setSelectedCustodialMember(null);
            resetCustodialForm();
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--background-color)',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '400px',
              overflow: 'hidden',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 对话框头部 */}
            <div
              style={{
                padding: '20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                编辑托管成员
              </h3>
              <button
                onClick={() => {
                  setIsEditCustodialDialogOpen(false);
                  setSelectedCustodialMember(null);
                  resetCustodialForm();
                }}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: 'var(--background-secondary)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* 对话框内容 */}
            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: 'var(--text-primary)',
                    marginBottom: '8px',
                  }}
                >
                  姓名 *
                </label>
                <input
                  type="text"
                  value={custodialFormData.name}
                  onChange={(e) =>
                    setCustodialFormData({ ...custodialFormData, name: e.target.value })
                  }
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '16px',
                    backgroundColor: 'var(--background-color)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="请输入姓名"
                  maxLength={30}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: 'var(--text-primary)',
                    marginBottom: '8px',
                  }}
                >
                  性别
                </label>
                <select
                  value={custodialFormData.gender}
                  onChange={(e) =>
                    setCustodialFormData({ ...custodialFormData, gender: e.target.value })
                  }
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '16px',
                    backgroundColor: 'var(--background-color)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="男">男</option>
                  <option value="女">女</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: 'var(--text-primary)',
                    marginBottom: '8px',
                  }}
                >
                  出生日期
                </label>
                <input
                  type="date"
                  value={custodialFormData.birthDate}
                  onChange={(e) =>
                    setCustodialFormData({ ...custodialFormData, birthDate: e.target.value })
                  }
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '16px',
                    backgroundColor: 'var(--background-color)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              {/* 对话框按钮 */}
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                }}
              >
                <button
                  onClick={() => {
                    setIsEditCustodialDialogOpen(false);
                    setSelectedCustodialMember(null);
                    resetCustodialForm();
                  }}
                  disabled={isCustodialSubmitting}
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary)',
                    fontSize: '16px',
                    fontWeight: '500',
                    cursor: isCustodialSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isCustodialSubmitting ? 0.6 : 1,
                  }}
                >
                  取消
                </button>
                <button
                  onClick={handleUpdateCustodialMember}
                  disabled={isCustodialSubmitting || !custodialFormData.name.trim()}
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: 'var(--primary-color)',
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor:
                      isCustodialSubmitting || !custodialFormData.name.trim()
                        ? 'not-allowed'
                        : 'pointer',
                    opacity: isCustodialSubmitting || !custodialFormData.name.trim() ? 0.6 : 1,
                  }}
                >
                  {isCustodialSubmitting ? '更新中...' : '更新'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 删除托管成员确认对话框 */}
      {isDeleteCustodialDialogOpen && selectedCustodialMember && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 10000001, // 增加 z-index 确保在模态框之上
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => {
            setIsDeleteCustodialDialogOpen(false);
            setSelectedCustodialMember(null);
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--background-color)',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '400px',
              overflow: 'hidden',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 对话框头部 */}
            <div
              style={{
                padding: '20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                删除托管成员
              </h3>
              <button
                onClick={() => {
                  setIsDeleteCustodialDialogOpen(false);
                  setSelectedCustodialMember(null);
                }}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: 'var(--background-secondary)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* 对话框内容 */}
            <div style={{ padding: '20px' }}>
              <p
                style={{
                  fontSize: '16px',
                  color: 'var(--text-primary)',
                  marginBottom: '20px',
                  lineHeight: '1.5',
                }}
              >
                确定要删除托管成员 "{selectedCustodialMember.name}" 吗？此操作无法撤销。
              </p>

              {/* 对话框按钮 */}
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                }}
              >
                <button
                  onClick={() => {
                    setIsDeleteCustodialDialogOpen(false);
                    setSelectedCustodialMember(null);
                  }}
                  disabled={isCustodialSubmitting}
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary)',
                    fontSize: '16px',
                    fontWeight: '500',
                    cursor: isCustodialSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isCustodialSubmitting ? 0.6 : 1,
                  }}
                >
                  取消
                </button>
                <button
                  onClick={handleDeleteCustodialMember}
                  disabled={isCustodialSubmitting}
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: isCustodialSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isCustodialSubmitting ? 0.6 : 1,
                  }}
                >
                  {isCustodialSubmitting ? '删除中...' : '删除'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
