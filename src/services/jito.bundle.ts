import bs58 from "bs58";
import axios from "axios";
import { wait } from "../utils/wait";
import { JITO_UUID, MAX_CHECK_JITO } from "../config";

type Region = "ams" | "ger" | "ny" | "tokyo";

export const endpoints: Record<Region, string> = {
  ams: "https://amsterdam.mainnet.block-engine.jito.wtf",
  ger: "https://frankfurt.mainnet.block-engine.jito.wtf",
  ny: "https://ny.mainnet.block-engine.jito.wtf",
  tokyo: "https://tokyo.mainnet.block-engine.jito.wtf",
};

const regions: Region[] = ["ams", "ger", "ny", "tokyo"];
let regionIdx = 0;

export const JitoTipAmount = 750_000; // lamports (~0.00075 SOL)

export const tipAccounts = [
  "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
  "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
  "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
  "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
  "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
  "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
  "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
  "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
];

export class JitoBundleService {
  endpoint: string;

  constructor() {
    regionIdx = (regionIdx + 1) % regions.length;
    this.endpoint = endpoints[regions[regionIdx]];
  }

  updateRegion() {
    regionIdx = (regionIdx + 1) % regions.length;
    this.endpoint = endpoints[regions[regionIdx]];
  }

  async sendBundle(serializedTransaction: Uint8Array): Promise<string | null> {
    const encodedTx = bs58.encode(serializedTransaction);
    const jitoURL = `${this.endpoint}/api/v1/bundles?uuid=${JITO_UUID}`;
    const payload = {
      jsonrpc: "2.0",
      id: 1,
      method: "sendBundle",
      params: [[encodedTx]],
    };

    try {
      const response = await axios.post(jitoURL, payload, {
        headers: { "Content-Type": "application/json" },
      });
      return response.data.result;
    } catch (error) {
      console.error("JitoBundleService.sendBundle failed:", error);
      return null;
    }
  }

  async sendTransaction(serializedTransaction: Uint8Array): Promise<string | null> {
    const encodedTx = bs58.encode(serializedTransaction);
    const jitoURL = `${this.endpoint}/api/v1/transactions`;
    const payload = {
      jsonrpc: "2.0",
      id: 1,
      method: "sendTransaction",
      params: [encodedTx],
    };

    try {
      const response = await axios.post(jitoURL, payload, {
        headers: { "Content-Type": "application/json" },
      });
      return response.data.result;
    } catch (error) {
      console.error("JitoBundleService.sendTransaction failed:", error);
      throw new Error("Jito sendTransaction failed");
    }
  }

  async getBundleStatus(bundleId: string): Promise<boolean> {
    const payload = {
      jsonrpc: "2.0",
      id: 1,
      method: "getBundleStatuses",
      params: [[bundleId]],
    };

    for (let attempt = 0; attempt < MAX_CHECK_JITO; attempt++) {
      try {
        this.updateRegion();
        const jitoURL = `${this.endpoint}/api/v1/bundles?uuid=${JITO_UUID}`;
        const response = await axios.post(jitoURL, payload, {
          headers: { "Content-Type": "application/json" },
        });

        const values = response?.data?.result?.value;
        if (!values || values.length === 0) {
          await wait(1000);
          continue;
        }

        const status = values[0]?.confirmation_status;
        if (status === "confirmed" || status === "finalized") {
          console.log("JitoBundle confirmed:", bundleId);
          return true;
        }
      } catch {
        console.error("JitoBundleService.getBundleStatus poll failed, attempt", attempt + 1);
      }

      await wait(1000);
    }

    return false;
  }
}
