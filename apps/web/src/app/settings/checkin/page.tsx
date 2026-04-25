'use client';

import { useRouter } from 'next/navigation';
import {
  CalendarIcon,
  FireIcon,
  CheckCircleIcon,
  GiftIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';
import { PageContainer } from '../../../components/layout/page-container';

export default function CheckinPage() {
  const router = useRouter();

  // 返回到上一页
  const handleBackClick = () => {
    router.back();
  };

  return (
    <PageContainer
      title="每日签到"
      showBackButton={true}
      onBackClick={handleBackClick}
      showBottomNav={false}
    >
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <CalendarIcon className="h-8 w-8 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">签到功能已关闭</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">记账点系统已停用，签到功能暂不可用</p>
        </div>
      </div>
    </PageContainer>
  );
}
