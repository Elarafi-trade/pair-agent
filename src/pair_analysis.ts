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

  // Simplified critical values for Dickey-Fuller test (approximate)
  // More negative = more stationary
  // Critical values at different significance levels:
  // 1%: -3.43, 5%: -2.86, 10%: -2.57

  // Convert t-stat to approximate p-value
  if (tStat < -3.43) return 0.01;      // Strongly stationary
  if (tStat < -2.86) return 0.05;      // Stationary at 5%
  if (tStat < -2.57) return 0.10;      // Weakly stationary
  if (tStat < -2.0) return 0.20;
  if (tStat < -1.5) return 0.40;
  return 0.80;                          // Likely non-stationary
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
    requireCointegration?: boolean;
    minCointegrationPValue?: number;
    maxHalfLife?: number;
    minSharpe?: number;
    maxVolatility?: number;
  }
): boolean {
  // Basic criteria
  const meetsBasic =
    Math.abs(result.zScore) >= zScoreThreshold &&
    Math.abs(result.corr) >= corrThreshold;

  if (!meetsBasic) return false;

  // Advanced criteria (if config provided)
  if (config) {
    // Check cointegration
    if (config.requireCointegration && !result.isCointegrated) {
      return false;
    }

    // Check cointegration p-value
    if (
      config.minCointegrationPValue !== undefined &&
      result.cointegrationPValue !== undefined &&
      result.cointegrationPValue > config.minCointegrationPValue
    ) {
      return false;
    }

    // Check half-life (reject if too slow or too fast)
    if (
      config.maxHalfLife !== undefined &&
      result.halfLife !== undefined &&
      (result.halfLife > config.maxHalfLife || result.halfLife < 1)
    ) {
      return false;
    }

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
