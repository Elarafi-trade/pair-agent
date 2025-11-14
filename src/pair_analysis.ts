// Copilot: Compute correlation and z-score between two price arrays
// Enhanced with cointegration testing and half-life calculation

import { mean, std } from 'mathjs';

/**
 * Interface for pair analysis results
 */
export interface AnalysisResult {
  corr: number;         // Correlation coefficient
  beta: number;         // Beta (slope of linear regression)
  zScore: number;       // Current z-score of the spread
  mean: number;         // Mean of the spread
  std: number;          // Standard deviation of the spread
  spread: number;       // Current spread value
  signalType: 'long' | 'short' | 'neutral';  // Trade signal
  halfLife: number;    // Half-life of mean reversion (in periods)
  cointegrationPValue: number;  // P-value from cointegration test
  isCointegrated: boolean;      // Whether pair is cointegrated
  sharpe: number;      // Sharpe ratio of the spread returns
  volatility: number;  // Annualized volatility of spread
  
}

/**
 * Calculate returns (percentage change) from price array
 * @param prices - Array of prices
 * @returns Array of returns
 */
function calculateReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const ret = (prices[i] - prices[i - 1]) / prices[i - 1];
    returns.push(ret);
  }
  return returns;
}

/**
 * Calculate Pearson correlation coefficient between two arrays
 * @param x - First array
 * @param y - Second array
 * @returns Correlation coefficient (-1 to 1)
 */
function correlation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) {
    throw new Error('Arrays must have the same non-zero length');
  }

  const n = x.length;
  const meanX = Number(mean(x));
  const meanY = Number(mean(y));

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const diffX = x[i] - meanX;
    const diffY = y[i] - meanY;
    numerator += diffX * diffY;
    denomX += diffX * diffX;
    denomY += diffY * diffY;
  }

  if (denomX === 0 || denomY === 0) {
    return 0;
  }

  return numerator / Math.sqrt(denomX * denomY);
}

/**
 * Calculate beta (slope) using linear regression
 * Beta represents how much priceA moves relative to priceB
 * @param pricesA - Independent variable (X)
 * @param pricesB - Dependent variable (Y)
 * @returns Beta coefficient
 */
function calculateBeta(pricesA: number[], pricesB: number[]): number {
  if (pricesA.length !== pricesB.length || pricesA.length === 0) {
    throw new Error('Arrays must have the same non-zero length');
  }

  const returnsA = calculateReturns(pricesA);
  const returnsB = calculateReturns(pricesB);

  const meanA = Number(mean(returnsA));
  const meanB = Number(mean(returnsB));

  let covariance = 0;
  let varianceA = 0;

  for (let i = 0; i < returnsA.length; i++) {
    const diffA = returnsA[i] - meanA;
    const diffB = returnsB[i] - meanB;
    covariance += diffA * diffB;
    varianceA += diffA * diffA;
  }

  if (varianceA === 0) {
    return 0;
  }

  return covariance / varianceA;
}

/**
 * Calculate the spread between two price series
 * Spread = PriceA - β × PriceB
 * @param pricesA - First price series
 * @param pricesB - Second price series
 * @param beta - Beta coefficient
 * @returns Array of spread values
 */
function calculateSpread(
  pricesA: number[],
  pricesB: number[],
  beta: number
): number[] {
  return pricesA.map((priceA, i) => priceA - beta * pricesB[i]);
}

/**
 * Calculate half-life of mean reversion using Ornstein-Uhlenbeck process
 * Half-life = time for spread to revert halfway to mean
 * @param spread - Array of spread values
 * @returns Half-life in periods (hours for hourly data)
 */
