# Setup Instructions

## Prerequisites

- **Node.js** (v18 or higher) — [Download](https://nodejs.org)
- **npm** (comes with Node.js)

## Installation

### 1. Install Dependencies

```bash
npm install
```

**Error: `socks-proxy-agent` not found?**
- This means `npm install` hasn't been completed yet. Run the command above first.

### 2. Ensure Data Files Exist

The server expects two data files in the `data/` folder:

- **`data/proxies.txt`** — List of proxy URLs (one per line), e.g.:
  ```
  http://10.0.0.1:8080
  socks5://proxy.example.com:1080
  ```

- **`data/uas.txt`** — List of User-Agent strings (one per line), e.g.:
  ```
  Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
  Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36
  ```

If these files don't exist, create them as empty files (the server will still run, but proxies/UAs won't be loaded).

## Running the Server

### Development Mode (Client + Server)

```bash
npm run dev
```

This starts:
- **Frontend**: http://localhost:5173 (Vite dev server)
- **Backend**: http://localhost:3000 (Express server)

### Server Only

```bash
npm run dev:server
```

### Client Only

```bash
npm run dev:client
```

### Production Build

```bash
npm run build
npm start
```

## Troubleshooting

### Error: `Cannot find module 'socks-proxy-agent'`

**Solution**: Run `npm install` to install all dependencies.

```bash
npm install
```

### Error: `Port 3000 already in use`

**Solution**: Change the server port in `server/index.ts` or kill the process using port 3000.

### Error: `Cannot find module 'ts-node'` or TypeScript errors

**Solution**: Ensure all dev dependencies are installed:

```bash
npm install --save-dev
```

## Supported Attack Methods

- `HTTP/Flood` — Basic HTTP flood
- `HTTP/Bypass` — HTTP flood with WAF bypass
- `HTTP/Slowloris` — Slowloris-style attack
- `HTTPS/Flood` — HTTPS flood
- `TCP/Flood` — Raw TCP flood
- `Minecraft/Ping` — Minecraft server ping attack

## Features

- **Dark Mode** — Toggle in the UI
- **Presets** — Save and load attack configurations
- **History** — View past attacks
- **Simulation Mode** — Test without network traffic
- **Client/Server Specs** — View device and server information
- **Proxy Support** — Configure custom proxies and user agents

## Security Note

This tool is designed for **educational and authorized testing purposes only**. Unauthorized attacks are illegal.

---

Need help? Check the `README.md` for more details.
