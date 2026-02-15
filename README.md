# PollRoom - Real-Time Poll Rooms

A full-stack web application for creating live polls, sharing them via link, and collecting votes with real-time results. Built with React, Express, Socket.IO, and MongoDB.

**Live Demo**: _[Your Render URL here]_

---

## Features

### Core
- **Poll Creation** - Create polls with a question and 2–10 options
- **Shareable Links** - Every poll gets a short URL (`/poll/Ab3xK9qP`)
- **Single-Choice Voting** - One vote per user per poll
- **Real-Time Results** - All viewers see vote counts update instantly via WebSocket (Socket.IO)
- **Persistence** - Polls and votes stored in MongoDB; share links work permanently

### USP / Extra Features
- **Explore Feed** - Browse recent public polls at `/explore` with pagination and "Active only" filter
- **Voting Deadline** - Optional timer (15 min / 1 hr / 6 hr / 24 hr / 7 days) with live countdown
- **Live Analytics Dashboard** - Real-time viewer count, vote velocity (votes/min), and SVG sparkline showing vote trends
- **Live Percentage Deltas** - When a vote arrives, each option shows `+2.1%` or `-1.5%` change in real time
- **Smart Share UX** - Copy link, WhatsApp share button, and QR code generation
- **Dynamic OG Tags** - In production, poll pages inject dynamic Open Graph meta tags for rich previews on WhatsApp, Slack, Twitter, etc.

---

## Fairness / Anti-Abuse Mechanisms

### Mechanism 1: Browser Fingerprint (Visitor ID)
- **What it does**: On first visit, the app generates a `crypto.randomUUID()` and stores it in `localStorage` as a persistent `visitorId`. This ID is sent with every vote request.
- **How it prevents abuse**: A unique compound index on `(pollId, visitorId)` in MongoDB enforces one vote per browser per poll at the database level. Even if the API is called directly, the database rejects duplicate votes with a `409 Conflict`.
- **Known limitation**: Clearing localStorage or using incognito mode generates a new visitorId, allowing the same person to vote again from the same device. This is a deliberate trade-off - we don't require user accounts/login for frictionless UX.

### Mechanism 2: IP-Based Rate Limiting
- **What it does**: Uses `express-rate-limit` to limit voting requests to **5 votes per IP address per 15-minute window**. A separate general API limiter caps all API requests at **60 per minute per IP**.
- **How it prevents abuse**: Even if someone rotates browser fingerprints (via incognito/clearing storage), they can only cast 5 votes every 15 minutes from the same IP. This stops automated scripts and rapid abuse from a single network.
- **Known limitation**: Users behind the same NAT/corporate network share an IP and would collectively hit the limit. The rate is generous enough (5/15min) to accommodate small shared networks without impacting legitimate users.

### Additional Layer: Server-Side Expiry Enforcement
- Timed polls cannot be voted on after the deadline, enforced server-side (`403 Forbidden`). The client disables voting visually, but the server is the source of truth.

---

## Edge Cases Handled

1. **Race condition on duplicate votes** - Even if two identical vote requests arrive simultaneously, the MongoDB unique index (`pollId + visitorId`) guarantees only one succeeds. The `11000` duplicate key error is caught and returns a clean `409`.
2. **Poll not found** - Returns a `404` with a user-friendly "Poll not found" page and a link back to create a new one.
3. **Empty/invalid options** - Trims whitespace and filters empty strings. Validates at least 2 non-empty options server-side.
4. **Question length** - Capped at 500 characters both client-side (`maxLength`) and server-side.
5. **Option count** - Validated at 2–10 options via Mongoose schema validator.
6. **Expired poll voting** - Server checks `expiresAt` before accepting votes. Client shows countdown and disables buttons.
7. **Viewer count accuracy** - Uses Socket.IO's `disconnecting` event (not `disconnect`) to ensure room size is updated after the socket has actually left.
8. **IP privacy** - IPs are SHA-256 hashed (first 16 chars) before storage. Raw IPs are never persisted.
9. **XSS in OG tags** - Dynamic OG meta values are escaped (`"` → `&quot;`, `<` → `&lt;`) before injection.
10. **SPA routing** - The Express server has a wildcard fallback (`*`) to serve `index.html` for all client-side routes.