function calculateHalfLife(spread: number[]): number {
  if (spread.length < 3) return Infinity;

  // Fit AR(1) model: spread[t] - spread[t-1] = alpha + rho × spread[t-1] + noise
  const laggedSpread = spread.slice(0, -1);
  const deltaSpread = spread.slice(1).map((val, i) => val - spread[i]);

  // Calculate regression coefficients
  const meanLagged = Number(mean(laggedSpread));
  const meanDelta = Number(mean(deltaSpread));

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < laggedSpread.length; i++) {
    const diffLagged = laggedSpread[i] - meanLagged;
    const diffDelta = deltaSpread[i] - meanDelta;
    numerator += diffLagged * diffDelta;
    denominator += diffLagged * diffLagged;
  }

  if (denominator === 0) return Infinity;

  const rho = numerator / denominator;

  // Half-life = -log(2) / log(1 + rho)
  // If rho >= 0, no mean reversion (diverging)
  if (rho >= 0) return Infinity;

  const halfLife = -Math.log(2) / Math.log(1 + rho);

  // Sanity check: half-life should be positive and reasonable
  if (!isFinite(halfLife) || halfLife < 0 || halfLife > 1000) {
    return Infinity;
  }

  return halfLife;
}

/**
 * Simplified ADF (Augmented Dickey-Fuller) test for stationarity
 * Tests if spread is mean-reverting (stationary)
 * @param spread - Array of spread values
 * @returns P-value (< 0.05 suggests stationarity/cointegration)
 */
function adfTest(spread: number[]): number {
  if (spread.length < 10) return 1.0; // Not enough data

  // Simple Dickey-Fuller test: spread[t] = alpha + rho × spread[t-1] + noise
  const laggedSpread = spread.slice(0, -1);
  const currentSpread = spread.slice(1);

  // Calculate regression
  const meanLagged = Number(mean(laggedSpread));
  const meanCurrent = Number(mean(currentSpread));

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < laggedSpread.length; i++) {
    const diffLagged = laggedSpread[i] - meanLagged;
    const diffCurrent = currentSpread[i] - meanCurrent;
    numerator += diffLagged * diffCurrent;
    denominator += diffLagged * diffLagged;
  }

  if (denominator === 0) return 1.0;

  const rho = numerator / denominator;

  // Calculate residuals
  const alpha = meanCurrent - rho * meanLagged;
  const residuals = currentSpread.map((val, i) => val - (alpha + rho * laggedSpread[i]));
  const residualStd = Number(std(residuals, 'unbiased'));

  if (residualStd === 0) return 1.0;

  // Calculate t-statistic for H0: rho = 1 (unit root = non-stationary)
  const tStat = (rho - 1) / (residualStd / Math.sqrt(denominator));

  // Debug logging (can be enabled by setting environment variable)
  const debugCointegration = process.env.DEBUG_COINTEGRATION === 'true';
  if (debugCointegration) {
    console.log(`[ADF] rho=${rho.toFixed(4)}, tStat=${tStat.toFixed(4)}, n=${spread.length}`);
  }

  // Simplified critical values for Dickey-Fuller test (approximate)
  // More negative = more stationary
  // Critical values at different significance levels:
  // 1%: -3.43, 5%: -2.86, 10%: -2.57

  // Convert t-stat to approximate p-value with more granularity
  let pValue: number;
  if (tStat < -3.43) pValue = 0.01;      // Strongly stationary (reject H0 at 1%)
  else if (tStat < -2.86) pValue = 0.05;      // Stationary at 5% (cointegrated)
  else if (tStat < -2.57) pValue = 0.10;      // Weakly stationary at 10%
  else if (tStat < -2.0) pValue = 0.20;       // Borderline stationary
  else if (tStat < -1.5) pValue = 0.40;       // Weak evidence of stationarity
  else if (tStat < -1.0) pValue = 0.60;       // Very weak evidence
  else if (tStat < -0.5) pValue = 0.75;       // Likely non-stationary
  else pValue = 0.90;                          // Strongly non-stationary (unit root present)

  if (debugCointegration) {
    console.log(`[ADF] p-value=${pValue.toFixed(4)} (${pValue < 0.05 ? 'COINTEGRATED' : 'NOT cointegrated'})`);
  }

  return pValue;
}

/**
 * Test for cointegration between two price series
 * @param pricesA - First price series
 * @param pricesB - Second price series
 * @param beta - Hedge ratio (beta coefficient)
 * @returns P-value from stationarity test on spread
 */
function testCointegration(
  pricesA: number[],
  pricesB: number[],
  beta: number
): number {
  // Calculate spread (residuals from linear regression)
  const spread = calculateSpread(pricesA, pricesB, beta);

  // Test if spread is stationary using simplified ADF test
  return adfTest(spread);
}

