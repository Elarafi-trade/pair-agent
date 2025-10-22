import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import Head from 'next/head';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface TradeRecord {
  longPrice: any;
  shortPrice: any;
  timestamp: number;
  pair: string;
  symbolA: string;
  symbolB: string;
  action: 'long' | 'short' | 'close';
  zScore: number;
  correlation: number;
  spread: number;
  beta: number;
  reason: string;
  priceA?: number;
  priceB?: number;
  entryPriceA?: number;
  entryPriceB?: number;
  upnlPct?: number;
  cointegration?: boolean;
  leverage?: number;
  hedgeRatio?: number;
  halfLife?: number;
  winRate?: number;
  maxDrawdown?: number;
  sharpe?: number;
  totalTrades?: number;
  leadingAsset?: string;
  volatility?: number;
  timeframe?: string;
  engine?: string;
  remarks?: string;
  rollingZScore?: number;
}

const fetchTrades = async (): Promise<TradeRecord[]> => {
  try {
    const res = await fetch('/api/trades');
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
};

function timeAgo(ts: number) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalReturnWithLeverage: number;
  totalReturnWithoutLeverage: number;
  apy: number;
  avgTradesPerDay: number;
  avgReturnsPerDay: number;
  profitFactor: number;
  avgDuration: number;
  startDate: number;
  lastUpdated: number;
}

