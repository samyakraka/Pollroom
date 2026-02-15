require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

const pollRoutes = require('./routes/polls');
const Poll = require('./models/Poll');
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();
const server = http.createServer(app);

const isProd = process.env.NODE_ENV === 'production';

// ─── Socket.IO ───
const io = new Server(server, {
  cors: {
    origin: isProd ? false : ['http://localhost:5173'],
    methods: ['GET', 'POST'],
  },
});

app.set('io', io);

// ─── Helper: Get room viewer count ───
async function getRoomSize(roomName) {
  const room = io.sockets.adapter.rooms.get(roomName);
  return room ? room.size : 0;
}

// ─── Socket.IO Events ───
io.on('connection', (socket) => {
  console.log(`⚡ Client connected: ${socket.id}`);

  socket.on('poll:join', async (shareId) => {
    const roomName = `poll:${shareId}`;
    socket.join(roomName);

    // Broadcast updated viewer count to the room
    const viewerCount = await getRoomSize(roomName);
    io.to(roomName).emit('viewers:count', { count: viewerCount });

    console.log(`📊 ${socket.id} joined ${roomName} (${viewerCount} viewers)`);
  });

  socket.on('poll:leave', async (shareId) => {
    const roomName = `poll:${shareId}`;
    socket.leave(roomName);

    const viewerCount = await getRoomSize(roomName);
    io.to(roomName).emit('viewers:count', { count: viewerCount });

    console.log(`👋 ${socket.id} left ${roomName}`);
  });

  socket.on('disconnecting', () => {
    // Broadcast updated viewer count to all rooms this socket was in
    for (const room of socket.rooms) {
      if (room.startsWith('poll:') && room !== socket.id) {
        // Defer to after disconnect so count is accurate
        setTimeout(async () => {
          const viewerCount = await getRoomSize(room);
          io.to(room).emit('viewers:count', { count: viewerCount });
        }, 100);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// ─── Middleware ───
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: isProd ? false : 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', apiLimiter);

// ─── Routes ───
app.use('/api/polls', pollRoutes);

// ─── Serve static files in production with OG tag injection ───
if (isProd) {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));

  // Dynamic OG tags for poll pages (for link previews on social/messaging apps)
  app.get('/poll/:shareId', async (req, res) => {
    try {
      const poll = await Poll.findOne({ shareId: req.params.shareId }).lean();
      let html = fs.readFileSync(path.join(clientDist, 'index.html'), 'utf-8');

      if (poll) {
        const title = `${poll.question} — PollRoom`;
        const description = `Vote now! ${poll.options.map((o) => o.text).join(', ')} — ${poll.totalVotes} votes so far.`;
        const url = `${req.protocol}://${req.get('host')}/poll/${poll.shareId}`;

        const ogTags = `
    <meta property="og:title" content="${title.replace(/"/g, '&quot;')}" />
    <meta property="og:description" content="${description.replace(/"/g, '&quot;')}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="PollRoom" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${title.replace(/"/g, '&quot;')}" />
    <meta name="twitter:description" content="${description.replace(/"/g, '&quot;')}" />
    <title>${title.replace(/</g, '&lt;')}</title>`;

        html = html.replace('</head>', `${ogTags}\n  </head>`);
      }

      res.send(html);
    } catch {
      res.sendFile(path.join(clientDist, 'index.html'));
    }
  });

  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ─── Connect to MongoDB & Start Server ───
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined. Please add it to your .env file.');
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