/**
 * Calculate Sharpe ratio of spread returns
 * @param spread - Array of spread values
 * @returns Annualized Sharpe ratio
 */
function calculateSharpe(spread: number[]): number {
  if (spread.length < 2) return 0;

  const spreadReturns = calculateReturns(spread);
  const avgReturn = Number(mean(spreadReturns));
  const stdReturn = Number(std(spreadReturns, 'unbiased'));

  if (stdReturn === 0) return 0;

  // Annualize for hourly data: sqrt(24 * 365) ≈ 93.5
  const sharpeRatio = (avgReturn / stdReturn) * Math.sqrt(8760); // 24 * 365

  return sharpeRatio;
}

/**
 * Calculate annualized volatility of spread
 * @param spread - Array of spread values
 * @returns Annualized volatility (%)
 */
function calculateVolatility(spread: number[]): number {
  if (spread.length < 2) return 0;

  const spreadReturns = calculateReturns(spread);
  const stdReturn = Number(std(spreadReturns, 'unbiased'));

  // Annualize for hourly data: sqrt(24 * 365) ≈ 93.5
  const annualizedVol = stdReturn * Math.sqrt(8760) * 100; // Convert to percentage

  return annualizedVol;
}

/**
 * Analyze a pair of trading symbols for mean-reversion opportunities
 * Enhanced with cointegration testing, half-life, and Sharpe ratio
 * @param pricesA - Price array for first symbol
 * @param pricesB - Price array for second symbol
 * @returns Analysis results with correlation, beta, z-score, and advanced metrics
 */
export function analyzePair(
  pricesA: number[],
  pricesB: number[]
): AnalysisResult {
  // Validate inputs
  if (pricesA.length !== pricesB.length) {
    throw new Error('Price arrays must have the same length');
  }
  if (pricesA.length < 2) {
    throw new Error('Need at least 2 data points for analysis');
  }

  // Calculate returns for correlation
  const returnsA = calculateReturns(pricesA);
  const returnsB = calculateReturns(pricesB);

  // Compute correlation coefficient
  const corr = correlation(returnsA, returnsB);

  // Compute beta (hedge ratio)
  const beta = calculateBeta(pricesA, pricesB);

  // Calculate spread: PriceA - β × PriceB
  const spreadArray = calculateSpread(pricesA, pricesB, beta);

  // Calculate spread statistics
  const spreadMean = Number(mean(spreadArray));
  const spreadStd = Number(std(spreadArray, 'unbiased'));

  // Current spread and z-score
  const currentSpread = spreadArray[spreadArray.length - 1];
  const zScore = (currentSpread - spreadMean) / spreadStd;

  // Calculate advanced metrics
  const halfLife = calculateHalfLife(spreadArray);
  const cointegrationPValue = testCointegration(pricesA, pricesB, beta);
  const isCointegrated = cointegrationPValue < 0.05; // 95% confidence
  const sharpe = calculateSharpe(spreadArray);
  const volatility = calculateVolatility(spreadArray);

  // Generate signal based on z-score
  let signalType: 'long' | 'short' | 'neutral' = 'neutral';
  if (zScore > 2) {
    signalType = 'short'; // Spread too high, expect mean reversion downward
  } else if (zScore < -2) {
    signalType = 'long'; // Spread too low, expect mean reversion upward
  }

  return {
    corr,
    beta,
    zScore,
    mean: spreadMean,
    std: spreadStd,
    spread: currentSpread,
    signalType,
    halfLife,
    cointegrationPValue,
    isCointegrated,
    sharpe,
    volatility,
  };
}

/**
 * Check if a pair meets trading criteria (enhanced with cointegration and quality filters)
 * @param result - Analysis result
 * @param zScoreThreshold - Minimum absolute z-score (default: 2.0)
 * @param corrThreshold - Minimum correlation (default: 0.85)
 * @param config - Optional additional filters from config
 * @returns True if pair qualifies for trading signal
 */
