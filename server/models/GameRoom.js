const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  socketId: { type: String, required: true },
  username: { type: String, required: true },
  score: { type: Number, default: 0 },
  avatar: { type: String, default: '' },
  hasGuessedCorrectly: { type: Boolean, default: false },
});

const roundSchema = new mongoose.Schema({
  roundNumber: { type: Number },
  word: { type: String },
  drawer: { type: String }, // username
  correctGuessers: [{ type: String }],
  startedAt: { type: Date },
  endedAt: { type: Date },
});

const gameRoomSchema = new mongoose.Schema(
  {
    roomCode: { type: String, required: true, unique: true },
    roomName: { type: String, default: 'Drawing Room' },
    players: [playerSchema],
    status: {
      type: String,
      enum: ['waiting', 'playing', 'finished'],
      default: 'waiting',
    },
    currentRound: { type: Number, default: 0 },
    totalRounds: { type: Number, default: 3 },
    currentWord: { type: String, default: '' },
    currentDrawer: { type: String, default: '' }, // socketId
    roundHistories: [roundSchema],
    maxPlayers: { type: Number, default: 8 },
    roundDuration: { type: Number, default: 80 }, // seconds
    hostSocketId: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GameRoom', gameRoomSchema);
