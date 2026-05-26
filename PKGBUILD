# Maintainer: Your Name <your.email@example.com>
pkgname=vivestream-next-bin
pkgver=0.3.0
pkgrel=1
pkgdesc="A lightning-fast, natively integrated YouTube downloader and local media library."
arch=('x86_64')
url="https://github.com/rootlocalghost/ViveStream-Next"
license=('custom:PolyForm Noncommercial 1.0.0')
# We enforce hardware-acceleration dependencies here for the Arc GPU / Linux fallback matrix
depends=('webkit2gtk-4.1' 'yt-dlp' 'ffmpeg' 'intel-media-driver' 'libva-utils')
provides=('vivestream-next')
conflicts=('vivestream-next')

# Automatically pull the .deb file from your automated GitHub Release
source=("${url}/releases/download/v${pkgver}/vivestream-next_${pkgver}_amd64.deb")
sha256sums=('SKIP') # Use SKIP for automated rapid releases, or add the actual hash later

package() {
    # makepkg automatically extracts the outer .deb shell.
    # We just need to unpack the inner data folder directly into the pacman package directory.
    msg2 "Extracting Debian package into Arch package directory..."
    tar -xf "${srcdir}/data.tar."* -C "${pkgdir}"
}