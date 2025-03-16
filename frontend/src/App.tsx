import React, {
	useEffect,
	useRef,
	useState,
	ChangeEvent,
	FormEvent,
} from 'react';
import io, { Socket } from 'socket.io-client';

// Import Vidstack Player styles and components.
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import '@vidstack/react/player/styles/base.css';
import '@vidstack/react/player/styles/plyr/theme.css';

import { MediaPlayer, MediaProvider } from '@vidstack/react';
import {
	PlyrLayout,
	plyrLayoutIcons,
} from '@vidstack/react/player/layouts/plyr';

// --- Type Definitions ---
export type VideoEventType = 'play' | 'pause' | 'seek';

export interface VideoEventPayload {
	type: VideoEventType;
	currentTime: number; // in milliseconds
}

// Room state sent from backend to sync new joiners.
export interface RoomState {
	roomId: string;
	videoUrl: string;
	lastKnownTime: number; // in ms
	state: 'playing' | 'paused';
}

// Payload for creating a room.
interface CreateRoomPayload {
	roomId: string;
	videoUrl: string;
}

// Payload for joining a room.
interface JoinRoomPayload {
	roomId: string;
}

// --- Player Component ---
// Wraps Vidstack MediaPlayer. The src is driven by the room configuration.
interface PlayerProps {
	onPlay: (currentTime: number) => void;
	onPause: (currentTime: number) => void;
	onSeeked: (currentTime: number) => void;
	playerRef: React.RefObject<any>;
	videoUrl: string;
}

const Player: React.FC<PlayerProps> = ({
	onPlay,
	onPause,
	onSeeked,
	playerRef,
	videoUrl,
}) => {
	// Handlers capture local player events.
	const handlePlay = () => {
		const currentTime = playerRef.current?.currentTime || 0;
		console.log('Local play event at', currentTime);
		onPlay(currentTime * 1000); // seconds -> ms
	};

	const handlePause = () => {
		const currentTime = playerRef.current?.currentTime || 0;
		console.log('Local pause event at', currentTime);
		onPause(currentTime * 1000);
	};

	const handleSeeked = () => {
		const currentTime = playerRef.current?.currentTime || 0;
		console.log('Local seek event at', currentTime);
		onSeeked(currentTime * 1000);
	};

	return (
		<MediaPlayer
			ref={playerRef}
			onLoadedMetadata={() => console.log('loaded metadata')}
			onPlay={handlePlay}
			onPause={handlePause}
			onSeeked={handleSeeked}
			style={{
				width: '100vw',
				height: '100vh',
				backgroundColor: 'black',
			}}
			src={videoUrl}
		>
			<MediaProvider />
			<PlyrLayout icons={plyrLayoutIcons} />
		</MediaPlayer>
	);
};

