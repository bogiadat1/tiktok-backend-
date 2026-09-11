const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);

// Cấu hình Socket.IO cho phép mọi nguồn (CORS) kết nối
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

let tiktokLiveConnection = null;

// Route kiểm tra server có đang sống hay không
app.get('/', (req, res) => {
  res.send('Server TikTok Live TTS đang hoạt động!');
});

io.on('connection', (socket) => {
  console.log('Client mới kết nối:', socket.id);

  socket.on('connect-tiktok', (username) => {
    console.log(`Đang thử kết nối tới TikTok Live của: ${username}`);

    // Ngắt kết nối cũ nếu có
    if (tiktokLiveConnection) {
      try {
        tiktokLiveConnection.disconnect();
      } catch (e) {
        console.log('Lỗi khi ngắt kết nối cũ:', e);
      }
    }

    // Khởi tạo kết nối TikTok Live mới
    tiktokLiveConnection = new WebcastPushConnection(username);

    tiktokLiveConnection.connect().then(state => {
      console.log(`Đã kết nối thành công tới phòng Live của ${username} (Room ID: ${state.roomId})`);
      socket.emit('status', { 
        connected: true, 
        username: username,
        roomId: state.roomId 
      });
    }).catch(err => {
      console.error('Lỗi kết nối TikTok Live:', err);
      socket.emit('status', { 
        connected: false, 
        error: err.toString() 
      });
    });

    // Lắng nghe sự kiện người dùng gửi bình luận (chat)
    tiktokLiveConnection.on('chat', data => {
      const commentData = {
        id: data.msgId || Date.now() + Math.random(),
        nickname: data.nickname,
        uniqueId: data.uniqueId,
        comment: data.comment,
        profilePictureUrl: data.profilePictureUrl
      };
      
      console.log(`[${commentData.nickname}]: ${commentData.comment}`);
      
      // Phát bình luận tới tất cả các client Web đang mở
      io.emit('new-comment', commentData);
    });

    // Lắng nghe khi phiên Live kết thúc
    tiktokLiveConnection.on('streamEnd', () => {
      console.log('Phiên TikTok Live đã kết thúc.');
      socket.emit('status', { connected: false, message: 'Livestream đã kết thúc.' });
    });
  });

  socket.on('disconnect', () => {
    console.log('Client đã ngắt kết nối:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server Node.js đang chạy trên cổng ${PORT}`);
});
