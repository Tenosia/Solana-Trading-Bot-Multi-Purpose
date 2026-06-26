import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { get_referral_info } from "./referral.service";
import { RESERVE_WALLET } from "../config";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createBurnInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

export class FeeService {
  async getFeeInstructions(
    total_fee_in_sol: number,
    total_fee_in_token: number,
    username: string,
    secretKey: string,
    mint: string,
    isToken2022: boolean
  ): Promise<TransactionInstruction[]> {
    try {
      const wallet = Keypair.fromSecretKey(bs58.decode(secretKey));
      const ref_info = await get_referral_info(username);

      const referralWallet: PublicKey = ref_info?.referral_address
        ? new PublicKey(ref_info.referral_address)
        : RESERVE_WALLET;

      const referralFeePercent = ref_info?.referral_option ?? 0;
      const referralFee = Math.round((total_fee_in_sol * referralFeePercent) / 100);
      const reserverStakingFee = total_fee_in_sol - referralFee;

      const instructions: TransactionInstruction[] = [];

      if (reserverStakingFee > 0) {
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: RESERVE_WALLET,
            lamports: reserverStakingFee,
          })
        );
      }

      if (referralFee > 0) {
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: referralWallet,
            lamports: referralFee,
          })
        );
      }

      if (total_fee_in_token) {
        const tokenProgramId = isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
        const ata = getAssociatedTokenAddressSync(
          new PublicKey(mint),
          wallet.publicKey,
          true,
          tokenProgramId
        );
        instructions.push(
          createBurnInstruction(
            ata,
            new PublicKey(mint),
            wallet.publicKey,
            BigInt(total_fee_in_token),
            [],
            tokenProgramId
          )
        );
      }

      return instructions;
    } catch (e) {
      console.error("FeeService.getFeeInstructions error:", e);
      return [];
    }
  }
}
