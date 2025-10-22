# Pair-Agent Web Dashboard (Next.js)

A simple Next.js + TypeScript dashboard for visualizing pair-trading signals and trade logs from your backend agent.

## 🚀 Quick Start

### 1. Install dependencies
```powershell
npm install
```

### 2. Run the development server
```powershell
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the dashboard.

## 📊 Features
- Displays recent trade signals from `public/trades.json`
- Clean, modern UI (no CSS frameworks required)
- Easy to extend with more stats or charts

## 🛠️ Build for production
```powershell
npm run build
npm start
```

## 🔗 Integration
- The backend agent should copy or symlink its `trades.json` to `web/public/trades.json` for live updates.
- You can extend the dashboard to fetch from an API endpoint if desired.

---

**Powered by Pair-Agent & Next.js**
