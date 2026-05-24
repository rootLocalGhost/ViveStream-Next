import { lazy, Component } from 'solid-js';
import { Router, Route, A } from '@solidjs/router';
import { Home as HomeIcon, List, Mic, Heart, Download } from 'lucide-solid';
import './App.css';

const Home = lazy(() => import('./pages/Home'));
const Downloads = lazy(() => import('./pages/Downloads'));
const Player = lazy(() => import('./pages/Player'));

const ComingSoon: Component<{ title: string }> = (props) => (
  <div>
    <h2>{props.title}</h2>
    <p style={{ color: "var(--yt-text-muted)" }}>Coming soon...</p>
  </div>
);

const AppLayout: Component<{ children?: any }> = (props) => {
  return (
    <div class="app-container">
      <nav class="sidebar">
        <A href="/"><HomeIcon size={20} /> Home</A>
        <A href="/downloads"><Download size={20} /> Downloads</A>
        <hr style={{ "border-color": "var(--yt-border)", width: "100%", margin: "10px 0" }} />
        <A href="/playlists"><List size={20} /> Playlists</A>
        <A href="/artists"><Mic size={20} /> Artists</A>
        <A href="/favourites"><Heart size={20} /> Favourites</A>
      </nav>
      <main class="main-content">
        {props.children}
      </main>
    </div>
  );
};

const App: Component = () => {
  return (
    <Router root={AppLayout}>
      <Route path="/" component={Home} />
      <Route path="/downloads" component={Downloads} />
      <Route path="/playlists" component={() => <ComingSoon title="Playlists" />} />
      <Route path="/artists" component={() => <ComingSoon title="Artists" />} />
      <Route path="/favourites" component={() => <ComingSoon title="Favourites" />} />
      <Route path="/player/:id" component={Player} />
    </Router>
  );
};

export default App;