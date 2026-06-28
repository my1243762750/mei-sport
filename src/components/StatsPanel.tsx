import React, { useEffect, useState } from 'react';
import type { RunningStats } from '../types';

interface StatsPanelProps {
  stats: RunningStats;
  resetStats: () => void;
}

const RUNNING_TIPS = [
  '保持轻快落地，脚步声越小，说明缓冲越稳定。',
  '上身微微前倾，肩膀放松，手臂自然前后摆动。',
  '步频越快，单步跨幅越小，更容易减少膝盖冲击。',
  '如果开始紧张，先放松下颌和肩膀，节奏会更容易稳定。',
  '呼吸跟着节拍走，可以尝试两步一吸、两步一呼。',
];

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats, resetStats }) => {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTipIndex((prev) => (prev + 1) % RUNNING_TIPS.length);
    }, 12000);

    return () => window.clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const estimatedDistanceKm = ((stats.steps * 0.8) / 1000).toFixed(2);

  const getNextMilestone = (currentSteps: number) => {
    const milestones = [200, 500, 1000, 2000, 3000, 5000, 8000, 10000];
    const next = milestones.find((m) => m > currentSteps) || (Math.floor(currentSteps / 5000) + 1) * 5000;
    const prev = milestones[milestones.indexOf(next) - 1] || 0;
    const progress = Math.min(100, Math.max(0, ((currentSteps - prev) / (next - prev)) * 100));
    return { target: next, progress };
  };

  const milestone = getNextMilestone(stats.steps);

  return (
    <div className="panel-card">
      <div className="panel-header">
        <h2 className="panel-title">跑步实时数据</h2>
        <button onClick={resetStats} className="btn-reset">
          重置数据
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">运行时间</span>
          <span className="stat-value">{formatTime(stats.elapsedTime)}</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">累计步数</span>
          <span className="stat-value">
            {stats.steps} <span className="stat-value-unit">步</span>
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">运动距离</span>
          <span className="stat-value">
            {estimatedDistanceKm} <span className="stat-value-unit">KM</span>
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">能量消耗</span>
          <span className="stat-value">
            {Math.round(stats.calories)} <span className="stat-value-unit">Kcal</span>
          </span>
        </div>
      </div>

      <div className="progress-section">
        <div className="progress-info-row">
          <span className="progress-target">下一阶段目标：{milestone.target} 步</span>
          <span className="progress-percent">{Math.round(milestone.progress)}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${milestone.progress}%` }} />
        </div>
        {stats.steps < milestone.target && (
          <div className="progress-footer-text">还差 {milestone.target - stats.steps} 步</div>
        )}
      </div>

      <div className="tip-box">
        <div className="tip-header">
          <span className="tip-category-tag">跑姿提示</span>
        </div>
        <p className="tip-text">{RUNNING_TIPS[tipIndex]}</p>
      </div>
    </div>
  );
};
