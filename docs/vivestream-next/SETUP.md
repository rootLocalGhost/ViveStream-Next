# Local Build & Setup Guide

This document outlines the workflow for setting up ViveStream-Next for development.

## Prerequisites

- **Bun (v1.0+)**: Fast all-in-one JavaScript runtime.
- **Rust (v1.80+)**: System programming language for Tauri backend.
- **System Dependencies (Linux)**:
  - `libwebkit2gtk-4.1-dev`
  - `libgtk-3-dev`
  - `libglib2.0-dev`
  - `libssl-dev`
  - `libayatana-appindicator3-dev`
  - `librsvg2-dev`
  - `libxdo-dev`

## Running Locally

1. **Install Frontend Dependencies:**
   ```bash
   bun install
   ```

2. **Run Development Server:**
   This command starts the Vite dev server for SolidJS and launches the Tauri backend. Hot-reloading is supported for the frontend, while Rust changes trigger a backend recompile.
   ```bash
   bun run tauri dev
   ```

## Running Tests

- **Frontend Tests:**
  The frontend uses Vitest.
  ```bash
  bun run test
  ```

- **Backend Tests:**
  The Rust backend uses standard Cargo tests.
  ```bash
  cargo test --manifest-path src-tauri/Cargo.toml
  ```

## Packaging & Releases

Use the provided package scripts to build production binaries.

- **Linux:**
  ```bash
  bun run build:linux
  ```

- **Windows:**
  ```bash
  bun run build:win
  ```
