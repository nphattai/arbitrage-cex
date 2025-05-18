import * as ccxt from "ccxt";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

// === Config ===
const TELEGRAM_BOT_TOKEN: string = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID: string = process.env.TELEGRAM_CHAT_ID || "";
const SYMBOL: string = process.env.SYMBOL || "";
const SPREAD_THRESHOLD: number = Number(process.env.SPREAD_THRESHOLD) || 0.005;
const PRIMARY_EXCHANGE: string = process.env.PRIMARY_EXCHANGE || "";
const SECONDARY_EXCHANGE: string = process.env.SECONDARY_EXCHANGE || "";

interface Order {
  bid: { price: number; amount: number } | null;
  ask: { price: number; amount: number } | null;
}

interface Prices {
  primary: Order;
  secondary: Order;
}

const exchanges: Record<string, ccxt.Exchange> = {
  binance: new ccxt.pro.binance(),
  bitget: new ccxt.pro.bitget(),
  mexc: new ccxt.pro.mexc(),
  bitfinex: new ccxt.pro.bitfinex(),
  bitmex: new ccxt.pro.bitmex(),
  bybit: new ccxt.pro.bybit(),
};

const prices: Prices = {
  primary: { bid: null, ask: null },
  secondary: { bid: null, ask: null },
};

// === Telegram Alert ===
async function sendTelegramMessage(message: string): Promise<void> {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message }),
    });
  } catch (err) {
    console.error("Telegram error:", (err as Error).message);
  }
}

// === Arbitrage Check ===
async function checkArbitrage(): Promise<void> {
  const primaryPrice = prices.primary;
  const secondaryPrice = prices.secondary;

  if (
    !primaryPrice.bid ||
    !primaryPrice.ask ||
    !secondaryPrice.bid ||
    !secondaryPrice.ask
  )
    return;

  const spread1 =
    (secondaryPrice.bid.price - primaryPrice.ask.price) /
    primaryPrice.ask.price;
  const amount1 = Math.min(primaryPrice.ask.amount, secondaryPrice.bid.amount);
  const profit1 = amount1 * (secondaryPrice.bid.price - primaryPrice.ask.price);

  const spread2 =
    (primaryPrice.bid.price - secondaryPrice.ask.price) /
    secondaryPrice.ask.price;
  const amount2 = Math.min(secondaryPrice.ask.amount, primaryPrice.bid.amount);
  const profit2 = amount2 * (primaryPrice.bid.price - secondaryPrice.ask.price);

  const token = SYMBOL.split("/")[0];

  // Clear console and show current prices
  console.clear();
  console.log("\n=== Current Prices ===");
  console.log(
    `${PRIMARY_EXCHANGE}: Bid ${primaryPrice.bid.price} - ${primaryPrice.bid.amount} | Ask ${primaryPrice.ask.price} - ${primaryPrice.ask.amount}`
  );
  console.log(
    `${SECONDARY_EXCHANGE}:    Bid ${secondaryPrice.bid.price} - ${secondaryPrice.bid.amount} | Ask ${secondaryPrice.ask.price} - ${secondaryPrice.ask.amount}`
  );
  console.log("\n=== Price Gaps ===");
  console.log(
    `${PRIMARY_EXCHANGE} -> ${SECONDARY_EXCHANGE} Gap: ${(
      spread1 * 100
    ).toFixed(2)}% => ${amount1} ${token} => ${profit1.toFixed(4)} USDT`
  );
  console.log(
    `${SECONDARY_EXCHANGE} -> ${PRIMARY_EXCHANGE} Gap: ${(
      spread2 * 100
    ).toFixed(2)}% => ${amount2} ${token} => ${profit2.toFixed(4)} USDT`
  );
  console.log("===================\n");

  if (spread1 > SPREAD_THRESHOLD) {
    const msg = `🔥 Arbitrage ${token}: Buy ${PRIMARY_EXCHANGE} @ ${
      primaryPrice.ask.price
    }, Sell ${SECONDARY_EXCHANGE} @ ${secondaryPrice.bid.price}\nSpread: ${(
      spread1 * 100
    ).toFixed(2)}% => ${amount1} ${token} => ${profit1.toFixed(4)} USDT`;
    console.log(msg);
    await sendTelegramMessage(msg);
  }

  if (spread2 > SPREAD_THRESHOLD) {
    const msg = `🔥 Arbitrage ${token}: Buy ${SECONDARY_EXCHANGE} @ ${
      secondaryPrice.ask.price
    }, Sell ${PRIMARY_EXCHANGE} @ ${primaryPrice.bid.price}\nSpread: ${(
      spread2 * 100
    ).toFixed(2)}% => ${amount2} ${token} => ${profit2.toFixed(4)} USDT`;
    console.log(msg);
    await sendTelegramMessage(msg);
  }
}

// === Real-time Loop ===
async function watchOrderBooks(): Promise<void> {
  console.log(`Starting to monitor ${SYMBOL}...\n`);
  while (true) {
    try {
      const [primaryBook, secondaryBook] = await Promise.all([
        exchanges[PRIMARY_EXCHANGE].watchOrderBook(SYMBOL),
        exchanges[SECONDARY_EXCHANGE].watchOrderBook(SYMBOL),
      ]);

      prices.primary.bid = primaryBook.bids.length
        ? {
            price: Number(primaryBook.bids[0][0]),
            amount: Number(primaryBook.bids[0][1]),
          }
        : null;
      prices.primary.ask = primaryBook.asks.length
        ? {
            price: Number(primaryBook.asks[0][0]),
            amount: Number(primaryBook.asks[0][1]),
          }
        : null;

      prices.secondary.bid = secondaryBook.bids.length
        ? {
            price: Number(secondaryBook.bids[0][0]),
            amount: Number(secondaryBook.bids[0][1]),
          }
        : null;
      prices.secondary.ask = secondaryBook.asks.length
        ? {
            price: Number(secondaryBook.asks[0][0]),
            amount: Number(secondaryBook.asks[0][1]),
          }
        : null;

      await checkArbitrage();
    } catch (err) {
      console.error("Watch error:", (err as Error).message);
    }
  }
}

watchOrderBooks();
