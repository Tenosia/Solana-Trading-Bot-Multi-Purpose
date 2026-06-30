import { FilterQuery, UpdateQuery } from "mongoose";
import { PositionSchema } from "../models/index";

export const PositionService = {
  create: async (props: Record<string, unknown>) => {
    try {
      return await PositionSchema.create(props);
    } catch (err: unknown) {
      console.error(err);
      throw new Error((err as Error).message);
    }
  },
  findById: async (id: string) => {
    try {
      return await PositionSchema.findById(id);
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }
  },
  findOne: async (filter: FilterQuery<unknown>) => {
    try {
      return await PositionSchema.findOne(filter);
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }
  },
  findLastOne: async (filter: FilterQuery<unknown>) => {
    try {
      return await PositionSchema.findOne(filter).sort({ updatedAt: -1 });
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }
  },
  find: async (filter: FilterQuery<unknown>) => {
    try {
      return await PositionSchema.find(filter);
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }
  },
  findAndSort: async (filter: FilterQuery<unknown>) => {
    try {
      return await PositionSchema.find(filter).sort({ retired: 1, nonce: 1 });
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }
  },
  updateOne: async (id: string, update: UpdateQuery<unknown>) => {
    try {
      return await PositionSchema.findByIdAndUpdate(id, update);
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }
  },
  findAndUpdateOne: async (filter: FilterQuery<unknown>, update: UpdateQuery<unknown>) => {
    try {
      return await PositionSchema.findOneAndUpdate(filter, update, { new: true });
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }
  },
  deleteOne: async (filter: FilterQuery<unknown>) => {
    try {
      return await PositionSchema.findOneAndDelete(filter);
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }
  },
  updateBuyPosition: async (params: {
    wallet_address: string;
    mint: string;
    chat_id?: string;
    username?: string;
    volume: number;
    amount: number;
  }) => {
    const { wallet_address, mint, chat_id, username, volume, amount } = params;
    let position = await PositionSchema.findOne({ wallet_address, mint });
    if (!position) {
      position = new PositionSchema({ wallet_address, mint, chat_id, username, volume, sol_amount: amount });
    } else {
      position.volume += volume;
      position.sol_amount += amount;
    }
    await position.save();
  },
  updateSellPosition: async function (params: {
    wallet_address: string;
    mint: string;
    chat_id?: string;
    username?: string;
    percent: number;
  }) {
    const { wallet_address, mint, chat_id, username, percent } = params;
    const position = await this.findOne({ wallet_address, mint, chat_id, username });
    if (!position) return null;

    if (percent >= 100) {
      position.sol_amount = 0;
      position.volume = 0;
    } else {
      position.sol_amount = position.sol_amount * (100 - percent) / 100;
      position.volume = position.volume * (100 - percent) / 100;
    }
    await position.save();
    return position;
  },
};
