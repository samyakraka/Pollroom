import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import ResultsBar from './ResultsBar';
import ShareLink from './ShareLink';
import LiveStats from './LiveStats';

const API_BASE = '/api/polls';

function getVisitorId() {
  const key = 'pollroom_visitor_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
    localStorage.setItem(key, id);
  }
  return id;
}

function PollView() {
  const { shareId } = useParams();
  const [poll, setPoll] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [votedOption, setVotedOption] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [viewers, setViewers] = useState(0);
  const [voteTimestamps, setVoteTimestamps] = useState([]);
  const [prevOptions, setPrevOptions] = useState(null);
  const [activity, setActivity] = useState([]);
  const [velocity, setVelocity] = useState(0);
  const socketRef = useRef(null);
  const visitorId = useRef(getVisitorId());

  // Countdown state
  const [timeLeft, setTimeLeft] = useState(null);

  const fetchPoll = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE}/${shareId}?visitorId=${encodeURIComponent(visitorId.current)}`
      );

      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load poll.');

      setPoll(data.poll);
      setHasVoted(data.hasVoted);
      setIsExpired(data.isExpired);
      if (data.hasVoted && data.votedOption !== null) {
        setVotedOption(data.votedOption);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [shareId]);

  // Fetch activity data
  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/${shareId}/activity`);
      if (res.ok) {
        const data = await res.json();
        setActivity(data.activity);
        setVelocity(data.velocity);
      }
    } catch {
      // Silently fail for activity
    }
  }, [shareId]);

  // Setup Socket.IO
  useEffect(() => {
    fetchPoll();
    fetchActivity();

    const socketUrl = import.meta.env.PROD
      ? window.location.origin
      : 'http://localhost:3001';

    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('poll:join', shareId);
    });

    socket.on('vote:update', (data) => {
      setPoll((prev) => {
        if (!prev) return prev;
        setPrevOptions(prev.options);
        return {
          ...prev,
          options: data.options,
          totalVotes: data.totalVotes,
        };
      });

      // Track vote timestamp for velocity
      if (data.timestamp) {
        setVoteTimestamps((prev) => {
          const now = Date.now();
          const recent = prev.filter((t) => now - t < 5 * 60 * 1000);
          return [...recent, now];
        });
      }
    });

    socket.on('viewers:count', (data) => {
      setViewers(data.count);
    });

    socketRef.current = socket;

    return () => {
      socket.emit('poll:leave', shareId);
      socket.disconnect();
    };
  }, [shareId, fetchPoll, fetchActivity]);

  // Countdown timer
  useEffect(() => {
    if (!poll?.expiresAt) return;

    const updateCountdown = () => {
      const now = new Date();
      const expires = new Date(poll.expiresAt);
      const diff = expires - now;

      if (diff <= 0) {
        setTimeLeft(null);
        setIsExpired(true);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      let display = '';
      if (days > 0) display += `${days}d `;
      if (hours > 0 || days > 0) display += `${hours}h `;
      display += `${minutes}m ${seconds}s`;

      setTimeLeft(display.trim());
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [poll?.expiresAt]);

  // Refresh activity periodically
  useEffect(() => {
    const interval = setInterval(fetchActivity, 30000);
    return () => clearInterval(interval);
  }, [fetchActivity]);

  const handleVote = async (optionIndex) => {
    if (hasVoted || voting || isExpired) return;
    setVoting(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/${shareId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optionIndex,
          visitorId: visitorId.current,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setHasVoted(true);
        setVotedOption(optionIndex);
        setError('You have already voted on this poll.');
        return;
      }

      if (res.status === 429) {
        setError('Too many votes. Please try again later.');
        return;
      }

      if (res.status === 403) {
        setIsExpired(true);
        setError('This poll has ended.');
        return;
      }

      if (!res.ok) throw new Error(data.error || 'Failed to vote.');

      setPoll((prev) => ({
        ...prev,
        options: data.poll.options,
        totalVotes: data.poll.totalVotes,
      }));
      setHasVoted(true);
      setVotedOption(optionIndex);
    } catch (err) {
      setError(err.message);
    } finally {
      setVoting(false);
    }
  };

  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <span className="loading-text">Loading poll...</span>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="page-container">
        <div className="not-found">
          <h2>Poll not found</h2>
          <p>This poll does not exist or may have been removed.</p>
          <Link to="/" className="btn btn-primary">
            Create a new poll
          </Link>
        </div>
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="page-container">
        <div className="error-message">
          {error || 'Something went wrong.'}
        </div>
        <Link to="/" className="btn btn-secondary" style={{ marginTop: 16 }}>
          Back
        </Link>
      </div>
    );
  }

  // Compute client-side velocity from tracked timestamps
  const liveVelocity =
    voteTimestamps.length > 0
      ? Math.round((voteTimestamps.filter((t) => Date.now() - t < 60000).length) * 10) / 10
      : velocity;

  return (
    <div className="page-container fade-in">
      <nav className="nav">
        <Link to="/" className="logo-link">
          <div className="logo-mark">P</div>
          <span className="logo-wordmark">PollRoom</span>
        </Link>
        <Link to="/explore" className="nav-link">Explore</Link>
      </nav>

      <div className="card">
        <div className="poll-header">
          <h1 className="poll-question">{poll.question}</h1>
          <div className="poll-meta">
            {!isExpired ? (
              <span className="live-badge">
                <span className="live-badge-dot" />
                Live
              </span>
            ) : (
              <span className="expired-badge">Ended</span>
            )}
            <span className="poll-meta-sep" />
            <span>{formatDate(poll.createdAt)}</span>
            <span className="poll-meta-sep" />
            <span>
              {poll.totalVotes} vote{poll.totalVotes !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Countdown timer */}
          {timeLeft && !isExpired && (
            <div className="countdown-bar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12,6 12,12 16,14"/>
              </svg>
              <span>Ends in {timeLeft}</span>
            </div>
          )}
          {isExpired && poll.expiresAt && (
            <div className="countdown-bar ended">
              Voting has ended
            </div>
          )}
        </div>

        {/* Live stats bar */}
        <LiveStats
          viewers={viewers}
          velocity={liveVelocity}
          activity={activity}
          totalVotes={poll.totalVotes}
        />

        {error && <div className="error-message">{error}</div>}

        {/* Voting UI */}
        {!hasVoted && !isExpired && (
          <>
            <div className="vote-options">
              {poll.options.map((opt, i) => (
                <button
                  key={i}
                  className="vote-option-btn"
                  onClick={() => handleVote(i)}
                  disabled={voting}
                >
                  {voting ? 'Voting...' : opt.text}
                </button>
              ))}
            </div>
            <p className="hint">Pick an option to vote. Results appear after.</p>
          </>
        )}

        {/* Expired but not voted */}
        {!hasVoted && isExpired && (
          <>
            <ResultsBar
              options={poll.options}
              totalVotes={poll.totalVotes}
              votedOption={null}
              prevOptions={null}
            />
            <p className="hint">This poll has ended. Here are the final results.</p>
          </>
        )}

        {/* Results after voting */}
        {hasVoted && (
          <>
            <ResultsBar
              options={poll.options}
              totalVotes={poll.totalVotes}
              votedOption={votedOption}
              prevOptions={prevOptions}
            />
            <p className="hint">Results update live as others vote.</p>
          </>
        )}

        <ShareLink shareId={shareId} pollQuestion={poll.question} />
      </div>
    </div>
  );
}

export default PollView;
