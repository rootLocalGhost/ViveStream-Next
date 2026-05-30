# ViveStream-Next: Design Language

## Core Philosophy

ViveStream-Next abandons generic flat UI in favor of a highly tactile, performance-first **Claymorphism** design. The interface feels physical, responsive, and native to the desktop while maintaining zero Virtual DOM overhead via SolidJS.

## Typography

- **Display/Headings:** `MajorMonoDisplay` - Gives the app a distinct, technical, and brutalist edge.
- **Body:** `Poppins` - Ensures maximum legibility for dense data, descriptions, and settings.

## Themes & Color Palettes

The app utilizes CSS variables to dynamically switch between entirely different structural feels, not just color swaps.

### 1. Light Mode (The Clay Default)

- **Background:** Soft grayish-blue (`#eef0f5`).
- **Aesthetic:** Soft 3D extruded shapes using multi-layered box-shadows (outset for elevation, inset for highlights).
- **Border Radius:** Fully rounded (`24px`) for a friendly, physical feel.
- **Accent:** Vibrant Red (`#ef233c`).

### 2. Dark Mode (Brutalist Edge)

- **Background:** True Black (`#000000`) and Deep Charcoal (`#121212`).
- **Aesthetic:** Stripped back, high-contrast, edge-to-edge. Claymorphism shadows are replaced by sharp, hard 2px borders and block shadows.
- **Border Radius:** Sharp (`0px`).
- **Accent:** Vibrant Red (`#ef233c`).

### 3. Sunset Palette (Light Alternative)

- **Background:** Soft Peach (`#fdf6f0`).
- **Aesthetic:** Retains the claymorphism physical feel but injects warm, vibrant coral and tangerine gradients.
- **Accent:** Vibrant Coral (`#f25c54ff`).

## Core Components

### Clay Cards & Buttons

- **Idle State:** Elevated using dual-tone shadows (dark drop shadow + white inset highlight).
- **Hover State:** Slight scale up (`1.02`) and Y-axis translation (`-4px`) for weightless elevation.
- **Active/Pressed State:** Reverses the shadows to inset, creating a physical "pushed-in" mechanical switch feeling.

### Layout Structure

- **Titlebar:** Custom immersive titlebar with auto-hiding controls to maximize screen real estate.
- **Sidebar:** Expandable (72px to 240px) with smooth `cubic-bezier(0.4, 0, 0.2, 1)` transitions and staggered text reveal.
- **Player:** Fluid grid that morphs seamlessly into Theater and Fullscreen modes, stripping away borders and rounded corners dynamically to focus entirely on the video content.

## Motion & Interaction

- **Transitions:** Globally smooth transitions for color schemes and layout shifts (`0.3s ease`).
- **Micro-interactions:** Icons transition from outlined to filled and scaled upon interaction. Loading states utilize custom SVG stroke animations or repeating linear gradient stripes for transcode progress.
