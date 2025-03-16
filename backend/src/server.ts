import express, { Request, Response } from 'express';
import http from 'http';
import cors from 'cors';
import { Server, Socket } from 'socket.io';

// --- Type Definitions ---
export type VideoEventType = 'play' | 'pause' | 'seek';

export interface VideoEventPayload {
    type: VideoEventType;
    currentTime: number; // in milliseconds
}

export interface RoomConfigPayload {
    roomId: string;
    videoUrl: string;
}

export interface RoomState extends RoomConfigPayload {
    lastKnownTime: number; // in ms
    state: 'playing' | 'paused';
}

export interface CreateRoomPayload extends RoomConfigPayload { }
export interface JoinRoomPayload {
    roomId: string;
}
export interface UpdateRoomPayload extends RoomConfigPayload { }

// --- In-Memory Room Store ---
// Map room ID to its current state.
const roomStore = new Map<string, RoomState>();

const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP server.
const server = http.createServer(app);

// Initialize Socket.IO.
const io = new Server(server, {
    cors: {
        origin: '*',
    },
});

// --- Helper: Update Room State ---
function updateRoomState(roomId: string, event: VideoEventPayload): void {
    const room = roomStore.get(roomId);
    if (room) {
        // Update lastKnownTime and state based on event.
        if (event.type === 'play') {
            room.state = 'playing';
            room.lastKnownTime = event.currentTime;
        } else if (event.type === 'pause') {
            room.state = 'paused';
            room.lastKnownTime = event.currentTime;
        } else if (event.type === 'seek') {
            // On seek, update lastKnownTime; state remains unchanged.
            room.lastKnownTime = event.currentTime;
        }
        roomStore.set(roomId, room);
    }
}

// Socket.IO connection handling.
io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    // Handle room creation.
    socket.on('createRoom', (data: CreateRoomPayload) => {
        const { roomId, videoUrl } = data;
        console.log(`Creating room ${roomId} with video URL ${videoUrl}`);
        // Initialize room state: starting at time 0 and paused.
        const roomState: RoomState = {
            roomId,
            videoUrl,
            lastKnownTime: 0,
            state: 'paused',
        };
        roomStore.set(roomId, roomState);
        socket.join(roomId);
        // Emit initial sync state to the creator.
        socket.emit('syncVideo', roomState);
    });

    // Handle joining a room.
    socket.on('joinRoom', (data: JoinRoomPayload) => {
        const { roomId } = data;
        socket.join(roomId);
        console.log(`Socket ${socket.id} joined room ${roomId}`);
        // If room exists, send current sync state to the joining client.
        const roomState = roomStore.get(roomId);
        if (roomState) {
            socket.emit('syncVideo', roomState);
        } else {
            // If the room doesn't exist, send an empty config.
            socket.emit('syncVideo', { roomId, videoUrl: '', lastKnownTime: 0, state: 'paused' });
        }
    });

    // Handle updates to room configuration (e.g. host changes video URL).
    socket.on('updateRoom', (data: UpdateRoomPayload) => {
        const { roomId, videoUrl } = data;
        console.log(`Updating room ${roomId} with new video URL ${videoUrl}`);
        const roomState = roomStore.get(roomId);
        if (roomState) {
            roomState.videoUrl = videoUrl;
            roomStore.set(roomId, roomState);
            // Broadcast updated room state to everyone in the room.
            io.to(roomId).emit('syncVideo', roomState);
        }
    });

    // Handle video events.
    socket.on('videoEvent', (data: VideoEventPayload) => {
        console.log(`Received video event from ${socket.id}:`, data);
        // Get all rooms this socket is in (exclude its own socket id).
        const rooms = Array.from(socket.rooms).filter((room) => room !== socket.id);
        rooms.forEach((roomId) => {
            // Update the room's current state.
            updateRoomState(roomId, data);
            // Broadcast the video event to all other sockets in the room.
            socket.to(roomId).emit('videoEvent', data);
        });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Health-check endpoint.
app.get('/', (req: Request, res: Response) => {
    res.send('Real-time Video Sync Backend is running.');
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
