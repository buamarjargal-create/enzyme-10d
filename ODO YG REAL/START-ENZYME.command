#!/bin/bash
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js (18+) суулгаагүй байна: https://nodejs.org"; read -p "Enter дарна уу"; exit 1; }
node server.js
