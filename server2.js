const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// CORS 설정
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:8080", "http://127.0.0.1:8080"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// 1. (기존 기능) PHP에서 오는 알림 처리
app.post("/broadcast", (req, res) => {
  const { room, event, data } = req.body;
  io.to(room).emit(event, data);
  res.json({ status: "ok" });
});

io.on("connection", (socket) => {
  console.log(`✅ 접속: ${socket.id}`);

  // 방 입장
  socket.on("join_class", (roomName) => {
    socket.join(roomName);
    console.log(`➕ 입장: [${roomName}] ${socket.id}`);
  });

  // === [추가된 부분] 채팅 메시지 받고 뿌리기 ===
  socket.on("send_msg", (data) => {
    const { room, name, msg } = data;
    console.log(`💬 메시지: [${room}] ${name}: ${msg}`);

    // 나를 포함한 방 안의 모든 사람에게 전송 'receive_msg' 이벤트 발송
    io.to(room).emit("receive_msg", { name, msg, time: new Date() });
  });

  socket.on("disconnect", () => {
    console.log(`❌ 퇴장: ${socket.id}`);
  });

  socket.on("memo_move", (data) => {
    // data = { room: '...', x: 100, y: 200 }
    // 나를 제외한 같은 방 사람들에게 전송 (나는 이미 움직였으니까)
    socket.to(data.room).emit("memo_update_pos", data);
  });

  // [추가] 메모장 글씨 쓰기 중계
  socket.on("memo_text", (data) => {
    // data = { room: '...', text: '안녕하세요' }
    socket.to(data.room).emit("memo_update_text", data);
  });
});

server.listen(3000, () => {
  console.log("🚀 Socket Server running on port 3000");
});
