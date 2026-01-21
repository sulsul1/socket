/**
 * server.js - 실시간 통신 중계 서버
 * PHP (Backend) -> Node.js (Relay) -> Client (Frontend)
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');

// 앱 초기화
const app = express();
const server = http.createServer(app);

// 1. CORS 설정 (PHP 서버와 클라이언트가 다른 도메인/포트일 경우 필수)
app.use(cors());
app.use(bodyParser.json()); // JSON 데이터 파싱용

// 2. Socket.io 설정
const io = new Server(server, {
    cors: {
        origin: ["https://sulsul.pe.kr", "http://localhost:8080"], 
        methods: ["GET", "POST"],
        credentials: true
    }
});

// =========================================================
// [A] 소켓 연결 처리 (클라이언트 <-> 노드 서버)
// =========================================================
io.on('connection', (socket) => {
    console.log(`[Connect] Socket ID: ${socket.id}`);

    // 클라이언트가 "join_class" 이벤트를 보내면 해당 방(Room)에 입장시킴
    socket.on('join_class', (classId) => {
        if (!classId) return;
        
        const roomName = `class_${classId}`;
        socket.join(roomName);
        console.log(`[Join] Socket ${socket.id} joined room: ${roomName}`);
    });

    socket.on('disconnect', () => {
        console.log(`[Disconnect] Socket ID: ${socket.id}`);
    });
});

// =========================================================
// [B] 방송 API (PHP 서버 -> 노드 서버 -> 클라이언트)
// =========================================================
// PHP의 socket_helper.php가 이 주소(http://localhost:3000/broadcast)로 데이터를 쏘면
// Node.js가 받아서 소켓 룸에 뿌려줍니다.
app.post('/broadcast', (req, res) => {
    const { class_id, event_type, data } = req.body;

    // 유효성 검사
    if (!class_id || !event_type) {
        console.error('[Error] Missing class_id or event_type');
        return res.status(400).json({ success: false, error: 'Missing parameters' });
    }

    const roomName = `class_${class_id}`;

    // 해당 반(Room)에 있는 모든 소켓에게 이벤트 발송
    io.to(roomName).emit(event_type, data);

    console.log(`[Broadcast] To: ${roomName} | Event: ${event_type}`, data);
    
    // PHP에게 성공 응답
    res.json({ success: true });
});

// =========================================================
// [C] 서버 실행
// =========================================================
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`-----------------------------------------------`);
    console.log(`🚀 Node.js Socket Server running on port ${PORT}`);
    console.log(`👉 POST Endpoint: http://localhost:${PORT}/broadcast`);
    console.log(`-----------------------------------------------`);
});