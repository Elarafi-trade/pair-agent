// Copilot: Randomly select trading pairs from Binance for pair-trading analysis

import axios from 'axios';

// Optional Binance API key support (higher limits). Do not log this value.
const BINANCE_API_KEY = process.env.BINANCE_API_KEY;
const binanceHeaders = BINANCE_API_KEY ? { 'X-MBX-APIKEY': BINANCE_API_KEY } : undefined;

// Allow overriding base URL and add fallbacks to avoid 451 geo restriction
const ENV_BASE = process.env.BINANCE_BASE_URL;
const BINANCE_BASE_URLS = ENV_BASE
  ? [ENV_BASE]
  : [
    'https://api.binance.me',
    'https://api.binance.com/api/v3',
    'https://api.binance.us/api/v3',
    'https://data-api.binance.vision/api/v3',
  ];

async function getWithFallback<T = any>(path: string): Promise<T> {
  let lastError: any;
  for (const base of BINANCE_BASE_URLS) {
    try {
      const res = await axios.get<T>(`${base}${path}`, { timeout: 10000, headers: binanceHeaders });
      return res.data as T;
    } catch (err: any) {
      lastError = err;
      const status = err?.response?.status;
      console.warn(`[PAIR_SELECTOR] GET ${path} via ${base} failed${status ? ` (status ${status})` : ''}. Trying next...`);
      continue;
    }
  }
  throw lastError ?? new Error('All Binance endpoints failed');
}

/**
 * Interface for Binance exchange info symbol
 */
interface BinanceSymbol {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
}

/**
 * Fetch all available USDC trading pairs from Binance
 * @returns Array of symbol names (e.g., ['BTCUSDC', 'ETHUSDC', ...])
 */
async function fetchAvailableUSDCPairs(): Promise<string[]> {
  try {
    const data = await getWithFallback<{ symbols: BinanceSymbol[] }>(`/exchangeInfo`);
    const symbols: BinanceSymbol[] = data.symbols;

    // Filter for active USDC pairs only
    const usdcPairs = symbols
      .filter((s) => s.status === 'TRADING' && s.quoteAsset === 'USDC')
      .map((s) => s.symbol);

    return usdcPairs;
  } catch (error) {
    console.error('[PAIR_SELECTOR] Failed to fetch available pairs:', error);
    throw new Error('Could not fetch trading pairs from Binance');
  }
}

/**
 * Randomly select N unique pairs from the available USDC pairs
 * @param count - Number of pairs to select
 * @returns Array of randomly selected pair symbols
 */
async function selectRandomPairs(count: number = 5): Promise<string[]> {
  const allPairs = await fetchAvailableUSDCPairs();

  // Shuffle and pick first N
  const shuffled = allPairs.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Generate random pair combinations for pair trading
 * Picks 2*N random symbols and pairs them for correlation analysis
 * @param pairCount - Number of pair combinations to generate
 * @returns Array of pair combinations [{pairA, pairB, description}]
 */
export async function generateRandomPairCombinations(
  pairCount: number = 2
): Promise<Array<{ pairA: string; pairB: string; description: string }>> {
  const selectedSymbols = await selectRandomPairs(pairCount * 2);

  const pairs: Array<{ pairA: string; pairB: string; description: string }> = [];

  for (let i = 0; i < pairCount; i++) {
    const pairA = selectedSymbols[i * 2];
    const pairB = selectedSymbols[i * 2 + 1];

    if (pairA && pairB) {
      pairs.push({
        pairA,
        pairB,
        description: `Random pair: ${pairA}/${pairB}`,
      });
    }
  }

  console.log(`[PAIR_SELECTOR] Selected ${pairs.length} random pairs for analysis`);
  pairs.forEach((p) => console.log(`  - ${p.pairA} / ${p.pairB}`));

  return pairs;
}
