import { Connection, Keypair, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { getSignature } from "./get.signature";
import { transactionSenderAndConfirmationWaiter } from "./jupiter.transaction.sender";
import { wait } from "./wait";
import { connection } from "../config";

const COMMITMENT_LEVEL = 'confirmed';

export async function sendTransactionV0(
  connection: Connection,
  instructions: TransactionInstruction[],
  payers: Keypair[],
): Promise<string | null> {
  const latestBlockhash = await connection.getLatestBlockhash(COMMITMENT_LEVEL);

  const messageV0 = new TransactionMessage({
    payerKey: payers[0].publicKey,
    recentBlockhash: latestBlockhash.blockhash,
    instructions,
  }).compileToV0Message();

  const transaction = new VersionedTransaction(messageV0);
  transaction.sign(payers);
  const signature = getSignature(transaction);

  const { value: simulatedTransactionResponse } =
    await connection.simulateTransaction(transaction, {
      replaceRecentBlockhash: true,
      commitment: "processed",
    });
  const { err, logs } = simulatedTransactionResponse;

  if (err) {
    console.error("Simulation Error:", { err, logs });
    return null;
  }

  const serializedTransaction = Buffer.from(transaction.serialize());
  const blockhash = transaction.message.recentBlockhash;

  const transactionResponse = await transactionSenderAndConfirmationWaiter({
    connection,
    serializedTransaction,
    blockhashWithExpiryBlockHeight: {
      blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
  });

  if (!transactionResponse) {
    console.error("Transaction not confirmed:", signature);
    return null;
  }

  if (transactionResponse.meta?.err) {
    console.error("Transaction meta error:", transactionResponse.meta.err);
    return null;
  }

  return signature;
}

export const getSignatureStatus = async (signature: string): Promise<boolean> => {
  try {
    const MAX_RETRIES = 30;
    let confirmed = false;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      await wait(1_000);

      const tx = await connection.getSignatureStatus(signature, {
        searchTransactionHistory: false,
      });

      if (tx?.value?.err) {
        console.log("Transaction failed:", signature);
        break;
      }

      const status = tx?.value?.confirmationStatus;
      if (status === "confirmed" || status === "finalized") {
        confirmed = true;
        console.log("Transaction confirmed:", signature);
        break;
      }
    }

    return confirmed;
  } catch (e) {
    console.error("getSignatureStatus error:", e);
    return false;
  }
}
