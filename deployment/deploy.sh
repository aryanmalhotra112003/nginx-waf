#!/usr/bin/env bash
# Bootstrap Docker + Compose on Ubuntu 24.04 (EC2-friendly).
# Run with: sudo bash deploy.sh

set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

echo "==> apt update / upgrade (minimal)"
apt-get update -y
apt-get upgrade -y

echo "==> Install prerequisites"
apt-get install -y ca-certificates curl gnupg

echo "==> Docker official repo"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${VERSION_CODENAME:-noble}") stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "==> Enable Docker"
systemctl enable --now docker

echo "==> 2GB swap file (reduce OOM during frontend builds)"
SWAP_FILE="/swapfile_ec2"
if swapon --show | grep -q "^${SWAP_FILE}"; then
  echo "Swap already active on ${SWAP_FILE}"
else
  if [[ ! -f "${SWAP_FILE}" ]]; then
    fallocate -l 2G "${SWAP_FILE}" || dd if=/dev/zero of="${SWAP_FILE}" bs=1M count=2048
    chmod 600 "${SWAP_FILE}"
    mkswap "${SWAP_FILE}"
  fi
  swapon "${SWAP_FILE}"
  if ! grep -qF "${SWAP_FILE}" /etc/fstab; then
    echo "${SWAP_FILE} none swap sw 0 0" >> /etc/fstab
  fi
fi
swapon --show

echo "==> Done. Use: docker compose version && docker --version"
