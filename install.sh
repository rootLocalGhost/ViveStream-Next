#!/bin/bash
set -e

echo ":: Preparing ViveStream-Next for installation..."

# Ensure core Arch Linux build dependencies are present (Using webkit2gtk-4.1 for Tauri v2)
sudo pacman -S --needed base-devel webkit2gtk-4.1 curl wget unzip

# Verify Bun
if ! command -v bun &> /dev/null; then
    echo ">> Error: 'bun' is missing. Install it first."
    exit 1
fi

echo ":: Installing Node dependencies..."
bun install

echo ":: Building Tauri release binary (Forcing .deb to bypass missing linuxdeploy/fuse2)..."
bun run tauri build --bundles deb

echo ":: Installing to /usr/local/bin..."
sudo cp src-tauri/target/release/vivestream-next /usr/local/bin/
sudo chmod +x /usr/local/bin/vivestream-next

echo ":: Installing Desktop Entry & Icons..."
# Use universal /usr/share/ for strict Arch Linux XDG compliance
sudo mkdir -p /usr/share/icons/hicolor/512x512/apps/
sudo mkdir -p /usr/share/applications/

# Copy the icon
sudo cp src-tauri/icons/icon.png /usr/share/icons/hicolor/512x512/apps/vivestream-next.png 2>/dev/null || echo "Icon not found, skipping..."

# Create the desktop shortcut
echo "[Desktop Entry]
Version=1.0
Name=ViveStream
Exec=vivestream-next
Icon=vivestream-next
Type=Application
Categories=AudioVideo;Network;Video;
Terminal=false" | sudo tee /usr/share/applications/vivestream-next.desktop > /dev/null

# Ensure the launcher actually has permission to read the file
sudo chmod 644 /usr/share/applications/vivestream-next.desktop

# Force refresh the desktop database and icon cache
sudo update-desktop-database /usr/share/applications/ || true
sudo gtk-update-icon-cache -f -t /usr/share/icons/hicolor/ 2>/dev/null || true

echo ":: Success. ViveStream is now in your app launcher."