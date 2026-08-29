# ViveStream-Next: Design Language

## Core Philosophy

ViveStream-Next utilizes a high-contrast, performance-first **Neo-Brutalism** design system across both Light and Dark modes. The interface feels bold, tactile, mechanical, and ultra-responsive while maintaining zero Virtual DOM overhead via SolidJS. We utilize sharp geometric structures, prominent solid borders, and zero-blur hard offset drop shadows for instant visual feedback and 300+ FPS GPU-efficient rendering.

## Typography

- **Display/Headings:** `MajorMonoDisplay` - Gives the app a distinct, technical edge while remaining highly stylized.
- **Body:** `Poppins` - Ensures maximum legibility for dense data, descriptions, and settings menus.

## Themes & Color Palettes

The app utilizes CSS variables to switch between themes, applying universal Neo-Brutalism principles across the app's established color themes.

### 1. Dark Mode (Cyber Neo-Brutalism)

- **Background:** Deep matte gray-blue (`#1e1e24`).
- **Cards & Surfaces:** Solid elevated dark panels (`#25262c` & `#2a2b32`).
- **Aesthetic:** High-contrast solid borders paired with crisp, hard-edged offset drop shadows with zero Gaussian blur penalty.
- **Border Radius:** Structured geometric corners (`8px` to `12px`, with pills for badges).
- **Accent:** Dynamically shifts based on the active palette (Sunset or Crimson).

### 2. Light Mode: Sunset (The Brand Default)

- **Background:** Soft, warm Peachy Cream (`#fdf6f0`).
- **Cards & Surfaces:** Pure White (`#ffffff`) with tertiary accents (`#f1e4d8`).
- **Aesthetic:** Bold 2px/2.5px solid black borders (`#000000`) and hard solid offset shadows (`4px 4px 0px #000000`).
- **Accent:** Vibrant Coral/Tangerine (`#f25c54`).

### 3. Light Mode: Crimson (The Alternative)

- **Background:** Faint, cool Rose Tint (`#fff0f2`).
- **Cards & Surfaces:** Pure White (`#ffffff`) with tertiary accents (`#ffe0e4`).
- **Aesthetic:** Bold 2px/2.5px solid black borders (`#000000`) and hard solid offset shadows (`4px 4px 0px #000000`).
- **Accent:** Vibrant Red (`#ef233c`).

## Core Components

### Neo-Brutalist Cards, Inputs, & Buttons

- **Shape Logic:** Structured rectangular geometry with slight rounding (`8px` to `12px`) or pill tags (`9999px`) with solid borders.
- **Idle State:** Elevated using solid offset drop shadows (`4px 4px 0px #000000` / `3px 3px 0px #000000`).
- **Hover State:** Micro-elevation with negative translation (`translate(-2px, -2px)`) and expanded hard shadow.
- **Active/Pressed State:** Tactile mechanical button depress (`transform: translate(2px, 2px)` with `box-shadow: 0px 0px 0px #000000`).

### Layout Structure

- **Titlebar:** Custom immersive titlebar with bold controls.
- **Sidebar:** Expandable (72px to 240px) with solid border separation and crisp interactive states.
- **Player:** Fluid grid that morphs seamlessly into Theater and Fullscreen modes.

## Motion & Interaction

- **Transitions:** Snappy, instantaneous interactions (`0.1s - 0.2s cubic-bezier(0.16, 1, 0.3, 1)`).
- **Micro-interactions:** Icons scale and depress on interaction. Zero blur drag ensures instant responsiveness.

