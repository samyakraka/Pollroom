function ResultsBar({ options, totalVotes, votedOption, prevOptions }) {
  const maxVotes = Math.max(...options.map((o) => o.votes));

  return (
    <div className="results-container">
      {options.map((opt, i) => {
        const pct = totalVotes > 0 ? (opt.votes / totalVotes) * 100 : 0;
        const isWinner = opt.votes === maxVotes && maxVotes > 0;
        const isVoted = votedOption === i;

        // Calculate delta from previous state
        let delta = null;
        if (prevOptions && prevOptions[i]) {
          const prevTotal = prevOptions.reduce((s, o) => s + o.votes, 0);
          const prevPct = prevTotal > 0 ? (prevOptions[i].votes / prevTotal) * 100 : 0;
          const diff = pct - prevPct;
          if (Math.abs(diff) >= 0.1) {
            delta = diff;
          }
        }

        return (
          <div key={i} className="result-item">
            <div className="result-header">
              <span className="result-label">
                {opt.text}
                {isVoted && <span className="result-voted-badge">Your vote</span>}
              </span>
              <span className="result-stats">
                {delta !== null && (
                  <span className={`result-delta ${delta > 0 ? 'up' : 'down'}`}>
                    {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                  </span>
                )}
                <span>{opt.votes}</span>
                <span className="result-percentage">{pct.toFixed(1)}%</span>
              </span>
            </div>
            <div className="result-bar-track">
              <div
                className={`result-bar-fill${isWinner ? ' is-winner' : ''}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ResultsBar;
