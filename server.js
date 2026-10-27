/**
 * server.js - 실시간 통신 중계 서버
 * PHP (Backend) -> Node.js (Relay) -> Client (Frontend)
 *
 * 2026-10-20 보안 · 잠 깨우기
 *  - SOCKET_KEY (Render 환경 변수) 를 넣으면 켜진다. 비워 두면 예전처럼 누구나 보내고 들어온다.
 *    ★이 저장소는 공개라 열쇠를 코드에 적지 않는다 — Render › Environment 에만.
 *  - /broadcast : 몸에 key 가 SOCKET_KEY 와 같아야 보낸다(술술 PHP socket_helper.php 만 안다).
 *  - join_class(방 번호, 표) : 술술이 준 표(만료 시각.HMAC)가 맞아야 방에 들어간다.
 *    방에는 아이들이 쓴 답 · 이름이 오가므로, 반 번호만 알면 누구나 엿듣던 것을 막는다.
 *  - /health : 깨우기 · 살아 있나 보기(술술 PHP 가 수업 시간에 10분마다 두드린다).
 *  - 기록(로그)에는 방 · 소식 이름만 — 아이들 답 · 이름은 남기지 않는다.
 */

const express = require('express');
const http = require('http');
const crypto = require('crypto');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: '1mb' }));      // 실시간 보기 — 아이 답 · 획이 실린다

const io = new Server(server, {
    cors: {
        origin: ["https://sulsul.pe.kr", "https://www.sulsul.pe.kr", "http://localhost:8080"],
        methods: ["GET", "POST"],
        credentials: true
    }
});

const KEY = process.env.SOCKET_KEY || '';

/** 길이까지 같은지 — 시간으로 알아내지 못하게 */
function same(a, b) {
    const x = Buffer.from(String(a)), y = Buffer.from(String(b));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}
/** 방 표 — '만료(초).HMAC-SHA256(KEY, 방|만료)' (술술 socket_helper.php sulsul_socket_ticket 과 짝) */
function ticketOk(room, t) {
    if (!KEY) return true;
    const m = /^(\d{9,11})\.([0-9a-f]{64})$/.exec(String(t || ''));
    if (!m || Number(m[1]) * 1000 < Date.now()) return false;
    const sig = crypto.createHmac('sha256', KEY).update(room + '|' + m[1]).digest('hex');
    return same(sig, m[2]);
}

// =========================================================
// [A] 소켓 연결 처리 (클라이언트 <-> 노드 서버)
// =========================================================
io.on('connection', (socket) => {
    socket.on('join_class', (classId, ticket) => {
        const room = String(classId ?? '');
        if (!/^\d{1,12}$/.test(room)) return;
        if (!ticketOk(room, ticket)) { socket.emit('join_denied', { room }); return; }
        socket.join(`class_${room}`);
    });
    //  [A-2] 전시관 «함께 보기»(2026-10-27) — 표를 보이고 들어온 전시관 방(900000 이상)에서만, 정해진 소식(곰 자리 · 말 · 바뀜 알림)만,
    //   너무 잦지 않게(0.12초) · 작게(8KB) 같은 방 사람들에게 건넨다. 열쇠가 필요한 /broadcast 를 화면이 쓰지 않아도 된다.
    socket.on('room_emit', (classId, ev, data) => {
        const room = String(classId ?? ''), name = String(ev ?? '');
        if (!/^\d{6,12}$/.test(room) || Number(room) < 900000) return;
        if (!PEER_EVENTS.has(name) || !socket.rooms.has(`class_${room}`)) return;
        const now = Date.now();
        if (now - (socket.data.peerAt || 0) < 120) return;
        socket.data.peerAt = now;
        let size = 0;
        try { size = JSON.stringify(data ?? null).length; } catch (e) { return; }
        if (size > 8000) return;
        socket.to(`class_${room}`).emit(name, data);
    });
});
const PEER_EVENTS = new Set(['exhb_move', 'exhb_say', 'exhb_art']);

// =========================================================
// [B] 방송 API (PHP 서버 -> 노드 서버 -> 클라이언트)
// =========================================================
app.post('/broadcast', (req, res) => {
    const { class_id, event_type, data, key } = req.body || {};
    if (KEY && !same(key || '', KEY)) return res.status(403).json({ success: false, error: 'bad key' });
    if (!class_id || !event_type) return res.status(400).json({ success: false, error: 'Missing parameters' });
    io.to(`class_${class_id}`).emit(String(event_type), data);
    res.json({ success: true });
});

app.get('/health', (req, res) => res.json({ ok: true, guard: !!KEY, t: Date.now() }));

// =========================================================
// [C] 서버 실행 — Render 는 PORT 를 준다
// =========================================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Socket relay on port ${PORT} · guard ${KEY ? 'ON' : 'off'}`);
});
