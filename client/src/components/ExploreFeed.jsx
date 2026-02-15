import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const API_BASE = '/api/polls';

function ExploreFeed() {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'active'

  const fetchPolls = async (p = 1, activeOnly = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: 12 });
      if (activeOnly) params.set('active', 'true');

      const res = await fetch(`${API_BASE}/feed?${params}`);
      const data = await res.json();

      if (res.ok) {
        setPolls(data.polls);
        setPagination(data.pagination);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolls(page, filter === 'active');
  }, [page, filter]);

  const formatTimeAgo = (dateStr) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getTimeRemaining = (expiresAt) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return 'Ended';
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff / 60000) % 60);
    if (hours > 24) return `${Math.floor(hours / 24)}d left`;
    if (hours > 0) return `${hours}h ${mins}m left`;
    return `${mins}m left`;
  };

  return (
    <div className="page-container fade-in">
      <nav className="nav">
        <Link to="/" className="logo-link">
          <div className="logo-mark">P</div>
          <span className="logo-wordmark">PollRoom</span>
        </Link>
        <Link to="/" className="nav-link">+ New poll</Link>
      </nav>

      <h1 className="page-title">Explore polls</h1>
      <p className="page-desc">Browse recent polls and vote on topics that interest you.</p>

      <div className="feed-filters">
        <button
          className={`filter-btn${filter === 'all' ? ' active' : ''}`}
          onClick={() => { setFilter('all'); setPage(1); }}
        >
          All polls
        </button>
        <button
          className={`filter-btn${filter === 'active' ? ' active' : ''}`}
          onClick={() => { setFilter('active'); setPage(1); }}
        >
          Active only
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div className="loading-spinner" style={{ margin: '0 auto' }} />
        </div>
      )}

      {!loading && polls.length === 0 && (
        <div className="feed-empty">
          <p>No polls yet. Be the first to create one!</p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: 16 }}>
            Create a poll
          </Link>
        </div>
      )}

      {!loading && polls.length > 0 && (
        <div className="feed-grid">
          {polls.map((poll) => {
            const timeRemaining = getTimeRemaining(poll.expiresAt);
            return (
              <Link
                key={poll.shareId}
                to={`/poll/${poll.shareId}`}
                className="feed-card"
              >
                <div className="feed-card-header">
                  <h3 className="feed-card-question">{poll.question}</h3>
                  {!poll.isExpired ? (
                    <span className="feed-card-badge live">Live</span>
                  ) : (
                    <span className="feed-card-badge ended">Ended</span>
                  )}
                </div>
                <div className="feed-card-meta">
                  <span>{poll.totalVotes} vote{poll.totalVotes !== 1 ? 's' : ''}</span>
                  <span className="poll-meta-sep" />
                  <span>{poll.optionCount} options</span>
                  <span className="poll-meta-sep" />
                  <span>{formatTimeAgo(poll.createdAt)}</span>
                  {timeRemaining && !poll.isExpired && (
                    <>
                      <span className="poll-meta-sep" />
                      <span className="feed-card-timer">{timeRemaining}</span>
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="feed-pagination">
          <button
            className="btn btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span className="pagination-info">
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            className="btn btn-secondary"
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default ExploreFeed;
