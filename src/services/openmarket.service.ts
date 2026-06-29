import { OpenMarketSchema } from "../models/index";
import { FilterQuery, UpdateQuery } from "mongoose";

export const OpenMarketService = {
  create: async (props: Record<string, unknown>) => {
    try {
      return await OpenMarketSchema.create(props);
    } catch (err: unknown) {
      console.error(err);
      throw new Error((err as Error).message);
    }
  },
  findById: async (id: string) => {
    try {
      return await OpenMarketSchema.findById(id);
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }
  },
  findOne: async (filter: FilterQuery<unknown>) => {
    try {
      return await OpenMarketSchema.findOne(filter).sort({ timeStamp: -1 });
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }
  },
  findLastOne: async (filter: FilterQuery<unknown>) => {
    try {
      return await OpenMarketSchema.findOne(filter).sort({ updatedAt: -1 });
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }
  },
  find: async (filter: FilterQuery<unknown>) => {
    try {
      return await OpenMarketSchema.find(filter);
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }
  },
  updateOne: async (id: string, props: UpdateQuery<unknown>) => {
    try {
      return await OpenMarketSchema.findByIdAndUpdate(id, props);
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }
  },
  findOneAndUpdate: async (filter: FilterQuery<unknown>, data: UpdateQuery<unknown>) => {
    try {
      return await OpenMarketSchema.findOneAndUpdate(filter, { $set: data }, { new: true });
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }
  },
  deleteOne: async (filter: FilterQuery<unknown>) => {
    try {
      return await OpenMarketSchema.findOneAndDelete(filter);
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }
  },
};
