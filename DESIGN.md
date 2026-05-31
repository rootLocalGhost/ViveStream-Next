# ViveStream-Next: Design Language

## Core Philosophy

ViveStream-Next utilizes a purely tactile, performance-first **Claymorphism** design across both Light and Dark modes. The interface feels physical, responsive, and native to the desktop while maintaining zero Virtual DOM overhead via SolidJS. We explicitly avoid sharp corners, generic flat UIs, and brutalist borders in favor of soft elevations, rounded pills, and extruded shapes.

## Typography

- **Display/Headings:** `MajorMonoDisplay` - Gives the app a distinct, technical edge while remaining highly stylized.
- **Body:** `Poppins` - Ensures maximum legibility for dense data, descriptions, and settings menus.

## Themes & Color Palettes

The app utilizes CSS variables to switch between structural feels, applying universal Claymorphism logic to ensure physical consistency regardless of the theme.

### 1. Dark Mode (Matte Clay)

- **Background:** Soft, deep matte gray-blue (`#1e1e24` & `#25262c`). We avoid pure black (`#000000`) because it cannot cast a darker drop shadow, which destroys the 3D clay effect.
- **Aesthetic:** Heavy, semi-transparent black drop shadows paired with razor-thin, faint white inner highlights to simulate light hitting curved plastic edges.
- **Border Radius:** Fully rounded (`24px` to `32px` pills).
- **Accent:** Dynamically shifts based on the active palette (Sunset or Crimson).

### 2. Light Mode: Sunset (The Brand Default)

- **Background:** Soft, warm Peachy Cream (`#fdf6f0`).
- **Aesthetic:** Highly elevated physical elements utilizing warm, orange-tinted shadows to simulate ambient light bleed.
- **Accent:** Vibrant Coral/Tangerine (`#f25c54`).

### 3. Light Mode: Crimson (The Alternative)

- **Background:** Faint, cool Rose Tint (`#fff0f2`).
- **Aesthetic:** Retains the physical claymorphism feel but replaces the warm orange ambient light bleed with a subtle ruby/red tint.
- **Accent:** Vibrant Red (`#ef233c`).

## Core Components

### Clay Cards, Inputs, & Buttons

- **Shape Logic:** All interactive elements (buttons, inputs, dropdowns) are perfect circles or highly rounded pills. Sharp corners are forbidden.
- **Idle State:** Elevated using dual-tone shadows (dark outset shadow for elevation + white inset highlight for volume).
- **Hover State:** Slight scale up and Y-axis negative translation for weightless elevation.
- **Active/Pressed State:** Instantly reverses shadows from outset to heavy inset, creating a satisfying, physical "pushed-in" mechanical switch feeling.

### Layout Structure

- **Titlebar:** Custom immersive titlebar with auto-hiding controls to maximize screen real estate.
- **Sidebar:** Expandable (72px to 240px) with smooth transitions and staggered text reveal.
- **Player:** Fluid grid that morphs seamlessly into Theater and Fullscreen modes.

## Motion & Interaction

- **Transitions:** Globally smooth transitions for color schemes and layout shifts (`0.3s ease`).
- **Micro-interactions:** Icons transition from outlined to filled and scaled upon interaction. Loading states utilize repeating linear gradient stripes for transcode progress.
