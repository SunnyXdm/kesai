import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import '@vidstack/react/player/styles/base.css';
import '@vidstack/react/player/styles/plyr/theme.css';
import { MediaPlayer, MediaProvider, useMediaPlayer } from '@vidstack/react';
import {
	PlyrLayout,
	plyrLayoutIcons,
} from '@vidstack/react/player/layouts/plyr';
import { useEffect, useRef } from 'react';
import type { MediaPlayerInstance } from '@vidstack/react';

const Player = () => {
	const videoRef = useRef<MediaPlayerInstance>(null);
	// const player = useMediaPlayer(videoRef.current);

	useEffect(() => {
		(window as any)['videoRef'] = videoRef;
	}, []);

	return (
		<MediaPlayer
			ref={videoRef}
			onLoadedMetadata={() => console.log('loaded metadata')}
			onPause={() => console.log('paused')}
			onPlay={() => console.log('play')}
			onSeeked={(time) => console.log('seeked', time)}
			style={{ width: '100vw', height: '100%', backgroundColor: 'black' }}
			src='youtube/N2dbyFddcIs'
			// src='https://files.vidstack.io/sprite-fight/hls/stream.m3u8'
			// src='http://100.122.200.49:4000/outputs/2/master.m3u8'
		>
			<MediaProvider />
			<PlyrLayout
				// thumbnails='http://100.122.200.49:4000/outputs/2/thumbnails.vtt'
				icons={plyrLayoutIcons}
			/>
		</MediaPlayer>
	);
};

export default Player;
