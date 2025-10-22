import React, { useEffect, useState } from 'react';

interface TradeRecord {
  id?: number;
  timestamp: string;
  pair: string;
  action: string;
  signal: string;
  zScore: number;
  correlation: number;
  spread: number;
  spreadMean: number;
  spreadStd: number;
  beta: number;
  reason: string;
  longAsset: string;
  shortAsset: string;
  longPrice: number;
  shortPrice: number;
  status: 'open' | 'closed';
  closeTimestamp?: string;
  closeReason?: string;
  closePnL?: number;
  upnlPct?: number;
  volatility?: number;
  halfLife?: number;
  sharpe?: number;
}

const API_BASE = 'https://pair-agent.onrender.com';

const fetchTrades = async (): Promise<TradeRecord[]> => {
  try {
    const res = await fetch(`${API_BASE}/api/trades`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch trades:', err);
    return [];
  }
};

const App: React.FC = () => {
  const [trades, setTrades] = useState<TradeRecord[]>([]);

  useEffect(() => {
    fetchTrades().then(setTrades);
  }, []);

  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', background: '#f7f8fa', minHeight: '100vh', padding: '2rem' }}>
      <h1 style={{ color: '#3a3a3a', fontWeight: 700, fontSize: '2rem', marginBottom: '1rem' }}>
        Pair-Agent Dashboard (Drift Protocol)
      </h1>
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #0001', padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
        <h2 style={{ color: '#2a7', fontWeight: 600, fontSize: '1.2rem' }}>Recent Trade Signals</h2>
        {trades.length === 0 ? (
          <p style={{ color: '#888' }}>No trades yet. Waiting for signals...</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
            <thead>
              <tr style={{ background: '#f0f4f8' }}>
                <th style={{ textAlign: 'left', padding: 8, fontSize: 13 }}>Time</th>
                <th style={{ textAlign: 'left', padding: 8, fontSize: 13 }}>Pair</th>
                <th style={{ textAlign: 'left', padding: 8, fontSize: 13 }}>Action</th>
                <th style={{ textAlign: 'left', padding: 8, fontSize: 13 }}>Status</th>
                <th style={{ textAlign: 'right', padding: 8, fontSize: 13 }}>Z-Score</th>
                <th style={{ textAlign: 'right', padding: 8, fontSize: 13 }}>Corr</th>
                <th style={{ textAlign: 'right', padding: 8, fontSize: 13 }}>UPnL %</th>
                <th style={{ textAlign: 'left', padding: 8, fontSize: 13 }}>Reason</th>
              </tr>
            </thead>
            <tbody>
              {trades.slice(0, 20).map((trade) => (
                <tr key={`${trade.timestamp}-${trade.pair}`} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 8, fontSize: 12 }}>{new Date(trade.timestamp).toLocaleString()}</td>
                  <td style={{ padding: 8, fontSize: 12, fontWeight: 600 }}>{trade.pair}</td>
                  <td style={{ padding: 8, color: trade.action.includes('LONG') ? '#2a7' : '#d33', fontWeight: 600, fontSize: 12 }}>
                    {trade.action}
                  </td>
                  <td style={{ padding: 8, fontSize: 12 }}>
                    <span style={{ 
                      padding: '2px 6px', 
                      borderRadius: 4, 
                      background: trade.status === 'open' ? '#e3f2fd' : '#f5f5f5',
                      color: trade.status === 'open' ? '#1976d2' : '#666',
                      fontSize: 11,
                      fontWeight: 600
                    }}>
                      {trade.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: 8, textAlign: 'right', fontSize: 12 }}>{trade.zScore.toFixed(2)}</td>
                  <td style={{ padding: 8, textAlign: 'right', fontSize: 12 }}>{trade.correlation.toFixed(2)}</td>
                  <td style={{ 
                    padding: 8, 
                    textAlign: 'right', 
                    fontSize: 12,
                    color: (trade.upnlPct ?? 0) >= 0 ? '#2a7' : '#d33',
                    fontWeight: 600
                  }}>
                    {trade.upnlPct !== null && trade.upnlPct !== undefined ? `${trade.upnlPct > 0 ? '+' : ''}${trade.upnlPct.toFixed(2)}%` : '-'}
                  </td>
                  <td style={{ padding: 8, fontSize: 11, color: '#666', maxWidth: 250 }}>{trade.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <footer style={{ textAlign: 'center', marginTop: 32, color: '#aaa', fontSize: 14 }}>
        Powered by Pair-Agent · <a href="https://drift.trade" target="_blank" rel="noopener noreferrer" style={{ color: '#2a7' }}>Drift Protocol</a>
      </footer>
    </div>
  );
};

export default App;
