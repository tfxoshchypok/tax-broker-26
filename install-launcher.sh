#!/usr/bin/env bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BINARY="$PROJECT_DIR/dist/tax-broker-26/tax-broker-26-linux_x64"
ICON_SRC="$PROJECT_DIR/public/icon.svg"
ICON_DEST="$HOME/.local/share/icons/tax-broker-26.svg"
DESKTOP_DEST="$HOME/.local/share/applications/tax-broker-26.desktop"

echo "▶ Building Tax-Broker-26..."
cd "$PROJECT_DIR"
npm run neu:build

chmod +x "$BINARY"

echo "▶ Installing icon..."
mkdir -p "$HOME/.local/share/icons"
cp "$ICON_SRC" "$ICON_DEST"

echo "▶ Installing desktop launcher..."
mkdir -p "$HOME/.local/share/applications"
cat > "$DESKTOP_DEST" <<EOF
[Desktop Entry]
Type=Application
Name=Tax-Broker-26
Comment=Облік клієнтів і звітності
Exec=$BINARY
Icon=$ICON_DEST
Terminal=false
Categories=Office;Finance;
StartupWMClass=tax-broker-26
EOF

update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true

echo "✅ Готово! Запустіть: $BINARY"
