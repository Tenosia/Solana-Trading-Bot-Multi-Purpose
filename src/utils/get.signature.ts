import bs58 from "bs58";
import { Transaction, VersionedTransaction } from "@solana/web3.js";

export function getSignature(
  transaction: Transaction | VersionedTransaction
): string {
  let rawSignature: Uint8Array | Buffer | null | undefined;

  if (transaction instanceof VersionedTransaction) {
    rawSignature = transaction.signatures[0];
  } else {
    rawSignature = transaction.signature;
  }

  if (!rawSignature) {
    throw new Error(
      "Missing transaction signature, the transaction was not signed by the fee payer"
    );
  }
  return bs58.encode(rawSignature);
}
