import { io, Socket } from 'socket.io-client';

// Single shared socket instance
const socket: Socket = io('/', { autoConnect: true, transports: ['websocket', 'polling'] });

export default socket;
