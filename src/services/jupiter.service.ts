import { ASSOCIATED_TOKEN_PROGRAM_ID, NATIVE_MINT, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, TokenAccountNotFoundError, TokenInvalidAccountOwnerError, createAssociatedTokenAccountInstruction, createTransferCheckedInstruction, createTransferInstruction, getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { AddressLookupTableAccount, ComputeBudgetProgram, Connection, Keypair, PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { AccountMeta, Instruction, QuoteGetRequest, SwapInstructionsResponse, SwapRequest, createJupiterApiClient } from '@jup-ag/api';
import bs58 from "bs58";
import { COMMITMENT_LEVEL, RESERVE_WALLET, connection } from "../config";
import { getSignature } from "../utils/get.signature";
import { sendTransactionV0 } from "../utils/v0.transaction";
import { JitoBundleService, tipAccounts } from "./jito.bundle";
import { FeeService } from "./fee.service";
import { fromWeiToValue } from "../utils";
import redisClient from "./redis";
import { UserTradeSettingService } from "./user.trade.setting.service";

const JUPITER_API_CONFIG = {
  basePath: "https://growtradebot.fly.dev",
};

let jupiterTradeableTokens: Array<string> = [];
export class JupiterService {
  instructionDataToTransactionInstruction(
    instruction: Instruction | undefined
  ) {
    if (instruction === null || instruction === undefined) return null;
    return new TransactionInstruction({
      programId: new PublicKey(instruction.programId),
      keys: instruction.accounts.map((key: AccountMeta) => ({
        pubkey: new PublicKey(key.pubkey),
        isSigner: key.isSigner,
        isWritable: key.isWritable,
      })),
      data: Buffer.from(instruction.data, "base64"),
    });
  };

  async getAddressLookupTableAccounts(
    keys: string[], connection: Connection
  ): Promise<AddressLookupTableAccount[]> {
    const addressLookupTableAccountInfos =
      await connection.getMultipleAccountsInfo(
        keys.map((key) => new PublicKey(key))
      );

    return addressLookupTableAccountInfos.reduce((acc, accountInfo, index) => {
      const addressLookupTableAddress = keys[index];
      if (accountInfo) {
        const addressLookupTableAccount = new AddressLookupTableAccount({
          key: new PublicKey(addressLookupTableAddress),
          state: AddressLookupTableAccount.deserialize(accountInfo.data),
        });
        acc.push(addressLookupTableAccount);
      }

      return acc;
    }, new Array<AddressLookupTableAccount>());
  };

  async checkTradableOnJupiter(
    mint: string
  ) {
    if (jupiterTradeableTokens.includes(mint)) return true;

    const key = `jugtradable_${mint}`;
    const res = await redisClient.get(key);
    if (res) {
      return JSON.parse(res) as boolean;
    }

    const jupiterQuoteApi = createJupiterApiClient(JUPITER_API_CONFIG);
    const tokens = await jupiterQuoteApi.tokensGet();
    jupiterTradeableTokens = tokens;
    const tradeable = tokens.includes(mint);
    await redisClient.set(key, JSON.stringify(tradeable));
    await redisClient.expire(key, 30);

    return tradeable;
  };
  async swapToken(
    secretKey: string,
    inputMint: string,
    outputMint: string,
    decimal: number,
    _amount: number,
    _slippage: number,
    gasFee: number,
    isFeeBurn: boolean,
    username: string,
    isToken2022: boolean
  ) {
    try {
      let total_fee_in_sol = 0;
      let total_fee_in_token = 0;
      const is_buy = inputMint === NATIVE_MINT.toString();

      // JitoFee
      const jitoFeeSetting = await UserTradeSettingService.getJitoFee(username);
      const jitoFeeValue = UserTradeSettingService.getJitoFeeValue(jitoFeeSetting);
      const jitoFeeValueWei = BigInt(Math.round(jitoFeeValue * 10 ** 9));

      const total_fee_percent = 0.01;
      let total_fee_percent_in_sol = 0.01;
      let total_fee_percent_in_token = 0;

      if (isFeeBurn) {
        total_fee_percent_in_sol = 0.0075;
        total_fee_percent_in_token = total_fee_percent - total_fee_percent_in_sol;
      }
      const slippageBps = _slippage * 100;
      const fee = _amount * (is_buy ? total_fee_percent_in_sol : total_fee_percent_in_token);
      const amount = Math.round((_amount - fee) * 10 ** decimal);
      const wallet = Keypair.fromSecretKey(bs58.decode(secretKey));

      const jupiterQuoteApi = createJupiterApiClient(JUPITER_API_CONFIG);
      const quotegetOpts: QuoteGetRequest = {
        inputMint,
        outputMint,
        amount,
        slippageBps,
        onlyDirectRoutes: false,
        asLegacyTransaction: false,
      }
      const quote = await jupiterQuoteApi.quoteGet(quotegetOpts);
      if (!quote) {
        console.error("[JupiterService] Unable to get quote");
        return null;
      }
      if (is_buy) {
        total_fee_in_sol = Math.round(fee * 10 ** decimal);
        total_fee_in_token = Math.round(Number(quote.outAmount) * total_fee_percent_in_token);
      } else {
        total_fee_in_token = Math.round(fee * 10 ** decimal);
        total_fee_in_sol = Math.round(Number(quote.outAmount) * total_fee_percent_in_sol);
      }

      const gasfeeValue = Math.round(gasFee * 10 ** 9);
      const swapReqOpts: SwapRequest = {
        quoteResponse: quote,
        userPublicKey: wallet.publicKey.toString(),
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: gasfeeValue,
      }

      const swapInstructions: SwapInstructionsResponse = await jupiterQuoteApi.swapInstructionsPost({ swapRequest: swapReqOpts });
      const {
        computeBudgetInstructions,
        setupInstructions,
        swapInstruction,
        cleanupInstruction,
        addressLookupTableAddresses,
      } = swapInstructions;


      const instructions: TransactionInstruction[] = [
        ...computeBudgetInstructions.map(this.instructionDataToTransactionInstruction),
        ...setupInstructions.map(this.instructionDataToTransactionInstruction),
        this.instructionDataToTransactionInstruction(swapInstruction),
        this.instructionDataToTransactionInstruction(cleanupInstruction),
      ].filter((ix) => ix !== null) as TransactionInstruction[];

      // JitoTipOption
      instructions.push(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: new PublicKey(tipAccounts[0]),
          lamports: jitoFeeValueWei
        })
      )

      const feeInstructions = await (new FeeService()).getFeeInstructions(
        total_fee_in_sol,
        total_fee_in_token,
        username,
        secretKey,
        is_buy ? outputMint : inputMint,
        isToken2022
      );
      instructions.push(...feeInstructions);

      const addressLookupTableAccounts = await this.getAddressLookupTableAccounts(
        addressLookupTableAddresses,
        connection
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

      const messageV0 = new TransactionMessage({
        payerKey: wallet.publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message(addressLookupTableAccounts);

      const transaction = new VersionedTransaction(messageV0);
      transaction.sign([wallet]);

      // Sign the transaction
      const signature = getSignature(transaction);

      // We first simulate whether the transaction would be successful
      const { value: simulatedTransactionResponse } =
        await connection.simulateTransaction(transaction, {
          replaceRecentBlockhash: true,
          commitment: "processed",
        });
      const { err, logs } = simulatedTransactionResponse;

      if (err) {
        console.error("[JupiterService] Simulation error:", { err, logs });
        return null;
      }

      const rawTransaction = transaction.serialize();
      const jitoBundleInstance = new JitoBundleService();
      const bundleId = await jitoBundleInstance.sendBundle(rawTransaction);
      if (!bundleId) return null;

      console.info(`[JupiterService] Bundle: ${bundleId} | TX: https://solscan.io/tx/${signature}`);

      return {
        quote,
        signature,
        total_fee_in_sol,
        total_fee_in_token,
        bundleId
      };
    } catch (e) {
      console.error("[JupiterService] swapToken failed:", e);
      return null;
    }
  }

  async getQuote(
    inputMint: string,
    outputMint: string,
    inputAmount: number,
    inDecimal: number,
    outDecimal: number
  ) {
    try {
      if (inputAmount < 0.000001) return null;

      const jupiterQuoteApi = createJupiterApiClient(JUPITER_API_CONFIG);
      const amount = Math.round(inputAmount * 10 ** inDecimal);
      const quotegetOpts: QuoteGetRequest = {
        inputMint,
        outputMint,
        amount,
        slippageBps: 2000,
        onlyDirectRoutes: false,
        asLegacyTransaction: false,
      }
      const quote = await jupiterQuoteApi.quoteGet(quotegetOpts);

      const { inAmount, outAmount, priceImpactPct } = quote;

      return {
        inputMint,
        outputMint,
        inAmount: fromWeiToValue(inAmount, inDecimal),
        outAmount: fromWeiToValue(outAmount, outDecimal),
        priceImpactPct: Number(priceImpactPct),
      } as QuoteRes;
    } catch {
      return null;
    }
  }
  async transferFeeSOL(fee: number, wallet: Keypair): Promise<void> {
    if (fee <= 0) return;
    const amount = Math.round(fee * 10 ** 9);
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const txid = await sendTransactionV0(
          connection,
          [
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5000 }),
            ComputeBudgetProgram.setComputeUnitLimit({ units: 20_000 }),
            SystemProgram.transfer({
              fromPubkey: wallet.publicKey,
              toPubkey: RESERVE_WALLET,
              lamports: amount,
            }),
          ],
          [wallet]
        );
        if (txid) {
          console.info(`[JupiterService] FeeSOL TX: https://solscan.io/tx/${txid}`);
          break;
        }
      } catch (e) {
        console.error(`[JupiterService] transferFeeSOL attempt ${attempt + 1}/5 failed:`, e);
      }
    }
  }
  async transferSOL(fundAmount: number, decimals: number, toPubkey: string, secretKey: string, microLamports: number = 5000, units: number = 20000): Promise<string | null> {
    if (fundAmount <= 0) return null;
    const wallet = Keypair.fromSecretKey(bs58.decode(secretKey));
    const amount = Math.round(fundAmount * 10 ** decimals);
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const txid = await sendTransactionV0(
          connection,
          [
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports }),
            ComputeBudgetProgram.setComputeUnitLimit({ units }),
            SystemProgram.transfer({
              fromPubkey: wallet.publicKey,
              toPubkey: new PublicKey(toPubkey),
              lamports: amount,
            }),
          ],
          [wallet]
        );
        if (txid) {
          console.info(`[JupiterService] TransferSOL TX: https://solscan.io/tx/${txid}`);
          return txid;
        }
      } catch (e) {
        console.error(`[JupiterService] transferSOL attempt ${attempt + 1}/5 failed:`, e);
      }
    }
    return null;
  }
  async transferSPL(mint: string, fundAmount: number, decimals: number, toPubkey: string, secretKey: string, isToken2022: boolean): Promise<string | null> {
    if (fundAmount <= 0) return null;
    const wallet = Keypair.fromSecretKey(bs58.decode(secretKey));

    const sourceAta = getAssociatedTokenAddressSync(
      new PublicKey(mint),
      wallet.publicKey,
      true,
      isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const destAta = getAssociatedTokenAddressSync(
      new PublicKey(mint),
      new PublicKey(toPubkey),
      true,
      isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const instructions: TransactionInstruction[] = [];
    try {
      await getAccount(connection, destAta, COMMITMENT_LEVEL, isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID);
    } catch (error: unknown) {
      if (error instanceof TokenAccountNotFoundError || error instanceof TokenInvalidAccountOwnerError) {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            destAta,
            new PublicKey(toPubkey),
            new PublicKey(mint),
            isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      } else {
        return null;
      }
    }
    const amount = Math.round(fundAmount * 10 ** decimals);

    instructions.push(
      isToken2022
        ? createTransferCheckedInstruction(
            sourceAta,
            new PublicKey(mint),
            destAta,
            wallet.publicKey,
            amount,
            decimals,
            [],
            TOKEN_2022_PROGRAM_ID
          )
        : createTransferInstruction(sourceAta, destAta, wallet.publicKey, amount)
    );

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const txid = await sendTransactionV0(
          connection,
          [
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
            ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
            ...instructions,
          ],
          [wallet]
        );
        if (txid) {
          console.info(`[JupiterService] TransferSPL TX: https://solscan.io/tx/${txid}`);
          return txid;
        }
      } catch (e) {
        console.error(`[JupiterService] transferSPL attempt ${attempt + 1}/5 failed:`, e);
      }
    }
    return null;
  }
}

export interface QuoteRes {
  inputMint: string;
  inAmount: number;
  outputMint: string;
  outAmount: number;
  priceImpactPct: number;
  priceInSol?: number
}