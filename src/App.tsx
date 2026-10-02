import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Disc3, Search, Heart, ListMusic, Plus, Radio, Play, Pause, SkipBack, SkipForward,
  Headphones, Trash2,
} from 'lucide-react';

type Track = {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  artworkUrl100: string;
  previewUrl: string | null;
  trackTimeMillis: number;
  primaryGenreName: string;
  releaseDate: string;
};
type Playlist = { id: string; name: string; trackIds: number[] };
type View = 'search' | 'favorites' | string;
const STORAGE = { favorites: 'afterglow:favorites', playlists: 'afterglow:playlists', tracks: 'afterglow:tracks' };

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}
function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}
function artwork(url?: string | null) {
  return url ? url.replace('100x100bb', '300x300bb') : '';
}

function Home() {
  const [query, setQuery] = useState('dream pop');
  const [view, setView] = useState<View>('search');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [favorites, setFavorites] = useState<number[]>(() => readStored(STORAGE.favorites, []));
  const [playlists, setPlaylists] = useState<Playlist[]>(() => readStored(STORAGE.playlists, []));
  const [savedTracks, setSavedTracks] = useState<Record<number, Track>>(() => readStored(STORAGE.tracks, {}));
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(30);
  const [toast, setToast] = useState('');
  const [playlistDialog, setPlaylistDialog] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [addTarget, setAddTarget] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const requestId = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2500);
  }, []);
  const rememberTracks = useCallback((tracks: Track[]) => {
    setSavedTracks(previous => {
      const next = { ...previous };
      for (const track of tracks) next[track.trackId] = track;
      localStorage.setItem(STORAGE.tracks, JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const id = ++requestId.current;
      if (!query.trim()) {
        setResults([]);
        setLoading(false);
        setError('');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ term: query.trim(), entity: 'song', media: 'music', limit: '30' });
        const response = await fetch(`https://itunes.apple.com/search?${params.toString()}`);
        if (!response.ok) throw new Error('Search is having a moment. Try again.');
        const data = await response.json() as { results?: Array<Record<string, unknown>> };
        if (id !== requestId.current) return;
        const tracks = (data.results ?? []).filter(item => typeof item.trackId === 'number' && typeof item.trackName === 'string')
          .map(item => ({
            trackId: item.trackId as number, trackName: item.trackName as string,
            artistName: typeof item.artistName === 'string' ? item.artistName : 'Unknown artist',
            collectionName: typeof item.collectionName === 'string' ? item.collectionName : 'Single',
            artworkUrl100: typeof item.artworkUrl100 === 'string' ? item.artworkUrl100 : '',
            previewUrl: typeof item.previewUrl === 'string' ? item.previewUrl : null,
            trackTimeMillis: typeof item.trackTimeMillis === 'number' ? item.trackTimeMillis : 0,
            primaryGenreName: typeof item.primaryGenreName === 'string' ? item.primaryGenreName : 'Music',
            releaseDate: typeof item.releaseDate === 'string' ? item.releaseDate : '',
          }));
        setResults(tracks);
        rememberTracks(tracks);
      } catch (e) {
        if (id === requestId.current) setError(e instanceof Error ? e.message : 'Could not reach the catalog. Try again.');
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, rememberTracks]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (activeTrack?.previewUrl) {
      audio.src = activeTrack.previewUrl;
      audio.currentTime = 0;
      setProgress(0);
      setDuration(30);
      if (playing) {
        void audio.play().catch(() => {
          setPlaying(false);
          announce('Preview could not start. Try another track.');
        });
      }
    } else {
      audio.pause();
    }
  }, [activeTrack, announce, playing]);

  const allTracks = useMemo(() => {
    const tracks: Record<number, Track> = { ...savedTracks };
    for (const track of results) tracks[track.trackId] = track;
    return tracks;
  }, [savedTracks, results]);
  const activePlaylist = view !== 'search' && view !== 'favorites' ? playlists.find(list => list.id === view) : undefined;
  const visibleTracks = useMemo(() => {
    if (view === 'favorites') return favorites.map(id => allTracks[id]).filter((track): track is Track => Boolean(track));
    if (activePlaylist) return activePlaylist.trackIds.map(id => allTracks[id]).filter((track): track is Track => Boolean(track));
    return results;
  }, [view, favorites, allTracks, activePlaylist, results]);
  const title = view === 'search' ? 'Find your frequency.' : view === 'favorites' ? 'The keepers.' : activePlaylist?.name ?? 'Playlist';
  const subtitle = view === 'search'
    ? 'A little search, a little nostalgia. Find a song and let the first 30 seconds take you somewhere.'
    : view === 'favorites' ? 'The tracks you saved for another spin.' : 'Your own little mixtape, made one song at a time.';

  const toggleFavorite = (track: Track) => {
    const next = favorites.includes(track.trackId) ? favorites.filter(id => id !== track.trackId) : [...favorites, track.trackId];
    setFavorites(next);
    localStorage.setItem(STORAGE.favorites, JSON.stringify(next));
    rememberTracks([track]);
    announce(next.includes(track.trackId) ? 'Saved to your favorites.' : 'Removed from favorites.');
  };
  const playTrack = (track: Track) => {
    rememberTracks([track]);
    if (!track.previewUrl) {
      setActiveTrack(track);
      setPlaying(false);
      announce('No 30-second preview is available for this track.');
      return;
    }
    if (activeTrack?.trackId === track.trackId) {
      if (playing) {
        audioRef.current?.pause();
        setPlaying(false);
      } else {
        setPlaying(true);
        void audioRef.current?.play().catch(() => {
          setPlaying(false);
          announce('Preview could not start. Try another track.');
        });
      }
    } else {
      setActiveTrack(track);
      setPlaying(true);
    }
  };
  const stepTrack = (delta: number) => {
    if (!visibleTracks.length) return;
    const index = visibleTracks.findIndex(track => track.trackId === activeTrack?.trackId);
    const nextIndex = (index + delta + visibleTracks.length) % visibleTracks.length;
    playTrack(visibleTracks[nextIndex]);
  };
  const createPlaylist = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = playlistName.trim();
    if (!name) return;
    const item: Playlist = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, trackIds: [] };
    const next = [...playlists, item];
    setPlaylists(next);
    localStorage.setItem(STORAGE.playlists, JSON.stringify(next));
    setPlaylistName('');
    setPlaylistDialog(false);
    setView(item.id);
    announce('Playlist is ready. Add a track to begin.');
  };
  const addToPlaylist = (playlistId: string, track: Track) => {
    const next = playlists.map(list => list.id === playlistId && !list.trackIds.includes(track.trackId)
      ? { ...list, trackIds: [...list.trackIds, track.trackId] } : list);
    setPlaylists(next);
    localStorage.setItem(STORAGE.playlists, JSON.stringify(next));
    rememberTracks([track]);
    setAddTarget(null);
    announce('Added to playlist.');
  };
  const removePlaylist = (id: string) => {
    const next = playlists.filter(list => list.id !== id);
    setPlaylists(next);
    localStorage.setItem(STORAGE.playlists, JSON.stringify(next));
    if (view === id) setView('search');
    announce('Playlist deleted.');
  };
  const onTimeUpdate = () => {
    const audio = audioRef.current;
    if (audio) {
      if (audio.currentTime >= 30) {
        audio.pause();
        audio.currentTime = 30;
        setPlaying(false);
      }
      setProgress(Math.min(30, audio.currentTime));
    }
  };
  const setAudioPosition = (value: number) => {
    if (audioRef.current) audioRef.current.currentTime = value;
    setProgress(value);
  };

  return (
    <div className="app-shell">
      {toast && <div className="toast-message" role="status" data-testid="status-toast">{toast}</div>}
      <audio ref={audioRef} onTimeUpdate={onTimeUpdate} onLoadedMetadata={() => setDuration(Math.min(30, audioRef.current?.duration || 30))} onEnded={() => setPlaying(false)} />
      <header className="topbar">
        <a href="/" className="brand" aria-label="Afterglow home" data-testid="link-home">
          <span className="brand-mark"><Disc3 size={20} strokeWidth={1.8} /></span>
          <span><span className="brand-name">afterglow</span><span className="brand-note" style={{ display: 'block', marginTop: 1 }}>your personal stereo</span></span>
        </a>
        <div className="top-right"><span className="catalog-note">Search previews · not a full catalog</span><span className="brand-note">EST. 2001 / NOW</span></div>
      </header>
      <div className="shell-grid">
        <aside className="sidebar" aria-label="Library navigation">
          <div>
            <p className="nav-heading">Your listening</p>
            <div className="nav-stack">
              <button className={`nav-item ${view === 'search' ? 'selected' : ''}`} onClick={() => setView('search')} data-testid="button-nav-search"><Search size={16} /> Discover</button>
              <button className={`nav-item ${view === 'favorites' ? 'selected' : ''}`} onClick={() => setView('favorites')} data-testid="button-nav-favorites"><Heart size={16} /> Favorites <span className="nav-count">{favorites.length}</span></button>
            </div>
          </div>
          <div>
            <div className="playlist-header"><p className="nav-heading">Playlists</p><button className="icon-button" aria-label="Create playlist" onClick={() => setPlaylistDialog(true)} data-testid="button-create-playlist"><Plus size={16} /></button></div>
            <div className="playlist-list">
              {playlists.map(list => (
                <div key={list.id} style={{ display: 'flex', alignItems: 'center' }}>
                  <button className={`playlist-item ${view === list.id ? 'selected' : ''}`} onClick={() => setView(list.id)} data-testid={`button-playlist-${list.id}`}><ListMusic size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />{list.name}</button>
                  <button className="row-action" aria-label={`Delete ${list.name}`} onClick={() => removePlaylist(list.id)} data-testid={`button-delete-playlist-${list.id}`}><Trash2 size={13} /></button>
                </div>
              ))}
              {playlists.length === 0 && <span className="brand-note" style={{ padding: '8px 12px', textTransform: 'none', letterSpacing: 0 }}>Make your first mixtape.</span>}
            </div>
          </div>
        </aside>

        <main className="main-area">
          <div className="hero-row">
            <div><span className="eyebrow">A small place for big feelings</span><h1 className="hero-title">{title}</h1></div>
            <p className="hero-copy">{subtitle}</p>
          </div>
          {view === 'search' && <div className="search-wrap">
            <Search size={18} className="search-icon" />
            <input className="search-input" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search a song, artist, or album…" aria-label="Search songs and artists" data-testid="input-search" />
            <span className="search-hint">ENTER ↵</span>
          </div>}
          <div className="section-topline">
            <h2 className="section-title">{view === 'search' ? (query ? `Search / ${query}` : 'Your search') : `${visibleTracks.length} ${visibleTracks.length === 1 ? 'track' : 'tracks'}`}</h2>
            <span className="result-count">{view === 'search' ? loading ? 'TUNING IN…' : `${visibleTracks.length} RESULTS` : 'ON THIS DEVICE'}</span>
          </div>
          {loading && view === 'search' ? <div className="track-table" aria-label="Loading search results">{Array.from({ length: 5 }, (_, i) => <div key={i} className="skeleton-row" />)}</div>
            : error && view === 'search' ? <div className="error-panel"><div><div className="empty-glyph"><Radio size={22} /></div><h3>Couldn’t tune in</h3><p>{error}</p><button className="retry-button" onClick={() => setQuery(current => `${current} `)} data-testid="button-retry">Try again</button></div></div>
            : visibleTracks.length ? <div className="track-table" role="list">
              <div className="track-head"><span></span><span>Track</span><span className="track-album-col">Album</span><span>Style</span><span>Time</span><span></span></div>
              {visibleTracks.map(track => {
                const isPlaying = activeTrack?.trackId === track.trackId && playing;
                return <div className={`track-row ${activeTrack?.trackId === track.trackId ? 'is-playing' : ''}`} key={track.trackId} role="listitem" data-testid={`row-track-${track.trackId}`}>
                  <button className="play-mini" onClick={() => playTrack(track)} aria-label={`${isPlaying ? 'Pause' : 'Play'} ${track.trackName}`} data-testid={`button-play-${track.trackId}`}>{isPlaying ? <Pause size={13} /> : <Play size={13} fill="currentColor" />}</button>
                  <div className="track-name">
                    <img className="track-art" src={artwork(track.artworkUrl100)} alt="" loading="lazy" />
                    <div style={{ minWidth: 0 }}><div className="track-title">{track.trackName}</div><div className="track-artist">{track.artistName}</div></div>
                  </div>
                  <div className="track-album track-album-col">{track.collectionName}</div>
                  <div className="track-genre">{track.primaryGenreName}</div>
                  <div className="track-duration">{formatTime(track.trackTimeMillis / 1000)}</div>
                  <div className="track-actions">
                    <button className={`row-action ${favorites.includes(track.trackId) ? 'active' : ''}`} aria-label={favorites.includes(track.trackId) ? 'Remove favorite' : 'Add favorite'} onClick={() => toggleFavorite(track)} data-testid={`button-favorite-${track.trackId}`}><Heart size={15} fill={favorites.includes(track.trackId) ? 'currentColor' : 'none'} /></button>
                    <button className="row-action" aria-label="Add to playlist" onClick={() => setAddTarget(addTarget === track.trackId ? null : track.trackId)} data-testid={`button-add-track-${track.trackId}`}><Plus size={16} /></button>
                    {addTarget === track.trackId && <div style={{ position: 'absolute', top: 34, zIndex: 4, right: 0, padding: 8, minWidth: 160, borderRadius: 12, background: '#f9f6ef', boxShadow: '0 8px 26px #302a3228', border: '1px solid #ded9d0' }}>
                      {playlists.length ? playlists.map(list => <button key={list.id} className="playlist-item" style={{ display: 'block', width: '100%' }} onClick={() => addToPlaylist(list.id, track)} data-testid={`button-add-${track.trackId}-to-${list.id}`}>{list.name}</button>) : <button className="playlist-item" onClick={() => { setAddTarget(null); setPlaylistDialog(true); }} data-testid="button-create-from-track">Create a playlist first</button>}
                    </div>}
                  </div>
                </div>;
              })}
            </div> : <div className="empty-panel">
              <div><div className="empty-glyph">{view === 'favorites' ? <Heart size={22} /> : <Headphones size={22} />}</div>
                <h3>{view === 'search' ? query.trim() ? 'No tracks found' : 'Start with a feeling' : view === 'favorites' ? 'Nothing saved just yet' : 'A mixtape in the making'}</h3>
                <p>{view === 'search' ? query.trim() ? 'Try another artist, song, or a slightly different spelling.' : 'Type an artist or song above and we’ll find a little something.' : view === 'favorites' ? 'Tap the heart beside a track to keep it close.' : 'Search for a track, then add it to this playlist.'}</p>
                {view !== 'search' && <button className="retry-button" onClick={() => setView('search')} data-testid="button-find-tracks">Find tracks</button>}
              </div>
            </div>}
        </main>
      </div>

      <footer className="player-dock" aria-label="Audio player">
        {activeTrack ? <div className="now-playing">
          <img className="now-art" src={artwork(activeTrack.artworkUrl100)} alt="" />
          <div className="now-copy"><span className="now-title" data-testid="text-now-playing">{activeTrack.trackName}</span><span className="now-artist">{activeTrack.artistName}</span></div>
        </div> : <div className="now-playing"><span className="now-art" style={{ display: 'grid', placeItems: 'center', color: '#c67897' }}><Disc3 size={22} /></span><div className="now-copy"><span className="now-title">Your stereo is ready</span><span className="now-artist">Pick a song to hear a preview</span></div></div>}
        <div className="player-controls">
          <button className="control-button skip-control" aria-label="Previous track" onClick={() => stepTrack(-1)} data-testid="button-previous"><SkipBack size={17} fill="currentColor" /></button>
          <button className="control-button main" aria-label={playing ? 'Pause preview' : 'Play preview'} disabled={!activeTrack?.previewUrl} onClick={() => activeTrack && playTrack(activeTrack)} data-testid="button-toggle-play">{playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button>
          <button className="control-button skip-control" aria-label="Next track" onClick={() => stepTrack(1)} data-testid="button-next"><SkipForward size={17} fill="currentColor" /></button>
        </div>
        {activeTrack ? <div className="time-control">
          <div className="time-line"><span>{formatTime(progress)}</span><input className="progress-track" aria-label="Preview position" type="range" min="0" max={duration || 30} step=".1" value={Math.min(progress, duration)} onChange={event => setAudioPosition(Number(event.target.value))} data-testid="input-progress" /><span>{formatTime(Math.max(0, duration - progress))}</span></div>
          <div className="preview-caption">{activeTrack.previewUrl ? '30-SECOND PREVIEW' : 'PREVIEW UNAVAILABLE'}</div>
        </div> : <div className="time-control"><div className="time-line"><span>0:00</span><div className="progress-track"></div><span>0:30</span></div><div className="preview-caption">30-SECOND PREVIEWS</div></div>}
      </footer>

      {playlistDialog && <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setPlaylistDialog(false); }}>
        <form className="dialog-card" onSubmit={createPlaylist}>
          <h2 className="dialog-title">Make a little mixtape.</h2><p className="dialog-copy">Give this playlist a name. You can add tracks whenever the mood strikes.</p>
          <input autoFocus className="dialog-input" value={playlistName} onChange={event => setPlaylistName(event.target.value)} placeholder="Late-night window seat" maxLength={40} aria-label="Playlist name" data-testid="input-playlist-name" />
          <div className="dialog-actions"><button type="button" className="dialog-button" onClick={() => setPlaylistDialog(false)} data-testid="button-cancel-playlist">Cancel</button><button type="submit" className="dialog-button primary" data-testid="button-save-playlist">Create playlist</button></div>
        </form>
      </div>}
    </div>
  );
}

function App() {
  return <Home />;
}
export default App;