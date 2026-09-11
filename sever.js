// Cài đặt thư viện trước khi chạy: npm install express socket.io @tobiasmuecksch/tiktok-live-connector

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('@tobiasmuecksch/tiktok-live-connector');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

let tiktokConnection = null;

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('connect-tiktok', (username) => {
    if (tiktokConnection) {
      tiktokConnection.disconnect();
    }

    tiktokConnection = new WebcastPushConnection(username);

    tiktokConnection.connect().then(state => {
      console.log(`Connected to TikTok Live: ${username} (Room ID: ${state.roomId})`);
      socket.emit('status', { connected: true, username });
    }).catch(err => {
      console.error('Failed to connect:', err);
      socket.emit('status', { connected: false, error: err.toString() });
    });

    // Lắng nghe sự kiện Chat từ TikTok
    tiktokConnection.on('chat', data => {
      const commentData = {
        id: data.msgId || Date.now() + Math.random(),
        nickname: data.nickname,
        uniqueId: data.uniqueId,
        comment: data.comment,
        profilePictureUrl: data.profilePictureUrl
      };
      // Gửi comment tới tất cả client đang kết nối
      io.emit('new-comment', commentData);
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