export function meetsTradeSignalCriteria(
  result: AnalysisResult,
  zScoreThreshold: number = 2.0,
  corrThreshold: number = 0.85,
  config?: {
    maxHalfLife?: number;
    minSharpe?: number;
    maxVolatility?: number;
    dynamicZScore?: boolean; // Enable dynamic z-score adjustment
    halfLifeEnforced?: boolean; // When false, do not hard-reject on half-life
    allowInfinityWithAdfBelow?: number; // If half-life is Infinity but ADF p <= this, allow
  }
): boolean {
  // FIRST: Check half-life filter (reject early if too slow/fast)
  if (config && result.halfLife !== undefined) {
    const enforceHL = config.halfLifeEnforced !== undefined ? config.halfLifeEnforced : true;
    const maxHL = config.maxHalfLife;

    if (!isFinite(result.halfLife)) {
      // κ >= 0 → non-mean-reverting in Δs regression
      if (config?.allowInfinityWithAdfBelow !== undefined && result.cointegrationPValue <= config.allowInfinityWithAdfBelow) {
        console.log(`[FILTER] Half-life = ∞ but ADF p=${result.cointegrationPValue.toFixed(2)} ≤ ${config.allowInfinityWithAdfBelow}. Allowing.`);
      } else if (enforceHL) {
        console.log(`[FILTER] Non-mean-reverting (κ ≥ 0): half-life = ∞. Skipping.`);
        return false;
      }
    } else if (maxHL !== undefined && (result.halfLife > maxHL || result.halfLife < 1)) {
      console.log(`[FILTER] Half-life ${result.halfLife.toFixed(1)}h outside acceptable range (1 - ${maxHL}h)`);
      return false;
    }
  }

  // SECOND: Dynamic z-score adjustment based on half-life (if enabled)
  let effectiveZThreshold = zScoreThreshold;
  
  if (config?.dynamicZScore && result.halfLife !== undefined && isFinite(result.halfLife)) {
    // Realistic half-life ranges for crypto (hourly data):
    // Ultra-fast: < 8h (intraday mean reversion) = most aggressive
    // Fast: 8-24h (same-day reversion) = aggressive
    // Medium: 24-48h (1-2 day reversion) = standard
    // Slow: > 48h (multi-day reversion) = conservative/skip
    
    if (result.halfLife < 8) {
      effectiveZThreshold = zScoreThreshold * 0.70; // 30% lower for ultra-fast pairs (1.8 → 1.26)
    } else if (result.halfLife < 24) {
      effectiveZThreshold = zScoreThreshold * 0.85; // 15% lower for fast pairs (1.8 → 1.53)
    } else if (result.halfLife < 48) {
      effectiveZThreshold = zScoreThreshold * 1.00; // Standard for medium pairs (1.8 → 1.80)
    } else {
      effectiveZThreshold = zScoreThreshold * 1.30; // 30% higher for slow pairs (1.8 → 2.34)
    }
    
    // Log adjustment for transparency
    if (effectiveZThreshold !== zScoreThreshold) {
      const speed = result.halfLife < 8 ? 'ULTRA-FAST' : 
                    result.halfLife < 24 ? 'FAST' : 
                    result.halfLife < 48 ? 'MEDIUM' : 'SLOW';
      console.log(
        `[DYNAMIC_Z] ${speed} half-life ${result.halfLife.toFixed(1)}h → ` +
        `z-threshold: ${zScoreThreshold.toFixed(2)} → ${effectiveZThreshold.toFixed(2)}`
      );
    }
  }

  // THIRD: Basic criteria with dynamic threshold
  const meetsBasic =
    Math.abs(result.zScore) >= effectiveZThreshold &&
    Math.abs(result.corr) >= corrThreshold;

  if (!meetsBasic) return false;

  // FOURTH: Remaining advanced criteria (if config provided)
  if (config) {

    // Check Sharpe ratio
    if (
      config.minSharpe !== undefined &&
      result.sharpe !== undefined &&
      result.sharpe < config.minSharpe
    ) {
      return false;
    }

    // Check volatility
    if (
      config.maxVolatility !== undefined &&
      result.volatility !== undefined &&
      result.volatility > config.maxVolatility
    ) {
      return false;
    }
  }

  return true;
}
