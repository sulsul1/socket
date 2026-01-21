const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// [중요 1] Render가 주는 포트를 쓰거나, 없으면 3000번 사용
const PORT = process.env.PORT || 3000;

const io = socketIo(server, {
    cors: {
        // [중요 2] 주소 뒤에 /newsulsul 같은 경로는 빼야 합니다!
        origin: ["https://sulsul.pe.kr", "http://localhost:8080"], 
        methods: ["GET", "POST"],
        credentials: true
    }
});

// === [게임 로직 변수] ===
let waitingPlayer = null; 

io.on('connection', (socket) => {
    console.log(`✅ 접속: ${socket.id}`);

    // ==========================================
    // 1. [기존] 1:1 반응속도 게임 로직
    // ==========================================
    socket.on('join_battle', (name) => {
        if (waitingPlayer) {
            const opponent = waitingPlayer;
            const roomName = `battle_${opponent.id}_${socket.id}`;

            socket.join(roomName);
            opponent.join(roomName);

            io.to(roomName).emit('game_ready', { 
                room: roomName,
                p1: opponent.id,
                p2: socket.id
            });

            waitingPlayer = null;

            const randomDelay = Math.floor(Math.random() * 3000) + 3000;
            setTimeout(() => {
                io.to(roomName).emit('game_go', { timestamp: Date.now() });
            }, randomDelay);

        } else {
            waitingPlayer = socket;
            socket.emit('waiting', { msg: '상대방을 기다리는 중...' });
        }
    });

    socket.on('player_click', (data) => {
        io.to(data.room).emit('game_over', { 
            winner: socket.id, 
            time: data.reactionTime 
        });
    });

    // ==========================================
    // 2. [추가] 채팅방 & 공유 메모장 로직 (chat1.html용)
    // ==========================================
    
    // (1) 방 입장
    socket.on('join_class', (roomName) => {
        socket.join(roomName);
        console.log(`🏫 채팅방 입장: [${roomName}] ${socket.id}`);
    });

    // (2) 채팅 메시지 중계
    socket.on('send_msg', (data) => {
        // 나를 포함한 방 안의 모든 사람에게 전송
        io.to(data.room).emit('receive_msg', data);
    });

    // (3) 메모장 위치 이동 중계 (드래그)
    socket.on('memo_move', (data) => {
        // 나를 제외한 같은 방 사람들에게만 전송
        socket.to(data.room).emit('memo_update_pos', data);
    });

    // (4) 메모장 글씨 쓰기 중계
    socket.on('memo_text', (data) => {
        // 나를 제외한 같은 방 사람들에게만 전송
        socket.to(data.room).emit('memo_update_text', data);
    });


    // ==========================================
    // 3. 접속 종료 처리
    // ==========================================
    socket.on('disconnect', () => {
        if (waitingPlayer === socket) {
            waitingPlayer = null;
        }
        console.log(`❌ 퇴장: ${socket.id}`);
    });
});

// [중요 3] 고정된 3000번 대신 변수(PORT) 사용
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});