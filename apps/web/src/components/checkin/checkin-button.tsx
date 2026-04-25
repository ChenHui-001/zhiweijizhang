'use client';

import React from 'react';

interface CheckinButtonProps {
  className?: string;
  showBalance?: boolean;
}

export const CheckinButton: React.FC<CheckinButtonProps> = ({
  className = '',
  showBalance = false,
}) => {
  // 签到功能已停用，按钮保持禁用状态
  return (
    <div className={`checkin-container ${className}`}>
      {showBalance && (
        <div className="points-display">
          <div className="points-total">
            <span className="points-label">签到功能已关闭</span>
          </div>
        </div>
      )}

      <button
        className="checkin-button disabled"
        disabled={true}
      >
        <span className="checkin-text">
          <i className="fas fa-calendar-check"></i>
          每日签到（已关闭）
        </span>
      </button>
    </div>
  );
};
