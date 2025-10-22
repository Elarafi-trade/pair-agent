import React, { useEffect, useState } from 'react';

interface TradeRecord {
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
}

const fetchTrades = async (): Promise<TradeRecord[]> => {
  try {
    const res = await fetch('/trades.json');
    if (!res.ok) return [];
    return await res.json();
  } catch {
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
        Pair-Agent Dashboard
      </h1>
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #0001', padding: '2rem', maxWidth: 700, margin: '0 auto' }}>
        <h2 style={{ color: '#2a7', fontWeight: 600, fontSize: '1.2rem' }}>Recent Trade Signals</h2>
        {trades.length === 0 ? (
          <p style={{ color: '#888' }}>No trades yet. Waiting for signals...</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
            <thead>
              <tr style={{ background: '#f0f4f8' }}>
                <th style={{ textAlign: 'left', padding: 8 }}>Time</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Pair</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Action</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Z-Score</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Corr</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Reason</th>
              </tr>
            </thead>
            <tbody>
              {trades.slice(-10).reverse().map((trade) => (
                <tr key={trade.timestamp} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 8 }}>{new Date(trade.timestamp).toLocaleString()}</td>
                  <td style={{ padding: 8 }}>{trade.pair}</td>
                  <td style={{ padding: 8, color: trade.action === 'long' ? '#2a7' : '#d33', fontWeight: 600 }}>{trade.action.toUpperCase()}</td>
                  <td style={{ padding: 8 }}>{trade.zScore.toFixed(2)}</td>
                  <td style={{ padding: 8 }}>{trade.correlation.toFixed(2)}</td>
                  <td style={{ padding: 8 }}>{trade.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <footer style={{ textAlign: 'center', marginTop: 32, color: '#aaa', fontSize: 14 }}>
        Powered by Pair-Agent &middot; <a href="https://app.pear.garden/agent-pear" target="_blank" rel="noopener noreferrer">Pear Garden</a>
      </footer>
    </div>
  );
};

export default App;
