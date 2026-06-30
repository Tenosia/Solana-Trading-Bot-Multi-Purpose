import redisClient from "./redis";

export const setFlagForBundleVerify = async (username: string): Promise<void> => {
  const key = `${username}_wait_bundle`;
  await redisClient.set(key, "true", { EX: 30 });
};

export const waitFlagForBundleVerify = async (username: string): Promise<boolean> => {
  const key = `${username}_wait_bundle`;
  const res = await redisClient.get(key);
  return res !== null;
};