---

## Known Limitations / Future Improvements

- **No user accounts** - Voting relies on localStorage fingerprinting, not authentication. Adding optional accounts (OAuth) would enable stronger abuse prevention and poll management (edit/delete).
- **VPN/proxy circumvention** - Users can bypass IP rate limiting with VPNs. A CAPTCHA challenge on vote could mitigate this for high-traffic polls.
- **No poll editing/deletion** - Once created, polls cannot be modified. Adding creator tokens (stored in localStorage) would enable this without requiring accounts.
- **Single-server Socket.IO** - Currently runs on a single Node.js instance. For horizontal scaling, Socket.IO would need a Redis adapter (`@socket.io/redis-adapter`) to share state across instances.
- **No real-time feed** - The explore feed is fetched via REST polling. Adding Socket.IO events for new poll creation would make the feed truly live.
- **Analytics retention** - Vote activity is queried from the Vote collection directly. For high-volume polls, a dedicated time-series collection or Redis sorted sets would improve performance.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, React Router v7 |
| Styling | Vanilla CSS with CSS custom properties |
| Real-Time | Socket.IO (WebSocket + polling fallback) |
| Backend | Express.js, Node.js |
| Database | MongoDB Atlas (via Mongoose) |
| Security | Helmet, CORS, express-rate-limit |
| ID Generation | nanoid (8-char share IDs) |

---

## Project Structure

```
pollroom/
├── package.json              # Root: dev/build/start scripts
├── .env                      # MONGODB_URI, PORT, NODE_ENV
├── .gitignore
├── README.md
├── server/
│   ├── package.json
│   ├── index.js              # Express + Socket.IO server
│   ├── models/
│   │   ├── Poll.js           # Poll schema (question, options, expiry)
│   │   └── Vote.js           # Vote schema (unique compound index)
│   ├── routes/
│   │   └── polls.js          # REST endpoints (CRUD, feed, activity)
│   └── middleware/
│       └── rateLimiter.js    # IP rate limiting
└── client/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css          # Design system
        └── components/
            ├── CreatePoll.jsx  # Poll creation form
            ├── PollView.jsx    # Vote + results + live dashboard
            ├── ResultsBar.jsx  # Animated results bars
            ├── ShareLink.jsx   # Copy, WhatsApp, QR sharing
            ├── LiveStats.jsx   # Viewer count, velocity, sparkline
            └── ExploreFeed.jsx # Browse public polls
```

---

## Local Development

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd pollroom

# 2. Install dependencies
npm run install:all

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your MongoDB URI

# 4. Start development servers (client + server concurrently)
npm run dev

# Client: http://localhost:5173
# Server: http://localhost:3001
```

---

## Deployment (Render.com)

This app is designed to deploy as a **single Render Web Service**. The Express server serves the Vite-built React frontend in production.

### Steps

1. Push code to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Configure:
   - **Build Command**: `npm run render-build`
   - **Start Command**: `npm start`
   - **Environment Variables**:
     - `MONGODB_URI` = your MongoDB Atlas connection string
     - `NODE_ENV` = `production`
5. Deploy

### Why not Vercel?
Vercel uses serverless functions which don't support persistent WebSocket connections (Socket.IO). Render provides a full Node.js server with WebSocket support on the free tier.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/polls` | Create a new poll |
| `GET` | `/api/polls/feed` | Browse recent public polls (paginated) |
| `GET` | `/api/polls/:shareId` | Get poll by share ID |
| `GET` | `/api/polls/:shareId/activity` | Get vote activity & velocity |
| `POST` | `/api/polls/:shareId/vote` | Cast a vote |

## WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `poll:join` | Client → Server | Join a poll room |
| `poll:leave` | Client → Server | Leave a poll room |
| `vote:update` | Server → Client | New vote broadcast |
| `viewers:count` | Server → Client | Updated viewer count |

---

## License

MIT
