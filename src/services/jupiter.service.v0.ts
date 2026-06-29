import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  VersionedTransaction,
} from "@solana/web3.js";
import { QuoteGetRequest, SwapRequest, createJupiterApiClient } from "@jup-ag/api";
import bs58 from "bs58";
import { COMMITMENT_LEVEL, RESERVE_WALLET, connection } from "../config";
import { transactionSenderAndConfirmationWaiter } from "../utils/jupiter.transaction.sender";
import { getSignature } from "../utils/get.signature";
import { sendTransactionV0 } from "../utils/v0.transaction";

export const JupiterService = {
  swapToken: async (
    secretKey: string,
    inputMint: string,
    outputMint: string,
    decimal: number,
    _amount: number,
    _slippage: number,
    gasFee: number,
    isFeeBurn: boolean
  ) => {
    try {
      let total_fee_in_sol = 0;
      let total_fee_in_token = 0;
      const is_buy = inputMint === NATIVE_MINT.toString();

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

      const jupiterQuoteApi = createJupiterApiClient();
      const quotegetOpts: QuoteGetRequest = {
        inputMint,
        outputMint,
        amount,
        slippageBps,
        onlyDirectRoutes: false,
        asLegacyTransaction: false,
      };
      const quote = await jupiterQuoteApi.quoteGet(quotegetOpts);
      if (!quote) {
        console.error("[JupiterServiceV0] Unable to get quote");
        return null;
      }
      if (is_buy) {
        total_fee_in_sol = Math.round(fee * 10 ** decimal);
        total_fee_in_token = Math.round(Number(quote.outAmount) * total_fee_percent_in_token);
      } else {
        total_fee_in_token = Math.round(fee * 10 ** decimal);
        total_fee_in_sol = Math.round(Number(quote.outAmount) * total_fee_percent_in_sol);
      }

      const swapReqOpts: SwapRequest = {
        quoteResponse: quote,
        userPublicKey: wallet.publicKey.toString(),
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: {
          jitoTipLamports: 1_500_000,
        },
      };

      const swapResult = await jupiterQuoteApi.swapPost({ swapRequest: swapReqOpts });
      const swapTransactionBuf = Buffer.from(swapResult.swapTransaction, "base64");
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

      transaction.sign([wallet]);
      const signature = getSignature(transaction);
      const { value: simulatedTransactionResponse } = await connection.simulateTransaction(
        transaction,
        { replaceRecentBlockhash: true, commitment: "processed" }
      );
      const { err, logs } = simulatedTransactionResponse;

      if (err) {
        console.error("[JupiterServiceV0] Simulation error:", { err, logs });
        return null;
      }

      const serializedTransaction = Buffer.from(transaction.serialize());
      const blockhash = transaction.message.recentBlockhash;
      const transactionResponse = await transactionSenderAndConfirmationWaiter({
        connection,
        serializedTransaction,
        blockhashWithExpiryBlockHeight: {
          blockhash,
          lastValidBlockHeight: swapResult.lastValidBlockHeight,
        },
      });

      if (!transactionResponse) {
        console.error("[JupiterServiceV0] Transaction not confirmed");
        return null;
      }

      if (transactionResponse.meta?.err) {
        console.error("[JupiterServiceV0] TX meta error:", transactionResponse.meta?.err);
        return null;
      }

      return { quote, signature, total_fee_in_sol, total_fee_in_token };
    } catch (e) {
      console.error("[JupiterServiceV0] swapToken failed:", e);
      return null;
    }
  },

  transferFeeSOL: async (fee: number, wallet: Keypair): Promise<void> => {
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
          console.info(`[JupiterServiceV0] FeeSOL TX: https://solscan.io/tx/${txid}`);
          break;
        }
      } catch (e) {
        console.error(`[JupiterServiceV0] transferFeeSOL attempt ${attempt + 1}/5 failed:`, e);
      }
    }
  },

  transferSOL: async (
    fundAmount: number,
    decimals: number,
    toPubkey: string,
    secretKey: string,
    microLamports: number = 5000,
    units: number = 20000
  ): Promise<string | null> => {
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
          console.info(`[JupiterServiceV0] TransferSOL TX: https://solscan.io/tx/${txid}`);
          return txid;
        }
      } catch (e) {
        console.error(`[JupiterServiceV0] transferSOL attempt ${attempt + 1}/5 failed:`, e);
      }
    }
    return null;
  },

  transferSPL: async (
    mint: string,
    fundAmount: number,
    decimals: number,
    toPubkey: string,
    secretKey: string,
    isToken2022: boolean
  ): Promise<string | null> => {
    if (fundAmount <= 0) return null;
    const wallet = Keypair.fromSecretKey(bs58.decode(secretKey));
    const tokenProgramId = isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;

    const sourceAta = getAssociatedTokenAddressSync(
      new PublicKey(mint),
      wallet.publicKey,
      true,
      tokenProgramId,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const destAta = getAssociatedTokenAddressSync(
      new PublicKey(mint),
      new PublicKey(toPubkey),
      true,
      tokenProgramId,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const instructions: TransactionInstruction[] = [];
    try {
      await getAccount(connection, destAta, COMMITMENT_LEVEL, tokenProgramId);
    } catch (error: unknown) {
      if (
        error instanceof TokenAccountNotFoundError ||
        error instanceof TokenInvalidAccountOwnerError
      ) {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            destAta,
            new PublicKey(toPubkey),
            new PublicKey(mint),
            tokenProgramId,
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
          console.info(`[JupiterServiceV0] TransferSPL TX: https://solscan.io/tx/${txid}`);
          return txid;
        }
      } catch (e) {
        console.error(`[JupiterServiceV0] transferSPL attempt ${attempt + 1}/5 failed:`, e);
      }
    }
    return null;
  },
};
