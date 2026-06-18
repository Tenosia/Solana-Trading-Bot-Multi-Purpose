# Solana Trading Bot for Telegram

A high-performance Telegram trading bot for the Solana blockchain. It lets users
discover, buy, and sell SPL tokens directly from a Telegram chat across the major
Solana liquidity venues — Raydium, Jupiter, and Pump.fun — with fast, MEV-protected
execution through JITO bundles.

The bot manages an in-chat wallet for every user, so trades can be placed without
ever exposing or importing a personal wallet private key.

## Features

- **Multi-venue trading** — buy and sell any SPL token across Raydium (AMM & CLMM),
  Jupiter aggregator routes, and Pump.fun bonding curves.
- **Token & pool discovery** — track all tokens and pools, with live price and
  market data sourced from Birdeye.
- **Fast, protected execution** — submit swaps as JITO bundles for low latency and
  MEV protection.
- **Automated trading** — configurable auto buy and auto sell rules per user.
- **Position tracking & PNL** — real-time position monitoring and generated PNL cards.
- **Built-in wallets** — a dedicated wallet is created for each user inside the bot,
  so no external private key is ever required.
- **Referral system** — referral links, referral channels, and payout tracking.
- **Background jobs** — scheduled cron tasks for SOL price updates, open-market
  cleanup, and alert delivery.

## Tech Stack

- **Language:** TypeScript (Node.js, ts-node)
- **Bot framework:** Telegram Bot API (`node-telegram-bot-api`)
- **Blockchain:** Solana `web3.js`, SPL Token
- **DEX / routing:** Raydium SDK, Jupiter API, Pump.fun
- **Execution:** JITO bundles
- **Market data:** Birdeye API
- **Storage:** MongoDB (Mongoose), Redis
- **Server:** Express
- **Scheduling:** node-cron

## Project Structure

```
src/
├── config.ts          # Environment and runtime configuration
├── bot.opts.ts        # Telegram bot options and constants
├── main.ts            # Bot bootstrap and message routing
├── controllers/       # Message and callback handlers
├── screens/           # Telegram UI screens (dashboard, trade, settings, ...)
├── services/          # Core services (trade, position, jupiter, jito, db, ...)
├── models/            # Mongoose data models
├── raydium/           # Raydium AMM/CLMM integration and helpers
├── pump/              # Pump.fun swap logic and utilities
├── utils/             # Shared helpers (transactions, signatures, ...)
└── cron/              # Scheduled background jobs
serve.ts               # Express server entry point
```

## Prerequisites

- Node.js v18 or above
- A Telegram bot token
- A MongoDB cluster URI
- A Redis URI
- A Solana RPC endpoint (HTTP and WebSocket)

## Configuration

Create a `.env` file in the project root and fill in the values below.

```
MONGODB_URL=
REDIS_URI=

# Telegram bots
GROWTRADE_BOT_ID=
GROWSOL_ALERT_BOT_ID=
BridgeBotID=
ALERT_BOT_API_TOKEN=
TELEGRAM_BOT_API_TOKEN=

# Solana RPC
MAINNET_RPC=
PRIVATE_RPC_ENDPOINT=
RPC_WEBSOCKET_ENDPOINT=

# Execution
JITO_UUID=

# Market data
BIRD_EVEY_API=

# Internal services
GROWSOL_API_ENDPOINT=
PNL_IMG_GENERATOR_API=
```

## Installation

```sh
npm install
```

## Usage

Start the bot in development mode (auto-reload):

```sh
npm run serve
```

Run once without reload:

```sh
npm start
```

Build the project:

```sh
npm run build
```

## Disclaimer

This software is provided for educational purposes only. Trading cryptocurrencies
carries significant risk. Use at your own risk; the authors accept no liability for
any losses incurred.

## License

ISC
