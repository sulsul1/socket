const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// Render에서는 process.env.PORT를 사용해야 합니다.
const PORT = process.env.PORT || 3000;

const io = socketIo(server, {
    cors: {
        // [중요] CORS Origin은 '도메인'까지만 적어야 합니다. (뒤에 /newsulsul 경로 빼야 함)
        // https://sulsul.pe.kr 에서 접속을 허용합니다.
        origin: ["https://sulsul.pe.kr", "http://localhost:8080"], 
        methods: ["GET", "POST"],
        credentials: true
    }
});

// === [게임 로직 변수] ===
let waitingPlayer = null; // 대기 중인 플레이어 (1명)

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

            console.log(`⚔️ 매칭 성사: [${roomName}] ${opponent.id} vs ${socket.id}`);

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
            console.log(`⏳ 대기 중: ${socket.id}`);
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
        // data = { room, name, msg }
        console.log(`💬 메시지: [${data.room}] ${data.name}: ${data.msg}`);
        // 나를 포함한 방 안의 모든 사람에게 전송
        io.to(data.room).emit('receive_msg', data);
    });

    // (3) 메모장 위치 이동 중계 (드래그)
    socket.on('memo_move', (data) => {
        // data = { room, x, y }
        // 나를 제외한 같은 방 사람들에게만 전송 (나는 이미 움직였으므로)
        socket.to(data.room).emit('memo_update_pos', data);
    });

    // (4) 메모장 글씨 쓰기 중계
    socket.on('memo_text', (data) => {
        // data = { room, text }
        // 나를 제외한 같은 방 사람들에게만 전송
        socket.to(data.room).emit('memo_update_text', data);
    });


    // ==========================================
    // 3. 접속 종료 처리
    // ==========================================
    socket.on('disconnect', () => {
        // 게임 대기 중이던 사람이면 대기열 비우기
        if (waitingPlayer === socket) {
            waitingPlayer = null;
        }
        console.log(`❌ 퇴장: ${socket.id}`);
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});