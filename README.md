# Telegram Solana Trading Bot (Raydium, Jupiter, Pump.fun)

## Features

- Track all tokens and all pools on Raydium (AMM, CLMM), Jupiter, and Pump.fun
- Buy and sell all SPL tokens using JITO on Raydium, Jupiter, and Pump.fun
- Auto buy/sell according to user settings
- PNL card generation
- Improved security by creating a new in-bot wallet, so the user's wallet private key is never required

## Tech Stack

- TypeScript
- Telegram Bot API
- Solana / web3
- Raydium SDK
- Jupiter API
- Pump.fun
- JITO
- Birdeye API
- MongoDB
- Redis

## Prerequisites

Before you begin, ensure you have met the following requirements:

- Node.js installed (v18 or above recommended)
- A Telegram bot token
- A MongoDB cluster URI
- A Redis URI

## Configuration

Create a new `.env` file and add your private key and RPC URL.

`.env` file

```
MONGODB_URL=
REDIS_URI=

# Local
GROWTRADE_BOT_ID=
GROWSOL_ALERT_BOT_ID=
BridgeBotID=
ALERT_BOT_API_TOKEN=
TELEGRAM_BOT_API_TOKEN=

MAINNET_RPC=
PRIVATE_RPC_ENDPOINT=
RPC_WEBSOCKET_ENDPOINT=

JITO_UUID=

BIRD_EVEY_API=

GROWSOL_API_ENDPOINT=

PNL_IMG_GENERATOR_API=
```

## Installation

```sh
npm install
```

## Running

```sh
npm run serve
```

## Build

```sh
npm run build
```

## Version

Version 1.0
