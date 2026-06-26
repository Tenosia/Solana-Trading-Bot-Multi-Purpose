import TelegramBot from "node-telegram-bot-api";
import redisClient from "./redis";
import {
  ALERT_GB_IMAGE,
  ALERT_GT_IMAGE,
  AlertBotID,
  BridgeBotID,
  TradeBotID,
} from "../bot.opts";
import {
  getReferralList,
  update_channel_id,
} from "./referral.service";
import { ReferralIdenticalType } from "../main";
import {
  ReferralChannelService,
  ReferralPlatform,
} from "./referral.channel.service";

type ReferralChannel = {
  chat_id: string;
  channel_name: string;
};
export type ReferralData = {
  channels: ReferralChannel[];
  referral_code: string;
  creator: string;
  platform: ReferralPlatform;
  schedule: string;
};

export const alertbotModule = async (bot: TelegramBot) => {
  try {
    const referrals = await getReferralList();
    if (!referrals) return;
    for (const referral of referrals) {
      await processReferral(referral, bot);
    }
  } catch (e) {
    console.error("alertbotModule error:", e);
  }
};

const processReferral = async (referral: ReferralData, bot: TelegramBot) => {
  try {
    const { creator, referral_code, channels, platform, schedule } = referral;
    const scheduleInSeconds = Math.max(0, Number(schedule)) * 60;
    const isValid = await validateSchedule(referral_code, scheduleInSeconds);
    if (!isValid) return;

    const isTradeBot = Number(platform) === ReferralPlatform.TradeBot;
    for (let idx = 0; idx < channels.length; idx++) {
      const { chat_id } = channels[idx];
      await sendAlert(bot, chat_id, referral_code, creator, idx, isTradeBot);
    }
  } catch (e) {
    console.error("processReferral error:", e);
  }
};

const sendAlert = async (
  bot: TelegramBot,
  channelChatId: string,
  referral_code: string,
  creator: string,
  idx: number,
  isTradeBot: boolean
) => {
  try {
    if (!channelChatId) return;
    await bot.getChat(channelChatId);

    const botId = isTradeBot ? TradeBotID : BridgeBotID;
    const botImg = isTradeBot ? ALERT_GT_IMAGE : ALERT_GB_IMAGE;
    const txt = isTradeBot ? "Try GrowTrade Now" : "Try GrowBridge Now";
    const referralLink = `https://t.me/${botId}?start=${referral_code}`;

    const inline_keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: txt, url: referralLink }],
    ];
    if (isTradeBot) {
      inline_keyboard.push([
        { text: "Trade with us 📈", url: "https://t.me/GrowTradeOfficial" },
      ]);
    }

    await bot.sendPhoto(channelChatId, botImg, {
      caption: "",
      reply_markup: { inline_keyboard },
      parse_mode: "HTML",
    });
  } catch (error) {
    console.error("sendAlert error:", channelChatId, referral_code);
    await handleSendError(error, creator, idx, channelChatId);
  }
};

const handleSendError = async (
  error: unknown,
  creator: string,
  idx: number,
  channelChatId: string
) => {
  try {
    const errMsg =
      (error as any)?.response?.body?.description ?? "";
    if (!errMsg.includes("chat not found")) return;

    const lastNum = await redisClient.get(channelChatId);
    if (!lastNum) {
      await redisClient.set(channelChatId, "0");
      return;
    }

    const retryCounter = parseInt(lastNum) + 1;
    if (retryCounter <= 3) {
      await redisClient.set(channelChatId, String(retryCounter));
      return;
    }

    await redisClient.del(channelChatId);
    const res = await update_channel_id(creator, idx, "delete");
    if (!res) {
      console.error("ServerError: cannot remove channel", creator, idx);
    }
  } catch {
    // Suppress secondary errors during error handling
  }
};

const validateSchedule = async (referral_code: string, schedule: number) => {
  try {
    const last_ts = await redisClient.get(referral_code);
    const timestamp = Math.floor(Date.now() / 1000);
    if (!last_ts) {
      await redisClient.set(referral_code, String(timestamp));
      return true;
    }
    if (timestamp - Number(last_ts) > schedule) {
      await redisClient.set(referral_code, String(timestamp));
      return true;
    }
    return false;
  } catch (e) {
    console.error("validateSchedule error:", e);
    return false;
  }
};

export const newReferralChannelHandler = async (msg: TelegramBot.Message) => {
  try {
    const { chat, from, new_chat_members } = msg;
    if (!from || !new_chat_members || !from.username) return null;
    if (from.is_bot) return null;

    const alertbotInfo = new_chat_members.find(
      (member) => member.username === AlertBotID
    );
    if (!alertbotInfo) return null;

    return {
      chatId: chat.id.toString(),
      referrer: from.username,
      channelName: chat.title ?? "",
      messageId: msg.message_id.toString(),
    } as ReferralIdenticalType;
  } catch (e) {
    console.error("newReferralChannelHandler error:", e);
    return null;
  }
};

export const removeReferralChannelHandler = async (
  msg: TelegramBot.Message
) => {
  try {
    const { chat, from, left_chat_member } = msg;
    if (!from || !left_chat_member || !from.username) return;
    if (from.is_bot) return;
    if (left_chat_member.username !== AlertBotID) return;

    const referralChannelService = new ReferralChannelService();
    await referralChannelService.deleteReferralChannel({
      creator: from.username,
      chat_id: chat.id.toString(),
      channel_name: chat.title,
    });
  } catch (e) {
    console.error("removeReferralChannelHandler error:", e);
  }
};

export const sendAlertForOurChannel = async (alertBot: TelegramBot) => {
  try {
    const chat_id = "-1002138253167";
    await alertBot.getChat(chat_id);
    await alertBot.sendPhoto(chat_id, ALERT_GT_IMAGE, {
      caption: "",
      reply_markup: {
        inline_keyboard: [
          [{ text: "Try GrowBridge now!", url: `https://t.me/${TradeBotID}` }],
        ],
      },
      parse_mode: "HTML",
    });
  } catch (e) {
    console.error("sendAlertForOurChannel error:", e);
  }
};
