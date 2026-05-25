import { lazy, Component, createSignal, onMount, Show } from 'solid-js';
import { Router, Route, A } from '@solidjs/router';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Home as HomeIcon, List, Mic, Heart, Download, Settings, Minus, Square, X, Loader2 } from 'lucide-solid';
import { invoke } from '@tauri-apps/api/core';
import './App.css';

const Home = lazy(() => import('./pages/Home'));
const Downloads = lazy(() => import('./pages/Downloads'));
const Player = lazy(() => import('./pages/Player'));
const Setup = lazy(() => import('./pages/Setup'));

const ComingSoon: Component<{ title: string }> = (props) => (
  <div style={{ padding: "40px" }}>
    <h2>{props.title}</h2>
    <p style={{ color: "var(--secondary-text)" }}>Coming soon...</p>
  </div>
);

const AppLogo = () => (
  <svg width="32" height="32" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg" class="app-logo">
    <path fill="var(--primary-accent)" d="M83.333 0h333.334A83.333 83.333 0 0 1 500 83.333v333.334A83.333 83.333 0 0 1 416.667 500H83.333A83.333 83.333 0 0 1 0 416.667V83.333A83.333 83.333 0 0 1 83.333 0"/>
    <path d="m125 125 125 250 125-250" stroke="var(--primary-text)" stroke-width="25" fill="none" stroke-linecap="round"/>
    <path d="M375 125c-241.667 62.5-270.833-41.667-225 0 8.333 41.667 16.667-20.833 25 0s16.667-62.5 25 0 16.667-33.333 25 0 16.667-8.333 25 0c8.333 50 16.667-58.333 25 0 8.333 20.833 16.667-41.667 25 0 8.333 62.5 16.667-20.833 25 0 8.333 41.667 16.667-50 25 0 8.333 25 16.667-33.333 25 0" stroke="#fff" stroke-width="5.208" fill="none" stroke-linecap="round" style={{ "stroke-dasharray": "1000", "stroke-dashoffset": "0", "filter": "drop-shadow(0 0 2px #fff) drop-shadow(0 0 5px #fff)" }} />
  </svg>
);

const ImmersiveTitleBar = () => {

  return (
    <div class="immersive-titlebar-wrapper">
      <div data-tauri-drag-region class="drag-region"></div>
      <div class="titlebar-controls">
        {/* Fetch the active window exactly when clicked */}
        <div class="titlebar-btn" onClick={() => getCurrentWindow().minimize()}><Minus size={16} /></div>
        <div class="titlebar-btn" onClick={() => getCurrentWindow().toggleMaximize()}><Square size={14} /></div>
        <div class="titlebar-btn close-btn" onClick={() => getCurrentWindow().close()}><X size={18} /></div>
      </div>
    </div>
  );
};

// Lifecycle Blocker Root Component
const AppLifecycle: Component<{ children?: any }> = (props) => {
  const [needsSetup, setNeedsSetup] = createSignal<boolean | null>(null);

  onMount(async () => {
    try {
        const status = await invoke<{ ytdlp_exists: boolean, ffmpeg_exists: boolean }>('check_binaries');
        if (status.ytdlp_exists && status.ffmpeg_exists) {
            setNeedsSetup(false);
        } else {
            setNeedsSetup(true);
        }
    } catch (e) {
        console.error("Critical lifecycle check failed:", e);
        setNeedsSetup(true); // Default to setup on error
    }
  });

  return (
    <div class="app-wrapper">
      <ImmersiveTitleBar />
      <Show when={needsSetup() !== null} fallback={<LoadingBlock />}>
        <Show when={needsSetup() === false} fallback={<Setup />}>
            {props.children}
        </Show>
      </Show>
    </div>
  );
};

const LoadingBlock = () => (
    <div style={{display: 'flex', flex: '1', 'align-items': 'center', 'justify-content': 'center', background: 'var(--primary-background)', color: 'var(--primary-accent)'}}>
        <Loader2 class="spinIcon" size={48} />
    </div>
)

const AppLayout: Component<{ children?: any }> = (props) => {
  const [isPinned, setIsPinned] = createSignal(false);
  const [isHovered, setIsHovered] = createSignal(false);

  const isExpanded = () => isPinned() || isHovered();

  return (
      <div class="app-container">
        <nav 
          class={`sidebar ${isExpanded() ? 'expanded' : 'collapsed'}`}
          onMouseEnter={() => !isPinned() && setIsHovered(true)}
          onMouseLeave={() => !isPinned() && setIsHovered(false)}
        >
          <div class="sidebar-header" onClick={() => setIsPinned(!isPinned())}>
            <AppLogo />
            <span class="brand-name">ViveStream</span>
          </div>
          
          <div class="nav-links top-links">
            <A href="/"><HomeIcon size={24} class="nav-icon lucide-home" /> <span class="nav-text">Home</span></A>
            <A href="/favourites"><Heart size={24} class="nav-icon lucide-heart" /> <span class="nav-text">Favourites</span></A>
            <A href="/playlists"><List size={24} class="nav-icon lucide-list" /> <span class="nav-text">Playlists</span></A>
            <A href="/artists"><Mic size={24} class="nav-icon lucide-mic" /> <span class="nav-text">Artists</span></A>
          </div>

          <div class="nav-links bottom-links">
            <A href="/downloads"><Download size={24} class="nav-icon lucide-download" /> <span class="nav-text">Downloads</span></A>
            <A href="/settings"><Settings size={24} class="nav-icon lucide-settings" /> <span class="nav-text">Settings</span></A>
          </div>
        </nav>
        
        <main class="main-content">
          {props.children}
        </main>
      </div>
  );
};

const App: Component = () => {
  return (
    <Router root={AppLifecycle}>
      <Route path="/" component={AppLayout}>
          <Route path="/" component={Home} />
          <Route path="/downloads" component={Downloads} />
          <Route path="/settings" component={() => <ComingSoon title="Settings" />} />
          <Route path="/playlists" component={() => <ComingSoon title="Playlists" />} />
          <Route path="/artists" component={() => <ComingSoon title="Artists" />} />
          <Route path="/favourites" component={() => <ComingSoon title="Favourites" />} />
          <Route path="/player/:id" component={Player} />
      </Route>
    </Router>
  );
};

export default App;
