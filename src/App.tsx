import { useEffect, useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import {
  Disc3,
  FileAudio2,
  Music2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Timer,
  Trash2,
  Upload,
} from 'lucide-react';

type Track = {
  id: string;
  name: string;
  file: File;
  url: string;
};

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState('');
  const [playbackRate, setPlaybackRate] = useState(1);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [sleepRemaining, setSleepRemaining] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<string[]>([]);
  const toastTimer = useRef<number | null>(null);
  const sleepInterval = useRef<number | null>(null);
  const currentTrack = tracks.find(track => track.id === currentTrackId) ?? null;

  const announce = (message: string) => {
    setToast(message);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2500);
  };

  useEffect(() => () => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    if (sleepInterval.current !== null) window.clearInterval(sleepInterval.current);
    objectUrls.current.forEach(url => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate, currentTrackId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentTrack) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      setProgress(0);
      setDuration(0);
      return;
    }

    if (audio.src !== currentTrack.url) {
      audio.pause();
      audio.src = currentTrack.url;
      audio.load();
      setProgress(0);
      setDuration(0);
    }
  }, [currentTrackId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (playing) {
      void audio.play().catch(() => {
        setPlaying(false);
        announce('This MP3 could not be played in your browser.');
      });
    } else {
      audio.pause();
    }
  }, [playing, currentTrackId]);

  const addFiles = (fileList: FileList | File[]) => {
    const selected = Array.from(fileList);
    const mp3Files = selected.filter(file =>
      file.name.toLowerCase().endsWith('.mp3') || file.type.toLowerCase() === 'audio/mpeg',
    );

    if (!mp3Files.length) {
      announce('Choose MP3 files to add to your library.');
      return;
    }

    const added = mp3Files.map((file, index) => {
      const url = URL.createObjectURL(file);
      objectUrls.current.push(url);
      return {
        id: `${Date.now()}-${file.lastModified}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name.replace(/\.mp3$/i, '').replace(/_/g, ' '),
        file,
        url,
      };
    });

    setTracks(previous => [...previous, ...added]);
    setCurrentTrackId(previous => previous ?? added[0].id);
    announce(`Added ${added.length} MP3${added.length === 1 ? '' : 's'}.`);
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.currentTarget.files) addFiles(event.currentTarget.files);
    event.currentTarget.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  };

  const playTrack = (track: Track) => {
    if (currentTrackId === track.id) {
      if (playing) {
        audioRef.current?.pause();
        setPlaying(false);
      } else {
        setPlaying(true);
        void audioRef.current?.play().catch(() => {
          setPlaying(false);
          announce('This MP3 could not be played in your browser.');
        });
      }
      return;
    }

    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = track.url;
      audio.load();
      void audio.play().catch(() => {
        setPlaying(false);
        announce('This MP3 could not be played in your browser.');
      });
    }
    setProgress(0);
    setDuration(0);
    setCurrentTrackId(track.id);
    setPlaying(true);
  };

  const stepTrack = (offset: number) => {
    if (!tracks.length) return;
    const currentIndex = tracks.findIndex(track => track.id === currentTrackId);
    const nextIndex = currentIndex < 0
      ? 0
      : (currentIndex + offset + tracks.length) % tracks.length;
    playTrack(tracks[nextIndex]);
  };

  const removeTrack = (id: string) => {
    const index = tracks.findIndex(track => track.id === id);
    if (index < 0) return;
    const removed = tracks[index];
    const remaining = tracks.filter(track => track.id !== id);
    URL.revokeObjectURL(removed.url);
    objectUrls.current = objectUrls.current.filter(url => url !== removed.url);
    setTracks(remaining);

    if (currentTrackId === id) {
      audioRef.current?.pause();
      setPlaying(false);
      setCurrentTrackId(remaining[Math.min(index, remaining.length - 1)]?.id ?? null);
    }
  };

  const togglePlayback = () => {
    if (!currentTrack) return;
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
    } else {
      setPlaying(true);
      void audioRef.current?.play().catch(() => {
        setPlaying(false);
        announce('This MP3 could not be played in your browser.');
      });
    }
  };

  const setSleepTimer = (minutes: number | null) => {
    if (sleepInterval.current !== null) {
      window.clearInterval(sleepInterval.current);
      sleepInterval.current = null;
    }

    if (minutes === null) {
      setSleepRemaining(null);
      setSleepOpen(false);
      announce('Sleep timer turned off.');
      return;
    }

    const deadline = Date.now() + minutes * 60 * 1000;
    setSleepRemaining(minutes * 60);
    setSleepOpen(false);
    sleepInterval.current = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSleepRemaining(remaining);

      if (remaining === 0) {
        if (sleepInterval.current !== null) window.clearInterval(sleepInterval.current);
        sleepInterval.current = null;
        setSleepRemaining(null);
        audioRef.current?.pause();
        setPlaying(false);
        announce('Sleep timer finished. Playback paused.');
      }
    }, 1000);
    announce(`Sleep timer set for ${minutes} minutes.`);
  };

  const updatePosition = (value: number) => {
    if (audioRef.current) audioRef.current.currentTime = value;
    setProgress(value);
  };

  return (
    <div className="app-shell">
      {toast && <div className="toast-message" role="status">{toast}</div>}
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={() => setProgress(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={() => tracks.length > 1 ? stepTrack(1) : setPlaying(false)}
        onError={() => {
          if (currentTrack) {
            setPlaying(false);
            announce('This MP3 could not be opened.');
          }
        }}
      />

      <header className="topbar">
        <a href="/" className="brand" aria-label="Afterglow home">
          <span className="brand-mark"><Disc3 size={20} strokeWidth={1.8} /></span>
          <span>
            <span className="brand-name">afterglow</span>
            <span className="brand-note">your personal stereo</span>
          </span>
        </a>
        <div className="top-right">
          <span className="device-note">Local MP3 player</span>
          <span className="brand-note">EST. 2001 / NOW</span>
        </div>
      </header>

      <main className="main-area">
        <section className="hero-row">
          <div>
            <span className="eyebrow">A small place for big feelings</span>
            <h1 className="hero-title">Your music, your way.</h1>
          </div>
          <p className="hero-copy">
            Play the MP3s you already own. Your files stay on this device and are never uploaded.
          </p>
        </section>

        <div
          className={`dropzone${dragging ? ' dragging' : ''}${tracks.length ? ' compact' : ''}`}
          onDragOver={event => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={event => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
          }}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept=".mp3,audio/mpeg"
            multiple
            aria-label="Choose MP3 files"
            onChange={handleFileInput}
          />
          <div className="drop-copy">
            <span className="upload-glyph"><Upload size={20} /></span>
            <div>
              <strong>{tracks.length ? 'Add more music' : 'Bring your MP3s'}</strong>
              <p>Choose MP3 files or drag them here. Nothing is uploaded.</p>
            </div>
          </div>
          <button className="browse-button" onClick={() => fileInputRef.current?.click()}>
            <Upload size={15} />
            Choose MP3s
          </button>
        </div>

        <div className="section-topline">
          <h2 className="section-title">Your library</h2>
          <span className="result-count">
            {tracks.length} {tracks.length === 1 ? 'TRACK' : 'TRACKS'}
          </span>
        </div>

        {tracks.length ? (
          <div className="track-table" role="list" aria-label="MP3 library">
            <div className="track-head" aria-hidden="true">
              <span></span><span>Track</span><span>File size</span><span></span>
            </div>
            {tracks.map((track, index) => {
              const isCurrent = currentTrackId === track.id;
              const isPlaying = isCurrent && playing;
              return (
                <div
                  className={`track-row${isCurrent ? ' is-current' : ''}`}
                  key={track.id}
                  role="listitem"
                >
                  <button
                    className="play-mini"
                    aria-label={`${isPlaying ? 'Pause' : 'Play'} ${track.name}`}
                    onClick={() => playTrack(track)}
                  >
                    {isPlaying ? <Pause size={13} /> : <Play size={13} fill="currentColor" />}
                  </button>
                  <div className="track-name">
                    <span className="track-art"><Music2 size={19} /></span>
                    <div className="track-copy">
                      <span className="track-title">{track.name}</span>
                      <span className="track-subtitle">
                        {index + 1} in queue <span aria-hidden="true">·</span> MP3
                      </span>
                    </div>
                  </div>
                  <span className="track-size">{formatSize(track.file.size)}</span>
                  <button
                    className="row-action"
                    aria-label={`Remove ${track.name}`}
                    onClick={() => removeTrack(track.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-panel">
            <span className="empty-glyph"><FileAudio2 size={22} /></span>
            <h2>No MP3s loaded yet</h2>
            <p>Pick one or more files to build a queue and listen to full tracks.</p>
          </div>
        )}
      </main>

      <footer className="player-dock" aria-label="Audio player">
        <div className="now-playing">
          {currentTrack
            ? <span className="now-art"><Music2 size={20} /></span>
            : <span className="now-art"><Disc3 size={21} /></span>}
          <div className="now-copy">
            <span className="now-title">{currentTrack?.name ?? 'Your stereo is ready'}</span>
            <span className="now-artist">{currentTrack ? formatSize(currentTrack.file.size) : 'Choose an MP3 to begin'}</span>
          </div>
        </div>

        <div className="dock-actions">
          <div className="player-controls">
            <button
              className="control-button skip-control"
              aria-label="Previous track"
              disabled={tracks.length < 2}
              onClick={() => stepTrack(-1)}
            >
              <SkipBack size={17} fill="currentColor" />
            </button>
            <button
              className="control-button main"
              aria-label={playing ? 'Pause' : 'Play'}
              disabled={!currentTrack}
              onClick={togglePlayback}
            >
              {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
            </button>
            <button
              className="control-button skip-control"
              aria-label="Next track"
              disabled={tracks.length < 2}
              onClick={() => stepTrack(1)}
            >
              <SkipForward size={17} fill="currentColor" />
            </button>
          </div>

          <div className="extra-controls">
            <label className="speed-control">
              <span className="visually-hidden">Playback speed</span>
              <select
                className="speed-select"
                aria-label="Playback speed"
                value={playbackRate}
                onChange={event => setPlaybackRate(Number(event.target.value))}
              >
                {[0.75, 1, 1.25, 1.5, 2].map(rate => (
                  <option key={rate} value={rate}>{rate}×</option>
                ))}
              </select>
            </label>

            <div
              className="sleep-control"
              onKeyDown={event => {
                if (event.key === 'Escape') setSleepOpen(false);
              }}
            >
              <button
                className={`sleep-button${sleepRemaining !== null ? ' active' : ''}`}
                aria-label={sleepRemaining === null ? 'Set sleep timer' : `Sleep timer: ${formatTime(sleepRemaining)} remaining`}
                aria-expanded={sleepOpen}
                aria-controls="sleep-timer-options"
                onClick={() => setSleepOpen(open => !open)}
              >
                <Timer size={15} />
                <span>{sleepRemaining === null ? 'Sleep' : formatTime(sleepRemaining)}</span>
              </button>
              {sleepOpen && (
                <div className="sleep-popover" id="sleep-timer-options" role="group" aria-label="Sleep timer options">
                  <strong>Pause playback in</strong>
                  <div className="sleep-options">
                    {[15, 30, 45, 60].map(minutes => (
                      <button key={minutes} onClick={() => setSleepTimer(minutes)}>{minutes} min</button>
                    ))}
                  </div>
                  <p>Playback pauses when the timer ends.</p>
                  {sleepRemaining !== null && (
                    <button className="cancel-timer" onClick={() => setSleepTimer(null)}>Turn timer off</button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="time-control">
          <div className="time-line">
            <span>{formatTime(progress)}</span>
            <input
              className="progress-track"
              aria-label="Track position"
              type="range"
              min="0"
              max={duration || 1}
              step=".1"
              value={Math.min(progress, duration || 0)}
              disabled={!currentTrack || !duration}
              onChange={event => updatePosition(Number(event.target.value))}
            />
            <span>{formatTime(duration)}</span>
          </div>
          <div className="preview-caption">{currentTrack ? 'FULL MP3' : 'FULL TRACK PLAYBACK'}</div>
        </div>
      </footer>
    </div>
  );
}