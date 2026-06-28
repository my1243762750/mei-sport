import type { RunningStats } from '../types';

interface RunStatsOverlayProps {
  stats: RunningStats;
  resetStats: () => void;
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

export const RunStatsOverlay: React.FC<RunStatsOverlayProps> = ({ stats, resetStats }) => {
  const distanceKm = ((stats.steps * 0.8) / 1000).toFixed(2);
  const milestone = getNextMilestone(stats.steps);

  return (
    <aside className="run-stats-overlay" aria-label="跑步实时数据">
      <div className="run-stats-header">
        <span>实时数据</span>
        <button type="button" onClick={resetStats}>重置</button>
      </div>

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
