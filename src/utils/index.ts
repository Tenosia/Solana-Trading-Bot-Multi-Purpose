import { BIRDEYE_API_URL, REQUEST_HEADER } from "../config";
import redisClient from "../services/redis";

export function isValidWalletAddress(address: string): boolean {
  if (!address) return false;
  const pattern: RegExp = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

  return pattern.test(address);
}

export const generateReferralCode = (length: number) => {
  let code = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (let i = 0; i < length; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}

export function formatNumber(number: bigint | string | number) {
  if (!number) return "0";
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatKMB(val: bigint | string | number) {
  if (!val) return "0";
  const num = Number(val);
  if (isNaN(num)) return "0";
  if (num > 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (num > 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num > 1_000) {
    return `${(num / 1_000).toFixed(1)}k`;
  }
  return num.toFixed(3);
}

export const contractLink = (mint: string) => {
  return `<a href="https://solscan.io/token/${mint}">Contract</a>`;
}

export const birdeyeLink = (mint: string) => {
  return `<a href="https://birdeye.so/token/${mint}?chain=solana">Birdeye</a>`;
}

export const dextoolLink = (mint: string) => {
  return `<a href="https://www.dextools.io/app/en/solana/pair-explorer/${mint}">Dextools</a>`;
}

export const dexscreenerLink = (mint: string) => {
  return `<a href="https://dexscreener.com/solana/${mint}">Dexscreener</a>`;
}

export function formatPrice(price: number) {
  if (!price || price <= 0) return "0";
  if (price < 1) {
    let decimal = 15;
    while (decimal > 0 && price * 10 ** decimal >= 1) {
      decimal--;
    }
    return price.toFixed(Math.min(decimal + 3, 20));
  }
  return price.toFixed(2);
}

export const getPrice = async (mint: string): Promise<number> => {
  const key = `${mint}_price`;
  try {
    const cached = await redisClient.get(key);
    if (cached) {
      return Number(cached);
    }
    const options = { method: 'GET', headers: REQUEST_HEADER };
    const response = await fetch(`https://public-api.birdeye.so/defi/price?address=${mint}`, options);
    if (!response.ok) {
      throw new Error(`Birdeye API error: ${response.status}`);
    }
    const res = await response.json();
    const price = res?.data?.value;
    if (price == null) {
      return 0;
    }
    await redisClient.set(key, price);
    await redisClient.expire(key, 5);
    return Number(price);
  } catch (e) {
    console.error(`getPrice failed for ${mint}:`, e);
    return 0;
  }
};

export const copytoclipboard = (text: string) => {
  return `<code>${text}</code>`;
}

export const isEqual = (a: number, b: number) => {
  return Math.abs(b - a) < 0.001;
}

export const fromWeiToValue = (wei: string | number, decimal: number) => {
  return Number(wei) / 10 ** decimal;
}
