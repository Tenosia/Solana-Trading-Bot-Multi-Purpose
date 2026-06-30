import { FilterQuery, UpdateQuery } from "mongoose";
import { TokenSchema } from "../models/index";

export const RaydiumTokenService = {
  create: async (props: Record<string, unknown> & { poolId: string }) => {
    try {
      const existing = await TokenSchema.findOne({ poolId: props.poolId });
      if (existing == null) {
        return await TokenSchema.create(props);
      }
      return null;
    } catch (err: unknown) {
      console.error(err);
    }
  },
  findById: async (id: string) => {
    try {
      return await TokenSchema.findById(id);
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }
  },
  findOne: async (filter: FilterQuery<unknown>) => {
    try {
      return await TokenSchema.findOne(filter).sort({ timeStamp: -1 });
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }
  },
  findLastOne: async (filter: FilterQuery<unknown>) => {
    try {
      return await TokenSchema.findOne(filter).sort({ creation_ts: 1 });
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }
  },
  find: async (filter: FilterQuery<unknown>) => {
    try {
      return await TokenSchema.find(filter);
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }
  },
  updateOne: async (id: string, update: UpdateQuery<unknown>) => {
    try {
      return await TokenSchema.findByIdAndUpdate(id, update);
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }
  },
  findOneAndUpdate: async (filter: FilterQuery<unknown>, data: UpdateQuery<unknown>) => {
    try {
      return await TokenSchema.findOneAndUpdate(filter, { $set: data }, { new: true });
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }
  },
  deleteOne: async (filter: FilterQuery<unknown>) => {
    try {
      return await TokenSchema.findOneAndDelete(filter);
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }
  },
};
