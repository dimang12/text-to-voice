#!/usr/bin/env bash
# One-time setup for a fresh Ubuntu 24.04 host: swap, Docker, project directory.
set -euo pipefail

if ! swapon --show | grep -q swapfile; then
  sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile >/dev/null && sudo swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swappiness.conf >/dev/null && sudo sysctl -q -p /etc/sysctl.d/99-swappiness.conf
fi

if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh >/dev/null
  sudo usermod -aG docker "$USER"
fi

sudo mkdir -p /opt/voice-studio && sudo chown "$USER":"$USER" /opt/voice-studio
echo "setup done: swap=$(swapon --show --noheadings | awk '{print $3}'), docker=$(docker --version | cut -d' ' -f3)"
