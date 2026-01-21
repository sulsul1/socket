const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = socketIo(server, {
    cors: {
        origin: ["http://localhost:8080", "http://127.0.0.1:8080"], 
        methods: ["GET", "POST"],
        credentials: true
    }
});

// === [게임 로직 변수] ===
let waitingPlayer = null; // 대기 중인 플레이어 (1명)

io.on('connection', (socket) => {
    console.log(`✅ 접속: ${socket.id}`);

    // 1. 게임 참가 요청
    socket.on('join_battle', (name) => {
        // 이미 대기자가 있는 경우 (매칭 성사!)
        if (waitingPlayer) {
            const opponent = waitingPlayer;
            const roomName = `battle_${opponent.id}_${socket.id}`;

            // 두 명 다 같은 방으로 이동
            socket.join(roomName);
            opponent.join(roomName);

            console.log(`⚔️ 매칭 성사: [${roomName}] ${opponent.id} vs ${socket.id}`);

            // 게임 시작 신호 전송
            io.to(roomName).emit('game_ready', { 
                room: roomName,
                p1: opponent.id,
                p2: socket.id
            });

            // 대기열 초기화
            waitingPlayer = null;

            // 3~6초 뒤에 'GO' 신호 보내기 (서버에서 랜덤 타이머)
            const randomDelay = Math.floor(Math.random() * 3000) + 3000;
            setTimeout(() => {
                io.to(roomName).emit('game_go', { timestamp: Date.now() });
            }, randomDelay);

        } else {
            // 대기자가 없는 경우 (내가 대기자가 됨)
            waitingPlayer = socket;
            socket.emit('waiting', { msg: '상대방을 기다리는 중...' });
            console.log(`⏳ 대기 중: ${socket.id}`);
        }
    });

    // 2. 플레이어 클릭 (승패 판정)
    socket.on('player_click', (data) => {
        // data = { room: '...', reactionTime: 0.123 }
        
        // 가장 먼저 클릭한 사람의 메시지가 먼저 도착함
        // 즉시 게임 종료 및 결과 통보 broadcast
        io.to(data.room).emit('game_over', { 
            winner: socket.id, 
            time: data.reactionTime 
        });
    });

    // 접속 끊김 처리
    socket.on('disconnect', () => {
        // 만약 대기 중이던 사람이 나갔다면 대기열 비우기
        if (waitingPlayer === socket) {
            waitingPlayer = null;
        }
    });
});

server.listen(3000, () => {
    console.log('🚀 Game Server running on port 3000');
});