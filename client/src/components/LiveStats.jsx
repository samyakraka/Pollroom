import { useMemo } from 'react';

// Mini SVG sparkline showing vote activity over time
function Sparkline({ data, width = 120, height = 32 }) {
  const points = useMemo(() => {
    if (!data || data.length === 0) return '';
    const max = Math.max(...data.map((d) => d.count), 1);
    const step = width / Math.max(data.length - 1, 1);

    return data
      .map((d, i) => {
        const x = i * step;
        const y = height - (d.count / max) * (height - 4) - 2;
        return `${x},${y}`;
      })
      .join(' ');
  }, [data, width, height]);

  if (!data || data.length < 2) {
    return (
      <div className="sparkline-empty">
        <span>No activity yet</span>
      </div>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="sparkline-svg"
    >
      {/* Area fill */}
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill="rgba(91, 108, 247, 0.1)"
      />
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last point dot */}
      {data.length > 0 && (() => {
        const max = Math.max(...data.map((d) => d.count), 1);
        const lastIdx = data.length - 1;
        const step = width / Math.max(data.length - 1, 1);
        const x = lastIdx * step;
        const y = height - (data[lastIdx].count / max) * (height - 4) - 2;
        return <circle cx={x} cy={y} r="2.5" fill="var(--accent)" />;
      })()}
    </svg>
  );
}

function LiveStats({ viewers, velocity, activity, totalVotes }) {
  return (
    <div className="live-stats">
      <div className="stat-item">
        <div className="stat-value">{viewers}</div>
        <div className="stat-label">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          watching
        </div>
      </div>

      <div className="stat-divider" />

      <div className="stat-item">
        <div className="stat-value">
          {velocity > 0 ? velocity.toFixed(1) : '0'}
          <span className="stat-unit">/min</span>
        </div>
        <div className="stat-label">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
          </svg>
          velocity
        </div>
      </div>

      <div className="stat-divider" />

      <div className="stat-item stat-chart">
        <div className="stat-label" style={{ marginBottom: 4 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/>
            <polyline points="17,6 23,6 23,12"/>
          </svg>
          vote trend
        </div>
        <Sparkline data={activity} />
      </div>
    </div>
  );
}

export default LiveStats;