const fetchPerformance = async (): Promise<PerformanceMetrics | null> => {
  try {
    const res = await fetch('/api/performance');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

export default function Home() {
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const fetchAndSet = async () => {
      const [tradesData, perfData] = await Promise.all([
        fetchTrades(),
        fetchPerformance()
      ]);
      setTrades(tradesData);
      setPerformance(perfData);
    };
    fetchAndSet();
    const timer = setInterval(fetchAndSet, 10000);
    return () => clearInterval(timer);
  }, []);

  // Helper for color coding
  function colorMetric(val: number | undefined, posGood = true) {
    if (val === undefined || isNaN(val)) return '#888';
    if (posGood) return val > 0 ? '#2a7' : '#d33';
    return val < 0 ? '#2a7' : '#d33';
  }

  // Chart data helpers
  function chartData(trades: TradeRecord[], key: keyof TradeRecord, label: string) {
    return {
      labels: trades.map(t => new Date(t.timestamp).toLocaleTimeString()),
      datasets: [
        {
          label,
          data: trades.map(t => (t[key] as number) ?? null),
          borderColor: '#2a7',
          backgroundColor: 'rgba(42,167,100,0.1)',
          tension: 0.2,
        },
      ],
    };
  }

  // Derive leg prices when fields are missing (backward compatible)
  function derivedLongPrice(t: TradeRecord): number | undefined {
    if (t.longPrice !== undefined) return Number(t.longPrice);
    // fall back to recorded prices at execution
    if (t.action === 'long') return t.priceA ?? undefined;
    if (t.action === 'short') return t.priceB ?? undefined;
    return undefined;
  }
  function derivedShortPrice(t: TradeRecord): number | undefined {
    if (t.shortPrice !== undefined) return Number(t.shortPrice);
    if (t.action === 'long') return t.priceB ?? undefined;
    if (t.action === 'short') return t.priceA ?? undefined;
    return undefined;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(120deg,#f5f7fa 0%,#c3cfe2 100%)', fontFamily: 'Inter,Segoe UI,sans-serif', padding: '2vw' }}>
      <Head>
        <title>Pair-Agent Dashboard</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
      </Head>
      <h1 style={{ fontSize: '2.8rem', fontWeight: 700, color: '#222', marginBottom: 8, letterSpacing: -1 }}>
        Pair-Agent Dashboard
      </h1>
      <div style={{ fontSize: 18, color: '#555', marginBottom: 32 }}>Autonomous crypto pair-trading signals & analytics</div>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Performance Metrics Card */}
        {performance && performance.totalTrades > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: 24,
            boxShadow: '0 8px 32px rgba(102, 126, 234, 0.4)',
            padding: '2.5rem 2rem',
            marginBottom: 40,
            color: '#fff'
          }}>
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span>📊</span>
              <span>Agent Performance Profile</span>
            </div>

            {/* Trade Signal Metrics */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, opacity: 0.9 }}>Trade Signal Metrics</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 14, opacity: 0.8 }}>Total Trades</div>
                  <div style={{ fontSize: 32, fontWeight: 700 }}>{performance.totalTrades}</div>
                </div>
                <div>
                  <div style={{ fontSize: 14, opacity: 0.8 }}>Win Rate</div>
                  <div style={{ fontSize: 32, fontWeight: 700 }}>{performance.winRate.toFixed(1)}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 14, opacity: 0.8 }}>Winning Trades</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: '#4ade80' }}>{performance.winningTrades}</div>
                </div>
                <div>
                  <div style={{ fontSize: 14, opacity: 0.8 }}>Losing Trades</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: '#f87171' }}>{performance.losingTrades}</div>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, opacity: 0.9 }}>Performance Metrics</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 14, opacity: 0.8 }}>APY</div>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>
                    {performance.apy > 1000000
                      ? `${(performance.apy / 1000000).toFixed(2)}M%`
                      : `${performance.apy.toFixed(2)}%`}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 14, opacity: 0.8 }}>Total Return (10x lev)</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#4ade80' }}>
                    +{performance.totalReturnWithLeverage.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 14, opacity: 0.8 }}>Total Return (no lev)</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#4ade80' }}>
                    +{performance.totalReturnWithoutLeverage.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 14, opacity: 0.8 }}>Profit Factor</div>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>{performance.profitFactor.toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* Activity Metrics */}
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, opacity: 0.9 }}>Activity Metrics</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 14, opacity: 0.8 }}>Avg Trades/Day</div>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>{performance.avgTradesPerDay.toFixed(1)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 14, opacity: 0.8 }}>Avg Returns/Day</div>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>{performance.avgReturnsPerDay.toFixed(2)}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 14, opacity: 0.8 }}>Avg Duration</div>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>{performance.avgDuration.toFixed(1)}h</div>
                </div>
                <div>
                  <div style={{ fontSize: 14, opacity: 0.8 }}>Last Updated</div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginTop: 8 }}>
                    {new Date(performance.lastUpdated).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* End Performance Metrics Card */}
        {trades.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#888', fontSize: 22, marginTop: 80 }}>No trades yet.</div>
        ) : (
          trades.slice().reverse().map((trade, idx, arr) => (
            <div key={trade.timestamp} style={{
              background: 'linear-gradient(120deg,#fff 60%,#e3eafc 100%)',
              borderRadius: 24,
              boxShadow: '0 4px 24px #0002',
              padding: '2.5rem 2rem',
              marginBottom: 40,
              border: '1px solid #e3eafc',
              transition: 'box-shadow 0.2s',
              position: 'relative',
              fontSize: 16,
            }}>
              {/* Header: Logos, Names, Time Ago, Signal */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
                {/* Asset A logo */}
                <div style={{ width: 40, height: 40, borderRadius: 20, background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12, fontWeight: 700, fontSize: 20, color: '#2a7', border: '1px solid #e3eafc' }}>{trade.pair?.split('/')?.[0]?.[0] || '?'}</div>
                <div style={{ fontWeight: 700, fontSize: 22, color: '#2a7', marginRight: 8 }}>{trade.pair?.split('/')?.[0]}</div>
                {/* Asset B logo */}
                <div style={{ width: 40, height: 40, borderRadius: 20, background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12, fontWeight: 700, fontSize: 20, color: '#d33', border: '1px solid #e3eafc' }}>{trade.pair?.split('/')?.[1]?.[0] || '?'}</div>
                <div style={{ fontWeight: 700, fontSize: 22, color: '#d33', marginRight: 18 }}>{trade.pair?.split('/')?.[1]}</div>
                <div style={{ fontSize: 15, color: '#888', marginRight: 12 }}>{timeAgo(trade.timestamp)}</div>
                <span style={{
                  background: trade.action === 'long' ? 'linear-gradient(90deg,#2a7 60%,#aef 100%)' : trade.action === 'short' ? 'linear-gradient(90deg,#d33 60%,#fbb 100%)' : '#eee',
                  color: trade.action === 'long' ? '#fff' : trade.action === 'short' ? '#fff' : '#888',
                  fontWeight: 700,
                  fontSize: 15,
                  borderRadius: 12,
                  padding: '4px 16px',
                  marginLeft: 'auto',
                  boxShadow: '0 2px 8px #0001',
                  letterSpacing: 1,
                }}>{trade.action === 'short' ? `SHORT ${trade.pair?.split('/')?.[0]} · LONG ${trade.pair?.split('/')?.[1]}` : trade.action === 'long' ? `LONG ${trade.pair?.split('/')?.[0]} · SHORT ${trade.pair?.split('/')?.[1]}` : 'NEUTRAL'}
                </span>
              </div>
              {/* Metrics Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 24,
                marginBottom: 18,
                fontSize: 15,
              }}>
                <div>
                  <div style={{ color: '#888' }}>Price</div>
                  <div style={{ fontWeight: 600, color: '#222', marginBottom: 6 }}>{(() => { const p = derivedLongPrice(trade); return p !== undefined ? `$${p.toFixed?.(2) ?? p}` : 'N/A'; })()}</div>
                  <div style={{ color: '#888' }}>Entry Price</div>
                  <div style={{ fontWeight: 600, color: '#222', marginBottom: 6 }}>{(() => {
                    const ep = trade.action === 'long' ? trade.entryPriceA : trade.entryPriceB;
                    return ep !== undefined ? `$${ep}` : 'N/A';
                  })()}</div>
                  <div style={{ color: '#888' }}>UPnL Return %</div>
                  <div style={{ fontWeight: 600, color: colorMetric(trade.upnlPct ?? 0), marginBottom: 6 }}>{`${(trade.upnlPct ?? 0).toFixed(3)}%`}</div>
                  <div style={{ color: '#888' }}>Correlation</div>
                  <div style={{ fontWeight: 600, color: colorMetric(trade.correlation, true), marginBottom: 6 }}>{trade.correlation?.toFixed(2) ?? 'N/A'}</div>
                  <div style={{ color: '#888' }}>Cointegration</div>
                  <div style={{ fontWeight: 600, color: trade.cointegration ? '#2a7' : '#d33', marginBottom: 6 }}>{trade.cointegration === undefined ? 'N/A' : trade.cointegration ? 'Yes' : 'No'}</div>
                  <div style={{ color: '#888' }}>Leverage</div>
                  <div style={{ fontWeight: 600, color: '#222', marginBottom: 6 }}>{trade.leverage ?? 'N/A'}</div>
                  <div style={{ color: '#888' }}>Hedge Ratio</div>
                  <div style={{ fontWeight: 600, color: '#222', marginBottom: 6 }}>{trade.hedgeRatio?.toFixed(2) ?? 'N/A'}</div>
                  <div style={{ color: '#888' }}>Half Life</div>
                  <div style={{ fontWeight: 600, color: '#222', marginBottom: 6 }}>{trade.halfLife?.toFixed(1) ?? 'N/A'}</div>
                </div>
                <div>
                  <div style={{ color: '#888' }}>Backtest Win Rate</div>
                  <div style={{ fontWeight: 600, color: '#222', marginBottom: 6 }}>{trade.winRate !== undefined ? `${trade.winRate}%` : 'N/A'}</div>
                  <div style={{ color: '#888' }}>Backtest Max Drawdown</div>
                  <div style={{ fontWeight: 600, color: '#222', marginBottom: 6 }}>{trade.maxDrawdown !== undefined ? `${trade.maxDrawdown}%` : 'N/A'}</div>
                  <div style={{ color: '#888' }}>Backtest Sharpe</div>
                  <div style={{ fontWeight: 600, color: '#222', marginBottom: 6 }}>{trade.sharpe?.toFixed(2) ?? 'N/A'}</div>
                  <div style={{ color: '#888' }}>Backtest Total Trades</div>
                  <div style={{ fontWeight: 600, color: '#222', marginBottom: 6 }}>{trade.totalTrades ?? 'N/A'}</div>
                  <div style={{ color: '#888' }}>Leading Asset</div>
                  <div style={{ fontWeight: 600, color: '#222', marginBottom: 6 }}>{trade.leadingAsset ?? 'N/A'}</div>
                  <div style={{ color: '#888' }}>Pair Volatility</div>
                  <div style={{ fontWeight: 600, color: '#222', marginBottom: 6 }}>{trade.volatility?.toFixed(6) ?? 'N/A'}</div>
                  <div style={{ color: '#888' }}>Timeframe</div>
                  <div style={{ fontWeight: 600, color: '#222', marginBottom: 6 }}>{trade.timeframe ?? 'N/A'}</div>
                  <div style={{ color: '#888' }}>Trading Engine(s)</div>
                  <div style={{ fontWeight: 600, color: '#2a7', marginBottom: 6 }}>{trade.engine ?? 'N/A'}</div>
                  {trade.engine && (
                    <button style={{ marginTop: 8, background: 'linear-gradient(90deg,#2a7 60%,#aef 100%)', color: '#fff', fontWeight: 700, borderRadius: 8, padding: '6px 18px', border: 'none', fontSize: 15, boxShadow: '0 1px 4px #0001', cursor: 'pointer', transition: 'background 0.2s' }}>Open Position on {trade.engine}</button>
                  )}
                </div>
                <div>
                  <div style={{ color: '#888' }}>Remarks</div>
                  <div style={{ fontWeight: 600, color: '#222', marginBottom: 6 }}>{trade.remarks ?? '-'}</div>
                  <div style={{ color: '#888' }}>ZScore</div>
                  <div style={{ fontWeight: 600, color: colorMetric(trade.zScore, false), marginBottom: 6 }}>{trade.zScore?.toFixed(2) ?? 'N/A'}</div>
                  <div style={{ color: '#888' }}>Rolling ZScore</div>
                  <div style={{ fontWeight: 600, color: '#222', marginBottom: 6 }}>{trade.rollingZScore?.toFixed(2) ?? 'N/A'}</div>
                  <div style={{ color: '#888' }}>Spread</div>
                  <div style={{ fontWeight: 600, color: '#2a7', marginBottom: 6 }}>{trade.spread?.toFixed(2) ?? 'N/A'}</div>
                  <div style={{ color: '#888' }}>Volatility</div>
                  <div style={{ fontWeight: 600, color: '#d33', marginBottom: 6 }}>{trade.volatility !== undefined ? trade.volatility.toFixed(2) : 'N/A'}</div>
                </div>
              </div>
              {/* Charts Row */}
              <div style={{ marginTop: 18, display: 'flex', gap: 32 }}>
                <div style={{ flex: 1, background: '#f6f8fa', borderRadius: 10, padding: 10, boxShadow: '0 1px 4px #0001' }}>
                  <div style={{ fontWeight: 600, fontSize: 16, color: '#2a7', marginBottom: 6, textAlign: 'center' }}>ZScore</div>
                  <Line data={chartData(arr.slice(Math.max(0, idx - 19), idx + 1), 'zScore', 'ZScore')} options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false } } }} height={120} />
                </div>
                <div style={{ flex: 1, background: '#f6f8fa', borderRadius: 10, padding: 10, boxShadow: '0 1px 4px #0001' }}>
                  <div style={{ fontWeight: 600, fontSize: 16, color: '#2a7', marginBottom: 6, textAlign: 'center' }}>Spread</div>
                  <Line data={chartData(arr.slice(Math.max(0, idx - 19), idx + 1), 'spread', 'Spread')} options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false } } }} height={120} />
                </div>
                <div style={{ flex: 1, background: '#f6f8fa', borderRadius: 10, padding: 10, boxShadow: '0 1px 4px #0001' }}>
                  <div style={{ fontWeight: 600, fontSize: 16, color: '#d33', marginBottom: 6, textAlign: 'center' }}>Volatility</div>
                  <Line data={chartData(arr.slice(Math.max(0, idx - 19), idx + 1), 'volatility', 'Volatility')} options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false } } }} height={120} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div style={{ textAlign: 'center', color: '#aaa', fontSize: 14, marginTop: 40 }}>
        &copy; {new Date().getFullYear()} Pair-Agent. Powered by Eliza OS.
      </div>
    </div>
  );
}