const App: React.FC = () => {
	// If a "room" query parameter exists, we join that room; otherwise, we show a create room form.
	const searchParams = new URLSearchParams(window.location.search);
	const initialRoomId = searchParams.get('room') || '';
	const [roomId, setRoomId] = useState<string>(initialRoomId);
	const [videoUrl, setVideoUrl] = useState<string>('');
	const [isRoomCreated, setIsRoomCreated] = useState<boolean>(
		!!initialRoomId
	);

	const socketRef = useRef<Socket | null>(null);
	const playerRef = useRef<HTMLMediaElement>(null);

	// Setup Socket.IO connection.
	useEffect(() => {
		if (isRoomCreated && roomId) {
			const socket = io('http://localhost:4000');
			socketRef.current = socket;

			socket.on('connect', () => {
				console.log('Connected to backend via Socket.IO');
				// Join the room.
				socket.emit('joinRoom', { roomId });
			});

			// Listen for room state sync from backend.
			socket.on('syncVideo', (data: RoomState) => {
				console.log('Received syncVideo event:', data);
				setVideoUrl(data.videoUrl);
				// Wait for metadata to load before seeking.
				if (playerRef.current) {
					playerRef.current.currentTime = data.lastKnownTime / 1000;
					// Adjust play/pause state.
					if (data.state === 'playing') {
						playerRef.current
							.play()
							.catch((err) => console.error(err));
					} else {
						playerRef.current.pause();
					}
				}
			});

			// Listen for video events.
			socket.on('videoEvent', (data: VideoEventPayload) => {
				console.log('Received video event:', data);
				if (!playerRef.current) return;
				if (data.type === 'play') {
					playerRef.current.play().catch((err) => console.error(err));
				} else if (data.type === 'pause') {
					playerRef.current.pause();
				} else if (data.type === 'seek') {
					playerRef.current.currentTime = data.currentTime / 1000;
				}
			});

			return () => {
				socket.disconnect();
			};
		}
	}, [isRoomCreated, roomId]);

	// Handlers to send local video events.
	const handlePlay = (currentTime: number) => {
		console.log('Sending play event:', currentTime);
		socketRef.current?.emit('videoEvent', { type: 'play', currentTime });
	};

	const handlePause = (currentTime: number) => {
		console.log('Sending pause event:', currentTime);
		socketRef.current?.emit('videoEvent', { type: 'pause', currentTime });
	};

	const handleSeeked = (currentTime: number) => {
		console.log('Sending seek event:', currentTime);
		socketRef.current?.emit('videoEvent', { type: 'seek', currentTime });
	};

	// Handle room creation.
	const handleCreateRoom = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!roomId || !videoUrl) {
			alert('Please provide both a room ID and a video URL.');
			return;
		}
		// Establish socket connection and emit "createRoom" event.
		const socket = io('http://localhost:4000');
		socketRef.current = socket;

		socket.on('connect', () => {
			console.log('Connected to backend for room creation');
			socket.emit('createRoom', {
				roomId,
				videoUrl,
			} as CreateRoomPayload);
			setIsRoomCreated(true);
			// Update URL to include room parameter.
			window.history.replaceState(null, '', `?room=${roomId}`);
		});

		// Listen for initial sync data.
		socket.on('syncVideo', (data: RoomState) => {
			console.log('Received syncVideo event after room creation:', data);
			setVideoUrl(data.videoUrl);
		});

		socket.on('videoEvent', (data: VideoEventPayload) => {
			console.log('Received video event:', data);
			if (!playerRef.current) return;
			if (data.type === 'play') {
				playerRef.current.play().catch((err) => console.error(err));
			} else if (data.type === 'pause') {
				playerRef.current.pause();
			} else if (data.type === 'seek') {
				playerRef.current.currentTime = data.currentTime / 1000;
			}
		});
	};

	// Render: if no room exists, show the room creation form.
	if (!isRoomCreated) {
		return (
			<div style={{ padding: '2rem', textAlign: 'center' }}>
				<h1>Create a Room</h1>
				<form onSubmit={handleCreateRoom}>
					<div style={{ marginBottom: '1rem' }}>
						<label>
							Room ID:{' '}
							<input
								type='text'
								value={roomId}
								onChange={(e: ChangeEvent<HTMLInputElement>) =>
									setRoomId(e.target.value)
								}
								required
							/>
						</label>
					</div>
					<div style={{ marginBottom: '1rem' }}>
						<label>
							Video URL:{' '}
							<input
								type='text'
								value={videoUrl}
								onChange={(e: ChangeEvent<HTMLInputElement>) =>
									setVideoUrl(e.target.value)
								}
								required
							/>
						</label>
					</div>
					<button type='submit'>Create Room</button>
				</form>
			</div>
		);
	}

	return (
		<div>
			<h1 style={{ textAlign: 'center' }}>Room: {roomId}</h1>
			<Player
				onPlay={handlePlay}
				onPause={handlePause}
				onSeeked={handleSeeked}
				playerRef={playerRef}
				videoUrl={videoUrl}
			/>
		</div>
	);
};

export default App;
