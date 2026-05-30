import { lazy, Component, createSignal, onMount, Show } from "solid-js";
import { Router, Route, A } from "@solidjs/router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import "@phosphor-icons/web/regular";
import "@phosphor-icons/web/fill";
import "./App.css";

import { sidebarHoverMode } from "./store";

const Home = lazy(() => import("./pages/Home"));
const Downloads = lazy(() => import("./pages/Downloads"));
const Player = lazy(() => import("./pages/Player"));
const Setup = lazy(() => import("./pages/Setup"));
const Settings = lazy(() => import("./pages/Settings"));
const Favourites = lazy(() => import("./pages/Favourites"));
const Playlists = lazy(() => import("./pages/Playlists"));
const Artists = lazy(() => import("./pages/Artists"));
const ArtistPage = lazy(() => import("./pages/ArtistPage"));

const AppLogo = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 500 500"
    xmlns="http://www.w3.org/2000/svg"
    class="app-logo"
  >
    <path
      fill="var(--primary-accent)"
      d="M83.333 0h333.334A83.333 83.333 0 0 1 500 83.333v333.334A83.333 83.333 0 0 1 416.667 500H83.333A83.333 83.333 0 0 1 0 416.667V83.333A83.333 83.333 0 0 1 83.333 0"
    />
    <path
      d="M95 125 L250 385 L405 125"
      stroke="#f1f1f1"
      stroke-width="30"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      class="logo-glow"
      d="M100 125 Q110 125 118 85 Q126 45 134 125 Q142 175 150 125 Q158 75 166 125 Q174 25 182 125 Q190 215 198 125 Q206 55 214 125 Q222 195 230 125 Q238 35 246 125 Q254 235 262 125 Q270 45 278 125 Q286 205 294 125 Q302 65 310 125 Q318 175 326 125 Q334 85 342 125 Q350 225 358 125 Q366 55 374 125 Q382 165 390 125 Q398 105 405 125"
      stroke="#ffffff"
      stroke-width="6"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
);

const ImmersiveTitleBar = () => {
  const win = getCurrentWindow();
  return (
    <div class="immersive-titlebar-wrapper">
      <div data-tauri-drag-region class="drag-region"></div>
      <div class="titlebar-controls">
        <div
          class="titlebar-btn"
          onClick={() => win.hide()}
          title="Hide to Tray"
        >
          <i class="ph ph-caret-down"></i>
        </div>
        <div
          class="titlebar-btn"
          onClick={() => win.minimize()}
          title="Minimize"
        >
          <i class="ph ph-minus"></i>
        </div>
        <div
          class="titlebar-btn"
          onClick={() => win.toggleMaximize()}
          title="Maximize"
        >
          <i class="ph ph-square"></i>
        </div>
        <div
          class="titlebar-btn close-btn"
          onClick={() => win.close()}
          title="Close"
        >
          <i class="ph ph-x"></i>
        </div>
      </div>
    </div>
  );
};

const AppLifecycle: Component<{ children?: any }> = (props) => {
  const [needsSetup, setNeedsSetup] = createSignal<boolean | null>(null);
  onMount(async () => {
    try {
      const status = await invoke<{
        ytdlp_exists: boolean;
        ffmpeg_exists: boolean;
      }>("check_binaries");
      if (status.ytdlp_exists && status.ffmpeg_exists) setNeedsSetup(false);
      else setNeedsSetup(true);
    } catch (e) {
      console.error("Core engine validation failure:", e);
      setNeedsSetup(true);
    }
  });

  return (
    <div class="app-wrapper">
      <ImmersiveTitleBar />
      <Show
        when={needsSetup() !== null}
        fallback={
          <div class="setup-loading-screen">
            <i class="ph ph-spinner spinIcon setup-loading-spinner"></i>
          </div>
        }
      >
        <Show when={needsSetup() === false} fallback={<Setup />}>
          {props.children}
        </Show>
      </Show>
    </div>
  );
};

const NavItem = (props: {
  href: string;
  text: string;
  iconName: string;
  animClass?: string;
}) => {
  return (
    <A href={props.href} end={props.href === "/"}>
      <div class={`icon-stack ${props.animClass || ""}`}>
        <i class={`ph ph-${props.iconName} icon-outline`}></i>
        <i class={`ph-fill ph-${props.iconName} icon-fill`}></i>
      </div>
      <span class="nav-text">{props.text}</span>
    </A>
  );
};

const AppLayout: Component<{ children?: any }> = (props) => {
  const [isPinned, setIsPinned] = createSignal(false);
  const [isHovered, setIsHovered] = createSignal(false);
  const isExpanded = () => isPinned() || isHovered();

  return (
    <div class="app-container">
      <nav
        class={`sidebar ${isExpanded() ? "expanded" : "collapsed"}`}
        onMouseEnter={() =>
          sidebarHoverMode() && !isPinned() && setIsHovered(true)
        }
        onMouseLeave={() =>
          sidebarHoverMode() && !isPinned() && setIsHovered(false)
        }
      >
        <div class="sidebar-header" onClick={() => setIsPinned(!isPinned())}>
          <AppLogo />
          <span class="brand-name">ViveStream</span>
        </div>
        <div class="nav-links top-links">
          <NavItem
            href="/"
            text="Home"
            iconName="house"
            animClass="anim-bounce"
          />
          <NavItem
            href="/favourites"
            text="Favourites"
            iconName="heart"
            animClass="anim-pulse"
          />
          <NavItem href="/playlists" text="Playlists" iconName="list-dashes" />
          <NavItem
            href="/artists"
            text="Artists"
            iconName="microphone-stage"
            animClass="anim-shake"
          />
        </div>
        <div class="nav-links bottom-links">
          <NavItem
            href="/downloads"
            text="Downloads"
            iconName="download-simple"
            animClass="anim-slide"
          />
          <NavItem
            href="/settings"
            text="Settings"
            iconName="gear"
            animClass="anim-spin"
          />
        </div>
      </nav>
      <main class="main-content">{props.children}</main>
    </div>
  );
};

const App: Component = () => {
  return (
    <Router root={AppLifecycle}>
      <Route path="/" component={AppLayout}>
        <Route path="/" component={Home} />
        <Route path="/downloads" component={Downloads} />
        <Route path="/settings" component={Settings} />
        <Route path="/playlists" component={Playlists} />
        <Route path="/artists" component={Artists} />
        <Route path="/artist/:name" component={ArtistPage} />
        <Route path="/favourites" component={Favourites} />
        <Route path="/player/:id" component={Player} />
      </Route>
    </Router>
  );
};

export default App;
