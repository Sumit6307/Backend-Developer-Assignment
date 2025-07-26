const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory store for table locks
const tableLocks = new Map();

app.use(bodyParser.json());

// POST /api/tables/lock
app.post('/api/tables/lock', (req, res) => {
  const { tableId, userId, duration } = req.body;

  // Input validation
  if (!tableId || !userId || !duration || isNaN(duration) || duration <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid request: tableId, userId, and valid duration (in seconds) are required'
    });
  }

  // Check if table is already locked and not expired
  const existingLock = tableLocks.get(tableId);
  if (existingLock && existingLock.expiry > Date.now()) {
    return res.status(409).json({
      success: false,
      message: 'Table is currently locked by another user.'
    });
  }

  // Create new lock
  const expiry = Date.now() + (duration * 1000);
  tableLocks.set(tableId, { userId, expiry });

  res.status(200).json({
    success: true,
    message: 'Table locked successfully.'
  });
});

// POST /api/tables/unlock
app.post('/api/tables/unlock', (req, res) => {
  const { tableId, userId } = req.body;

  // Input validation
  if (!tableId || !userId) {
    return res.status(400).json({
      success: false,
      message: 'Invalid request: tableId and userId are required'
    });
  }

  const lock = tableLocks.get(tableId);

  // Check if lock exists and is not expired
  if (!lock || lock.expiry < Date.now()) {
    tableLocks.delete(tableId); // Clean up expired lock if exists
    return res.status(404).json({
      success: false,
      message: 'No active lock found for this table'
    });
  }

  // Verify userId matches
  if (lock.userId !== userId) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized: Only the user who locked the table can unlock it'
    });
  }

  // Remove lock
  tableLocks.delete(tableId);

  res.status(200).json({
    success: true,
    message: 'Table unlocked successfully.'
  });
});

// GET /api/tables/:tableId/status
app.get('/api/tables/:tableId/status', (req, res) => {
  const { tableId } = req.params;

  if (!tableId) {
    return res.status(400).json({
      success: false,
      message: 'Invalid request: tableId is required'
    });
  }

  const lock = tableLocks.get(tableId);
  const isLocked = lock && lock.expiry > Date.now();

  // Clean up expired lock
  if (lock && lock.expiry <= Date.now()) {
    tableLocks.delete(tableId);
  }

  res.status(200).json({
    isLocked
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});