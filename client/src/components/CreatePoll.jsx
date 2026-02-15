import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ShareLink from './ShareLink';

const API_BASE = '/api/polls';

const DURATION_OPTIONS = [
  { value: 0, label: 'No time limit' },
  { value: 15, label: '15 minutes' },
  { value: 60, label: '1 hour' },
  { value: 360, label: '6 hours' },
  { value: 1440, label: '24 hours' },
  { value: 10080, label: '7 days' },
];

function CreatePoll() {
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdPoll, setCreatedPoll] = useState(null);

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index, value) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedQuestion = question.trim();
    const trimmedOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);

    if (!trimmedQuestion) {
      setError('Please enter a question.');
      return;
    }

    if (trimmedOptions.length < 2) {
      setError('At least 2 non-empty options are required.');
      return;
    }

    setLoading(true);

    try {
      const body = { question: trimmedQuestion, options: trimmedOptions };
      if (duration > 0) body.duration = duration;

      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create poll.');
      setCreatedPoll(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (createdPoll) {
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
          <div className="created-wrap">
            <div className="created-check">&#10003;</div>
            <h2 className="created-title">Poll created</h2>
            <p className="created-desc">Share the link to start collecting votes.</p>
          </div>

          <div style={{ marginBottom: 24 }}>
            <p className="poll-question" style={{ textAlign: 'center', fontSize: 18 }}>
              {createdPoll.poll.question}
            </p>
            <div className="poll-meta" style={{ justifyContent: 'center' }}>
              <span>{createdPoll.poll.options.length} options</span>
              <span className="poll-meta-sep" />
              <span>0 votes</span>
              {createdPoll.poll.expiresAt && (
                <>
                  <span className="poll-meta-sep" />
                  <span>Timed poll</span>
                </>
              )}
            </div>
          </div>

          <ShareLink shareId={createdPoll.poll.shareId} pollQuestion={createdPoll.poll.question} />

          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              className="btn btn-primary btn-full"
              onClick={() => navigate(`/poll/${createdPoll.poll.shareId}`)}
            >
              Go to poll
            </button>
            <button
              className="btn btn-text btn-full"
              onClick={() => {
                setCreatedPoll(null);
                setQuestion('');
                setOptions(['', '']);
                setDuration(0);
              }}
            >
              Create another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container fade-in">
      <nav className="nav">
        <Link to="/" className="logo-link">
          <div className="logo-mark">P</div>
          <span className="logo-wordmark">PollRoom</span>
        </Link>
        <Link to="/explore" className="nav-link">Explore</Link>
      </nav>

      <h1 className="page-title">New poll</h1>
      <p className="page-desc">
        Ask your question, add options, and share the link. Votes show up in real time.
      </p>

      <div className="card">
        <form onSubmit={handleSubmit} id="create-poll-form">
          {error && <div className="error-message">{error}</div>}

          <div className="field">
            <label htmlFor="poll-question" className="field-label">
              Question
            </label>
            <input
              id="poll-question"
              type="text"
              className="input input-lg"
              placeholder="e.g. Where should we eat tonight?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={500}
              autoFocus
            />
          </div>

          <div className="field">
            <label className="field-label">Options</label>
            <div className="options-list">
              {options.map((opt, i) => (
                <div key={i} className="option-row">
                  <span className="option-idx">{i + 1}</span>
                  <input
                    type="text"
                    className="input option-input"
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                    maxLength={200}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      className="btn-remove"
                      onClick={() => removeOption(i)}
                      aria-label={`Remove option ${i + 1}`}
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 10 && (
              <button
                type="button"
                className="btn btn-text btn-full"
                onClick={addOption}
              >
                + Add option
              </button>
            )}
          </div>

          <div className="field">
            <label htmlFor="poll-duration" className="field-label">
              Voting deadline
            </label>
            <select
              id="poll-duration"
              className="input select"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              {DURATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading}
            id="submit-poll-btn"
          >
            {loading ? 'Creating...' : 'Create poll'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default CreatePoll;
