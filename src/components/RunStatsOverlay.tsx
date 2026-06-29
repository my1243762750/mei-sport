import type { RunningStats } from '../types';

type RewardNotice =
  | { type: 'countdown'; targetMinutes: number; remainingSeconds: number }
  | { type: 'complete'; targetMinutes: number };

interface RunStatsOverlayProps {
  stats: RunningStats;
  resetStats: () => void;
  rewardNotice?: RewardNotice | null;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const getNextMilestone = (currentSteps: number) => {
  const milestones = [200, 500, 1000, 2000, 3000, 5000, 8000, 10000];
  const next = milestones.find((value) => value > currentSteps) ?? (Math.floor(currentSteps / 5000) + 1) * 5000;
  const previousIndex = milestones.indexOf(next) - 1;
  const previous = previousIndex >= 0 ? milestones[previousIndex] : 0;
  const progress = Math.min(100, Math.max(0, ((currentSteps - previous) / (next - previous)) * 100));

  return { target: next, progress };
};

export const RunStatsOverlay: React.FC<RunStatsOverlayProps> = ({ stats, resetStats, rewardNotice }) => {
  const distanceKm = ((stats.steps * 0.8) / 1000).toFixed(2);
  const milestone = getNextMilestone(stats.steps);

  return (
    <aside className={`run-stats-overlay ${rewardNotice ? 'reward-mode' : ''}`} aria-label="跑步实时数据">
      <div className="run-stats-header">
        <span>{rewardNotice ? '里程碑播报' : '实时数据'}</span>
        <button type="button" onClick={resetStats}>重置</button>
      </div>

      {rewardNotice && (
        <div className={`reward-message ${rewardNotice.type}`}>
          {rewardNotice.type === 'countdown' ? (
            <>
              <strong>距离 {rewardNotice.targetMinutes} 分钟还差 {rewardNotice.remainingSeconds} 秒</strong>
              <span>准备冲过这一段</span>
            </>
          ) : (
            <>
              <strong>{rewardNotice.targetMinutes} 分钟达成</strong>
              <span>节奏很稳，继续保持呼吸</span>
            </>
          )}
        </div>
      )}

      <div className="run-stats-grid">
        <div className="run-stat-chip">
          <span>时间</span>
          <strong>{formatTime(stats.elapsedTime)}</strong>
        </div>
        <div className="run-stat-chip">
          <span>步数</span>
          <strong>{stats.steps}</strong>
        </div>
        <div className="run-stat-chip">
          <span>距离</span>
          <strong>{distanceKm}<small>km</small></strong>
        </div>
        <div className="run-stat-chip">
          <span>热量</span>
          <strong>{Math.round(stats.calories)}<small>kcal</small></strong>
        </div>
      </div>

      <div className="run-progress-row">
        <span>{milestone.target} 步目标</span>
        <strong>{Math.round(milestone.progress)}%</strong>
      </div>
      <div className="run-progress-track">
        <div className="run-progress-fill" style={{ width: `${milestone.progress}%` }} />
      </div>
    </aside>
  );
};
