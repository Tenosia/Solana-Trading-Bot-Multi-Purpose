import { MsgLogSchema } from "../models/index";
import { FilterQuery, UpdateQuery } from "mongoose";

export const MsgLogService = {
  create: async (props: Record<string, unknown>) => {
    try {
      return await MsgLogSchema.create(props);
    } catch (err: unknown) {
      console.error(err);
      throw new Error((err as Error).message);
    }
  },
  findById: async (id: string) => {
    try {
      return await MsgLogSchema.findById(id);
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }
  },
  findOne: async (filter: FilterQuery<unknown>) => {
    try {
      return await MsgLogSchema.findOne(filter).sort({ timeStamp: -1 });
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }
  },
  findLastOne: async (filter: FilterQuery<unknown>) => {
    try {
      return await MsgLogSchema.findOne(filter).sort({ updatedAt: -1 });
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }
  },
  find: async (filter: FilterQuery<unknown>) => {
    try {
      return await MsgLogSchema.find(filter);
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }
  },
  updateOne: async (id: string, props: UpdateQuery<unknown>) => {
    try {
      return await MsgLogSchema.findByIdAndUpdate(id, props);
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }
  },
  findOneAndUpdate: async (filter: FilterQuery<unknown>, data: UpdateQuery<unknown>) => {
    try {
      return await MsgLogSchema.findOneAndUpdate(filter, { $set: data }, { new: true });
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }
  },
  deleteOne: async (filter: FilterQuery<unknown>) => {
    try {
      return await MsgLogSchema.findOneAndDelete(filter);
    } catch (err: unknown) {
      throw new Error((err as Error).message);
    }
  },
};
