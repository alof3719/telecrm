import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  fetchStockPrice, fetchCryptoPrice, fetchStockCandles, fetchCryptoCandles,
  searchStocks, searchCrypto,
} from '../lib/prices'
import PriceChart from '../components/PriceChart'
import { Search, TrendingUp, TrendingDown, LogOut, X, ChevronDown, RefreshCw } from 'lucide-react'

const fmt = (n, d = 2) => n == null ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtUSD = (n) => n == null ? '—' : '$' + fmt(n)
const fmtPct = (n) => n == null ? '—' : (n >= 0 ? '+' : '') + fmt(n) + '%'

function StatCard({ label, value, sub, positive }) {
  const color = positive == null ? 'var(--text)' : positive ? 'var(--gain)' : 'var(--loss)'
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px', minWidth: 130 }}>
      <div className="text-muted text-sm" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 18, color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

const TIMEFRAMES = ['1D', '1W', '1M', '3M']

export default function ClientPortal({ session, onLogout }) {
  const [account, setAccount] = useState(null)
  const [positions, setPositions] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [livePrices, setLivePrices] = useState({})

  // Search
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState(null)

  // Price + chart
  const [price, setPrice] = useState(null)
  const [priceLoading, setPriceLoading] = useState(false)
  const [chartData, setChartData] = useState([])
  const [chartLoading, setChartLoading] = useState(false)
  const [timeframe, setTimeframe] = useState('1M')

  // Trade form
  const [tab, setTab] = useState('buy')
  const [quantity, setQuantity] = useState('')
  const [sellTradeId, setSellTradeId] = useState('')
  const [tradeError, setTradeError] = useState('')
  const [tradeLoading, setTradeLoading] = useState(false)
  const [tradeSuccess, setTradeSuccess] = useState('')

  const searchTimeout = useRef(null)
  const priceInterval = useRef(null)

  // ── Data fetching ─────────────────────────────────────────
  async function fetchData() {
    const { data: acc } = await supabase
      .from('trading_accounts').select('*').eq('user_id', session.user.id).single()
    setAccount(acc)

    const { data: trades } = await supabase
      .from('trades').select('*').eq('user_id', session.user.id)
      .order('opened_at', { ascending: false })

    setPositions((trades || []).filter(t => t.status === 'open' || t.status === 'partial'))
    setHistory((trades || []).filter(t => t.status === 'closed'))
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  // ── Live prices for positions ─────────────────────────────
  const refreshPositionPrices = useCallback(async (pos) => {
    const symbols = [...new Set(pos.map(p => p.symbol))]
    const updates = {}
    await Promise.all(symbols.map(async sym => {
      const p = pos.find(x => x.symbol === sym)
      try {
        const r = p.asset_type === 'stock'
          ? await fetchStockPrice(sym)
          : await fetchCryptoPrice(p.coin_id || sym)
        updates[sym] = r.price
      } catch {}
    }))
    setLivePrices(prev => ({ ...prev, ...updates }))
  }, [])

  useEffect(() => {
    if (!positions.length) return
    refreshPositionPrices(positions)
    const id = setInterval(() => refreshPositionPrices(positions), 15000)
    return () => clearInterval(id)
  }, [positions])

  // ── Derived stats ─────────────────────────────────────────
  const unrealizedPnL = positions.reduce((sum, p) => {
    const rem = p.quantity - (p.closed_quantity || 0)
    const cur = livePrices[p.symbol]
    return cur != null ? sum + (cur - p.entry_price) * rem : sum
  }, 0)

  const positionsMarketValue = positions.reduce((sum, p) => {
    const rem = p.quantity - (p.closed_quantity || 0)
    const cur = livePrices[p.symbol]
    return cur != null ? sum + cur * rem : sum + p.entry_price * rem
  }, 0)

  const equity = account ? account.balance + positionsMarketValue : null

  const realizedPnL = history.reduce((sum, t) => {
    if (t.exit_price == null) return sum
    return sum + (t.exit_price - t.entry_price) * (t.closed_quantity || t.quantity)
  }, 0)

  // ── Search ────────────────────────────────────────────────
  useEffect(() => {
    if (!query.trim()) { setSearchResults([]); return }
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      try {
        const [stocks, crypto] = await Promise.all([
          searchStocks(query).catch(() => []),
          searchCrypto(query).catch(() => []),
        ])
        setSearchResults([
          ...stocks.map(s => ({ ...s, type: 'stock' })),
          ...crypto.map(c => ({ symbol: c.symbol, name: c.name, type: 'crypto', coinId: c.id })),
        ])
      } finally { setSearching(false) }
    }, 400)
    return () => clearTimeout(searchTimeout.current)
  }, [query])

  // ── Select asset ──────────────────────────────────────────
  async function selectAsset(asset) {
    setSelectedAsset(asset)
    setQuery(''); setSearchResults([])
    setPrice(null); setChartData([])
    setQuantity(''); setTradeError(''); setTradeSuccess('')
    clearInterval(priceInterval.current)

    setPriceLoading(true); setChartLoading(true)
    try {
      const [priceResult, candles] = await Promise.all([
        asset.type === 'stock' ? fetchStockPrice(asset.symbol) : fetchCryptoPrice(asset.coinId || asset.symbol),
        asset.type === 'stock'
          ? fetchStockCandles(asset.symbol, timeframe).catch(() => [])
          : fetchCryptoCandles(asset.coinId || asset.symbol, timeframe).catch(() => []),
      ])
      setPrice(priceResult)
      setChartData(candles)
    } catch {}
    finally { setPriceLoading(false); setChartLoading(false) }

    priceInterval.current = setInterval(async () => {
      try {
        const r = asset.type === 'stock'
          ? await fetchStockPrice(asset.symbol)
          : await fetchCryptoPrice(asset.coinId || asset.symbol)
        setPrice(r)
      } catch {}
    }, 15000)
  }

  // ── Reload chart when timeframe changes ───────────────────
  useEffect(() => {
    if (!selectedAsset) return
    setChartLoading(true)
    const fetch = selectedAsset.type === 'stock'
      ? fetchStockCandles(selectedAsset.symbol, timeframe)
      : fetchCryptoCandles(selectedAsset.coinId || selectedAsset.symbol, timeframe)
    fetch.then(setChartData).catch(() => {}).finally(() => setChartLoading(false))
  }, [timeframe])

  useEffect(() => () => clearInterval(priceInterval.current), [])

  // ── Buy ───────────────────────────────────────────────────
  async function handleBuy() {
    const qty = parseFloat(quantity)
    if (!selectedAsset || !price || isNaN(qty) || qty <= 0) { setTradeError('Enter a valid quantity.'); return }
    const cost = price.price * qty
    if (cost > account.balance) { setTradeError(`Insufficient balance. Need ${fmtUSD(cost)}, have ${fmtUSD(account.balance)}.`); return }
    setTradeLoading(true); setTradeError('')
    try {
      const { error: e1 } = await supabase.from('trades').insert({
        user_id: session.user.id,
        company_id: account.company_id,
        symbol: selectedAsset.symbol,
        asset_type: selectedAsset.type,
        asset_name: selectedAsset.name,
        coin_id: selectedAsset.coinId || null,
        side: 'buy', quantity: qty,
        entry_price: price.price, status: 'open',
      })
      if (e1) throw e1
      const { error: e2 } = await supabase.from('trading_accounts')
        .update({ balance: account.balance - cost }).eq('user_id', session.user.id)
      if (e2) throw e2
      setTradeSuccess(`Bought ${qty} ${selectedAsset.symbol} @ ${fmtUSD(price.price)}`)
      setQuantity('')
      await fetchData()
    } catch (e) { setTradeError(e.message || 'Trade failed.') }
    finally { setTradeLoading(false) }
  }

  // ── Sell ──────────────────────────────────────────────────
  async function handleSell() {
    const qty = parseFloat(quantity)
    if (!selectedAsset || !price || isNaN(qty) || qty <= 0) { setTradeError('Enter a valid quantity.'); return }
    if (!sellTradeId) { setTradeError('Select a position to sell from.'); return }
    const pos = positions.find(p => p.id === sellTradeId)
    const remaining = pos.quantity - (pos.closed_quantity || 0)
    if (qty > remaining) { setTradeError(`Max: ${remaining} ${pos.symbol}`); return }
    const proceeds = price.price * qty
    setTradeLoading(true); setTradeError('')
    try {
      const newClosed = (pos.closed_quantity || 0) + qty
      const newStatus = newClosed >= pos.quantity ? 'closed' : 'partial'
      const { error: e1 } = await supabase.from('trades').update({
        closed_quantity: newClosed, exit_price: price.price, status: newStatus,
        closed_at: newStatus === 'closed' ? new Date().toISOString() : null,
      }).eq('id', sellTradeId)
      if (e1) throw e1
      const { error: e2 } = await supabase.from('trading_accounts')
        .update({ balance: account.balance + proceeds }).eq('user_id', session.user.id)
      if (e2) throw e2
      setTradeSuccess(`Sold ${qty} ${pos.symbol} @ ${fmtUSD(price.price)}`)
      setQuantity(''); setSellTradeId('')
      await fetchData()
    } catch (e) { setTradeError(e.message || 'Sell failed.') }
    finally { setTradeLoading(false) }
  }

  const cost = price && quantity ? price.price * parseFloat(quantity || 0) : null
  const selectedPositions = positions.filter(p => p.symbol === selectedAsset?.symbol)

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <header style={{ background: 'var(--sidebar-bg)', padding: '0 28px', height: 58, display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontWeight: 700, fontSize: 16, marginRight: 12 }}>
          <TrendingUp size={20} color="#2563eb" />
          TradingDesk
        </div>

        <div style={{ display: 'flex', gap: 12, flex: 1 }}>
          <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: '6px 14px', color: '#fff' }}>
            <span style={{ color: '#94a3b8', fontSize: 12, marginRight: 6 }}>Balance</span>
            <span style={{ fontWeight: 700 }}>{fmtUSD(account?.balance)}</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: '6px 14px', color: '#fff' }}>
            <span style={{ color: '#94a3b8', fontSize: 12, marginRight: 6 }}>Equity</span>
            <span style={{ fontWeight: 700 }}>{fmtUSD(equity)}</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: '6px 14px' }}>
            <span style={{ color: '#94a3b8', fontSize: 12, marginRight: 6 }}>Unrealized P&L</span>
            <span style={{ fontWeight: 700, color: unrealizedPnL >= 0 ? '#10b981' : '#ef4444' }}>
              {unrealizedPnL >= 0 ? '+' : ''}{fmtUSD(unrealizedPnL)}
            </span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: '6px 14px' }}>
            <span style={{ color: '#94a3b8', fontSize: 12, marginRight: 6 }}>Realized P&L</span>
            <span style={{ fontWeight: 700, color: realizedPnL >= 0 ? '#10b981' : '#ef4444' }}>
              {realizedPnL >= 0 ? '+' : ''}{fmtUSD(realizedPnL)}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8', fontSize: 13 }}>
          <div style={{ width: 28, height: 28, background: '#2563eb', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13 }}>
            {session.user.email[0].toUpperCase()}
          </div>
          <span>{session.user.email}</span>
          <button onClick={onLogout} title="Sign out" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', display: 'flex' }}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, padding: 20, flex: 1, alignItems: 'start' }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Search */}
          <div style={{ background: 'var(--card)', borderRadius: 10, padding: 16, border: '1px solid var(--border)' }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search stock (AAPL, TSLA) or crypto (Bitcoin, ETH)…"
                style={{ width: '100%', paddingLeft: 32 }} />
              {query && (
                <button onClick={() => { setQuery(''); setSearchResults([]) }} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                  <X size={14} />
                </button>
              )}
            </div>
            {searching && <div className="text-muted text-sm" style={{ marginTop: 8 }}>Searching…</div>}
            {searchResults.length > 0 && (
              <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                {searchResults.map((r, i) => (
                  <button key={i} onClick={() => selectAsset(r)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', background: 'none', border: 'none', borderBottom: i < searchResults.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <span style={{ fontWeight: 600, minWidth: 60 }}>{r.symbol}</span>
                    <span className="text-muted text-sm">{r.name}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, background: r.type === 'crypto' ? '#f0fdf4' : '#eff6ff', color: r.type === 'crypto' ? '#166534' : '#1d4ed8', padding: '2px 7px', borderRadius: 99, fontWeight: 600 }}>{r.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Asset + Chart */}
          {selectedAsset ? (
            <div style={{ background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
              {/* Asset header */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{selectedAsset.symbol}</div>
                  <div className="text-muted text-sm">{selectedAsset.name}</div>
                </div>
                {priceLoading && <div className="spinner" style={{ width: 18, height: 18 }} />}
                {price && (
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 24 }}>{fmtUSD(price.price)}</div>
                    {price.changePercent != null && (
                      <div style={{ color: price.changePercent >= 0 ? 'var(--gain)' : 'var(--loss)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                        {price.changePercent >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                        {fmtPct(price.changePercent)}
                        <RefreshCw size={11} style={{ color: 'var(--text-muted)', marginLeft: 2 }} title="Auto-refreshes every 15s" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Timeframe buttons */}
              <div style={{ display: 'flex', gap: 4, padding: '10px 18px', borderBottom: '1px solid var(--border)' }}>
                {TIMEFRAMES.map(tf => (
                  <button key={tf} onClick={() => setTimeframe(tf)}
                    style={{ padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                      background: timeframe === tf ? 'var(--primary)' : 'var(--bg)',
                      color: timeframe === tf ? '#fff' : 'var(--text-muted)' }}>
                    {tf}
                  </button>
                ))}
                {chartLoading && <div className="spinner" style={{ width: 16, height: 16, marginLeft: 8, alignSelf: 'center' }} />}
              </div>

              {/* Chart */}
              <div style={{ padding: '8px 4px 4px' }}>
                <PriceChart data={chartData} height={260} />
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)', padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <TrendingUp size={36} style={{ opacity: 0.3, marginBottom: 10 }} />
              <div>Search for a stock or crypto above to get started</div>
            </div>
          )}

          {/* Open Positions */}
          <div style={{ background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              Open Positions
              <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 400, color: 'var(--text-muted)' }}>{positions.length} position{positions.length !== 1 ? 's' : ''}</span>
            </div>
            {positions.length === 0 ? (
              <div className="text-muted text-sm" style={{ padding: 20, textAlign: 'center' }}>No open positions yet.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ fontSize: 12, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                    {['Asset', 'Qty', 'Entry', 'Current', 'P&L', ''].map(h => (
                      <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {positions.map(p => {
                    const rem = p.quantity - (p.closed_quantity || 0)
                    const cur = livePrices[p.symbol]
                    const pnl = cur != null ? (cur - p.entry_price) * rem : null
                    const pnlPos = pnl != null ? pnl >= 0 : null
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 600 }}>{p.symbol}</div>
                          <div className="text-muted" style={{ fontSize: 11 }}>{p.asset_name}</div>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 13 }}>{fmt(rem, 6).replace(/\.?0+$/, '')}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13 }}>{fmtUSD(p.entry_price)}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13 }}>{cur ? fmtUSD(cur) : <span className="text-muted">…</span>}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: pnlPos == null ? 'var(--text-muted)' : pnlPos ? 'var(--gain)' : 'var(--loss)' }}>
                          {pnl != null ? (pnlPos ? '+' : '') + fmtUSD(pnl) : '—'}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => {
                            setTab('sell')
                            selectAsset({ symbol: p.symbol, name: p.asset_name, type: p.asset_type, coinId: p.coin_id })
                            setSellTradeId(p.id)
                          }}>Sell</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Trade History */}
          <div style={{ background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>Trade History</div>
            {history.length === 0 ? (
              <div className="text-muted text-sm" style={{ padding: 20, textAlign: 'center' }}>No closed trades yet.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ fontSize: 12, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                    {['Asset', 'Qty', 'Entry', 'Exit', 'P&L', 'Date'].map(h => (
                      <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map(t => {
                    const pnl = t.exit_price != null ? (t.exit_price - t.entry_price) * (t.closed_quantity || t.quantity) : null
                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 600 }}>{t.symbol}</div>
                          <div className="text-muted" style={{ fontSize: 11 }}>{t.asset_name}</div>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 13 }}>{fmt(t.closed_quantity || t.quantity, 6).replace(/\.?0+$/, '')}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13 }}>{fmtUSD(t.entry_price)}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13 }}>{fmtUSD(t.exit_price)}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: pnl != null ? (pnl >= 0 ? 'var(--gain)' : 'var(--loss)') : 'var(--text-muted)' }}>
                          {pnl != null ? (pnl >= 0 ? '+' : '') + fmtUSD(pnl) : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                          {t.closed_at ? new Date(t.closed_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Right: Trade Form ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)', position: 'sticky', top: 16 }}>
            {/* Buy/Sell tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
              {['buy', 'sell'].map(t => (
                <button key={t} onClick={() => { setTab(t); setTradeError(''); setTradeSuccess('') }}
                  style={{ flex: 1, padding: 13, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14,
                    background: tab === t ? (t === 'buy' ? 'var(--gain)' : 'var(--loss)') : 'none',
                    color: tab === t ? '#fff' : 'var(--text-muted)',
                    borderRadius: t === 'buy' ? '10px 0 0 0' : '0 10px 0 0', transition: 'all 0.15s' }}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="text-muted text-sm" style={{ display: 'block', marginBottom: 4 }}>Asset</label>
                <div style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, color: selectedAsset ? 'var(--text)' : 'var(--text-muted)', fontSize: 13 }}>
                  {selectedAsset ? `${selectedAsset.symbol} — ${selectedAsset.name}` : 'Search and select an asset'}
                </div>
              </div>

              <div>
                <label className="text-muted text-sm" style={{ display: 'block', marginBottom: 4 }}>Price</label>
                <div style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontWeight: 700, fontSize: 15 }}>
                  {priceLoading ? '…' : price ? fmtUSD(price.price) : '—'}
                </div>
              </div>

              {tab === 'sell' && selectedPositions.length > 0 && (
                <div>
                  <label className="text-muted text-sm" style={{ display: 'block', marginBottom: 4 }}>Position</label>
                  <div style={{ position: 'relative' }}>
                    <select value={sellTradeId} onChange={e => setSellTradeId(e.target.value)} style={{ width: '100%', appearance: 'none', paddingRight: 28 }}>
                      <option value="">Select…</option>
                      {selectedPositions.map(p => {
                        const rem = p.quantity - (p.closed_quantity || 0)
                        return <option key={p.id} value={p.id}>Qty {fmt(rem, 6).replace(/\.?0+$/, '')} @ {fmtUSD(p.entry_price)}</option>
                      })}
                    </select>
                    <ChevronDown size={14} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                  </div>
                </div>
              )}

              <div>
                <label className="text-muted text-sm" style={{ display: 'block', marginBottom: 4 }}>Quantity</label>
                <input type="number" min="0" step="any" value={quantity}
                  onChange={e => { setQuantity(e.target.value); setTradeError(''); setTradeSuccess('') }}
                  placeholder="e.g. 1.5" style={{ width: '100%' }} />
              </div>

              {cost > 0 && price && (
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">{tab === 'buy' ? 'Cost' : 'Proceeds'}</span>
                    <span style={{ fontWeight: 700 }}>{fmtUSD(cost)}</span>
                  </div>
                  {tab === 'buy' && account && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span className="text-muted">After balance</span>
                      <span style={{ color: account.balance - cost < 0 ? 'var(--loss)' : 'var(--text)', fontWeight: 600 }}>{fmtUSD(account.balance - cost)}</span>
                    </div>
                  )}
                </div>
              )}

              {tradeError && <div style={{ color: 'var(--loss)', fontSize: 13, background: '#fff1f2', padding: '8px 12px', borderRadius: 6 }}>{tradeError}</div>}
              {tradeSuccess && <div style={{ color: 'var(--gain)', fontSize: 13, background: '#f0fdf4', padding: '8px 12px', borderRadius: 6 }}>{tradeSuccess}</div>}

              <button className="btn w-full" onClick={tab === 'buy' ? handleBuy : handleSell}
                disabled={!account || !selectedAsset || !price || !quantity || tradeLoading}
                style={{ background: tab === 'buy' ? 'var(--gain)' : 'var(--loss)', color: '#fff', fontWeight: 700, fontSize: 15, padding: 12,
                  opacity: (!account || !selectedAsset || !price || !quantity || tradeLoading) ? 0.5 : 1,
                  cursor: (!account || !selectedAsset || !price || !quantity || tradeLoading) ? 'not-allowed' : 'pointer' }}>
                {tradeLoading ? 'Processing…' : `${tab === 'buy' ? 'Buy' : 'Sell'} ${selectedAsset?.symbol || ''}`}
              </button>

              {!account && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>No trading account assigned.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
