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
      d="m125 125 125 250 125-250"
      stroke="#ffffff"
      stroke-width="25"
      fill="none"
      stroke-linecap="round"
    />
    <path
      d="M375 125c-241.667 62.5-270.833-41.667-225 0 8.333 41.667 16.667-20.833 25 0s16.667-62.5 25 0 16.667-33.333 25 0 16.667-8.333 25 0c8.333 50 16.667-58.333 25 0 8.333 20.833 16.667-41.667 25 0 8.333 62.5 16.667-20.833 25 0 8.333 41.667 16.667-50 25 0 8.333 25 16.667-33.333 25 0"
      stroke="#fff"
      stroke-width="5.208"
      fill="none"
      stroke-linecap="round"
      style={{
        "stroke-dasharray": "1000",
        "stroke-dashoffset": "0",
        filter: "drop-shadow(0 0 2px #fff) drop-shadow(0 0 5px #fff)",
      }}
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
          <i class="ph ph-caret-down" style={{ "font-size": "16px" }}></i>
        </div>
        <div
          class="titlebar-btn"
          onClick={() => win.minimize()}
          title="Minimize"
        >
          <i class="ph ph-minus" style={{ "font-size": "16px" }}></i>
        </div>
        <div
          class="titlebar-btn"
          onClick={() => win.toggleMaximize()}
          title="Maximize"
        >
          <i class="ph ph-square" style={{ "font-size": "14px" }}></i>
        </div>
        <div
          class="titlebar-btn close-btn"
          onClick={() => win.close()}
          title="Close"
        >
          <i class="ph ph-x" style={{ "font-size": "16px" }}></i>
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
          <div
            style={{
              display: "flex",
              flex: "1",
              "align-items": "center",
              "justify-content": "center",
              background: "var(--primary-background)",
            }}
          >
            <i
              class="ph ph-spinner spinIcon"
              style={{ "font-size": "48px", color: "var(--primary-accent)" }}
            ></i>
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
