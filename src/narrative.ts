
import { AnalysisResult } from './pair_analysis.js';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 
 * @param symbolA - First trading symbol
 * @param symbolB - Second trading symbol
 * @param result - Analysis results
 * @returns Natural language summary (1-2 sentences)
 */
export function generateNarrative(
  symbolA: string,
  symbolB: string,
  result: AnalysisResult
): string {
  const { corr, zScore, signalType, mean, std } = result;
  
  // Format numbers for readability
  const corrFormatted = corr.toFixed(2);
  const zScoreFormatted = zScore.toFixed(1);
  const meanFormatted = mean.toFixed(2);
  const stdFormatted = std.toFixed(2);
  
  // Build narrative based on signal type
  let narrative = `${symbolA}/${symbolB} spread is ${zScoreFormatted}σ ${
    zScore > 0 ? 'above' : 'below'
  } mean (${meanFormatted} ± ${stdFormatted}), correlation ${corrFormatted}.`;
  
  // Add trade recommendation
  if (signalType === 'short') {
    narrative += ` Spread elevated — possible short ${symbolA}, long ${symbolB} reversion trade.`;
  } else if (signalType === 'long') {
    narrative += ` Spread depressed — possible long ${symbolA}, short ${symbolB} reversion trade.`;
  } else {
    narrative += ` No strong signal — spread within normal range.`;
  }
  
  // Add correlation warning if weak
  if (Math.abs(corr) < 0.7) {
    narrative += ` ⚠️ Low correlation may indicate unstable relationship.`;
  }
  
  return narrative;
}

/**

 * @param symbolA - First trading symbol
 * @param symbolB - Second trading symbol
 * @param result - Analysis results
 * @returns Formatted prompt for LLM
 */
export function buildLLMPrompt(
  symbolA: string,
  symbolB: string,
  result: AnalysisResult
): string {
  return `Analyze ${symbolA}/${symbolB} pair:
Correlation: ${result.corr.toFixed(3)}
Z-Score: ${result.zScore.toFixed(2)}
Mean Spread: ${result.mean.toFixed(2)}
Std Spread: ${result.std.toFixed(2)}
Beta: ${result.beta.toFixed(3)}
Signal: ${result.signalType}

Provide a concise 1-2 sentence trading insight.`;
}

/**
 * Generate LLM-powered narrative using OpenRouter API
 * Falls back to rule-based narrative on error
 * 
 * @param symbolA - First trading symbol
 * @param symbolB - Second trading symbol
 * @param result - Analysis results
 * @returns LLM-generated narrative
 */
export async function generateLLMNarrative(
  symbolA: string,
  symbolB: string,
  result: AnalysisResult
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  // Fallback if no API key
  if (!apiKey) {
    console.log('[LLM] No OPENROUTER_API_KEY found, using rule-based narrative');
    return generateNarrative(symbolA, symbolB, result);
  }
  
  const prompt = buildLLMPrompt(symbolA, symbolB, result);
  
  try {
    console.log(`[LLM] Calling OpenRouter API...`);
    
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'openrouter/free', // Free model selector
        messages: [
          {
            role: 'user',
            content: `${prompt}\n\nProvide exactly 1-2 sentences. Be direct and concise—state the key insight and trade recommendation only.`
          }
        ],
        max_tokens: 80,
        temperature: 0.3
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/pair-agent',
          'X-Title': 'Pair Trading Agent'
        },
        timeout: 15000 // 15 second timeout
      }
    );
    
    const llmNarrative = response.data?.choices?.[0]?.message?.content?.trim();
    
    if (llmNarrative && llmNarrative.length > 10) {
      console.log(`[LLM] ✓ Generated narrative via OpenRouter`);
      return llmNarrative;
    } else {
      throw new Error('Empty or invalid response from OpenRouter');
    }
    
  } catch (error) {
    // Fallback to rule-based narrative on any error
    console.error('[LLM] ✗ OpenRouter API error, falling back to rule-based narrative:', 
      error instanceof Error ? error.message : 'Unknown error'
    );
    return generateNarrative(symbolA, symbolB, result);
  }
}

/**
 * Format analysis results as a structured report (synchronous, rule-based narrative)
 * Useful for logging or displaying results
 * 
 * @param symbolA - First trading symbol
 * @param symbolB - Second trading symbol
 * @param result - Analysis results
 * @returns Formatted report string
 */
