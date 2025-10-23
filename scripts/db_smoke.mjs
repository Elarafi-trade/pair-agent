import 'dotenv/config';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Create a .env with DATABASE_URL=<neon-connection-string> or set it in the environment.");
    process.exit(1);
  }

  // Import compiled DB helpers from dist
  const {
    initializeTables,
    getAllTrades,
    getPerformanceMetrics,
  } = await import('../dist/db.js');

  console.log('DB smoke: initializing tables...');
  await initializeTables();
  console.log('DB smoke: tables ready.');

  console.log('DB smoke: querying performance metrics...');
  const perf = await getPerformanceMetrics();
  console.log('DB smoke: performance metrics =>', perf ?? '(none)');

  console.log('DB smoke: querying latest trades (up to 5)...');
  const trades = await getAllTrades();
  const latest5 = trades.slice(0, 5);
  console.log(`DB smoke: total trades=${trades.length}; showing ${latest5.length}`);
  for (const t of latest5) {
    console.log(`- ${t.pair} | status=${t.status} | opened=${t.timestamp} | upnl=${t.upnlPct ?? 0}%`);
  }

  console.log('DB smoke: SUCCESS');
}

main().catch((err) => {
  console.error('DB smoke: FAILED');
  console.error(err);
  process.exit(1);
});