export function formatAnalysisReport(
  symbolA: string,
  symbolB: string,
  result: AnalysisResult,
  opts?: { currentPriceA?: number; currentPriceB?: number; timeframe?: string }
): string {
  // Build explicit signal string with legs
  let signalDetail = 'NEUTRAL';
  if (result.signalType === 'short') {
    signalDetail = `SHORT ${symbolA}, LONG ${symbolB}`;
  } else if (result.signalType === 'long') {
    signalDetail = `LONG ${symbolA}, SHORT ${symbolB}`;
  }

  const currentPricesLine =
    opts?.currentPriceA !== undefined && opts?.currentPriceB !== undefined
      ? `Current Px:  ${symbolA}: $${opts.currentPriceA.toFixed(2)}  ${symbolB}: $${opts.currentPriceB.toFixed(2)}\n`
      : '';

  const report = `
═══════════════════════════════════════════
  PAIR ANALYSIS REPORT
═══════════════════════════════════════════
Pair:         ${symbolA} / ${symbolB}
Correlation:  ${result.corr.toFixed(3)}
Z-Score:      ${result.zScore.toFixed(2)}
Mean:        ${result.mean.toFixed(2)}
isCointegrated: ${result.isCointegrated ? 'YES' : 'NO'}
cointegrationPValue: ${result.cointegrationPValue.toFixed(4)}
Beta:         ${result.beta.toFixed(3)}
Timeframe:    ${opts?.timeframe ?? 'n/a'}
─────────────────────────────────────────────
Spread Stats:
  Mean:       ${result.mean.toFixed(2)}
  Std Dev:    ${result.std.toFixed(2)}
  Current:    ${result.spread.toFixed(2)}
  Z-Score:    ${result.zScore.toFixed(2)}
─────────────────────────────────────────────
Signal:       ${signalDetail}
Legs:         ${signalDetail}
${currentPricesLine}─────────────────────────────────────────────
Narrative:
${generateNarrative(symbolA, symbolB, result)}
═══════════════════════════════════════════
`;
  return report;
}

/**
 * Format analysis results with AI-generated narrative (async)
 * 
 * @param symbolA - First trading symbol
 * @param symbolB - Second trading symbol
 * @param result - Analysis results
 * @param opts - Optional current prices and timeframe
 * @returns Formatted report string with LLM narrative
 */
export async function formatAnalysisReportWithLLM(
  symbolA: string,
  symbolB: string,
  result: AnalysisResult,
  opts?: { currentPriceA?: number; currentPriceB?: number; timeframe?: string }
): Promise<string> {
  // Build explicit signal string with legs
  let signalDetail = 'NEUTRAL';
  if (result.signalType === 'short') {
    signalDetail = `SHORT ${symbolA}, LONG ${symbolB}`;
  } else if (result.signalType === 'long') {
    signalDetail = `LONG ${symbolA}, SHORT ${symbolB}`;
  }

  const currentPricesLine =
    opts?.currentPriceA !== undefined && opts?.currentPriceB !== undefined
      ? `Current Px:  ${symbolA}: $${opts.currentPriceA.toFixed(2)}  ${symbolB}: $${opts.currentPriceB.toFixed(2)}\n`
      : '';

  // Get AI-generated narrative
  const narrative = await generateLLMNarrative(symbolA, symbolB, result);

  const report = `
═══════════════════════════════════════════
  PAIR ANALYSIS REPORT
═══════════════════════════════════════════
Pair:         ${symbolA} / ${symbolB}
Correlation:  ${result.corr.toFixed(3)}
Z-Score:      ${result.zScore.toFixed(2)}
Mean:        ${result.mean.toFixed(2)}
isCointegrated: ${result.isCointegrated ? 'YES' : 'NO'}
cointegrationPValue: ${result.cointegrationPValue.toFixed(4)}
Beta:         ${result.beta.toFixed(3)}
Timeframe:    ${opts?.timeframe ?? 'n/a'}
─────────────────────────────────────────────
Spread Stats:
  Mean:       ${result.mean.toFixed(2)}
  Std Dev:    ${result.std.toFixed(2)}
  Current:    ${result.spread.toFixed(2)}
  Z-Score:    ${result.zScore.toFixed(2)}
─────────────────────────────────────────────
Signal:       ${signalDetail}
Legs:         ${signalDetail}
${currentPricesLine}─────────────────────────────────────────────
Narrative:
${narrative}
═══════════════════════════════════════════
`;
  return report;
}
