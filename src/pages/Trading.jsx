import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { fetchStockPrice, fetchCryptoPrice, searchStocks, searchCrypto, resolveCryptoId } from '../lib/prices'
import { Search, TrendingUp, TrendingDown, RefreshCw, ChevronDown, X } from 'lucide-react'

const fmt = (n, decimals = 2) =>
  n == null ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

const fmtUSD = (n) => n == null ? '—' : '$' + fmt(n)

function PnlBadge({ value }) {
  if (value == null) return <span className="text-muted">—</span>
  const pos = value >= 0
  return (
    <span style={{ color: pos ? 'var(--gain)' : 'var(--loss)', fontWeight: 600 }}>
      {pos ? '+' : ''}{fmtUSD(value)}
    </span>
  )
}

export default function Trading({ session, companyId }) {
  const [account, setAccount] = useState(null)
  const [positions, setPositions] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  // Asset search
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState(null) // { symbol, name, type, coinId? }
  const [price, setPrice] = useState(null)
  const [priceLoading, setPriceLoading] = useState(false)
  const [priceError, setPriceError] = useState('')

  // Trade form
  const [tab, setTab] = useState('buy') // 'buy' | 'sell'
  const [quantity, setQuantity] = useState('')
  const [sellTradeId, setSellTradeId] = useState('') // which position to sell from
  const [tradeError, setTradeError] = useState('')
  const [tradeLoading, setTradeLoading] = useState(false)
  const [tradeSuccess, setTradeSuccess] = useState('')

  // Position prices (for live P&L)
  const [livePrices, setLivePrices] = useState({})

  const searchTimeout = useRef(null)
  const priceInterval = useRef(null)

  // ── Fetch account & trades ─────────────────────────────────
  async function fetchData() {
    const { data: acc } = await supabase
      .from('trading_accounts')
      .select('*')
      .eq('user_id', session.user.id)
      .single()
    setAccount(acc)

    const { data: trades } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', session.user.id)
      .order('opened_at', { ascending: false })

    const open = (trades || []).filter(t => t.status === 'open' || t.status === 'partial')
    const closed = (trades || []).filter(t => t.status === 'closed')
    setPositions(open)
    setHistory(closed)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  // ── Live prices for open positions ─────────────────────────
  const refreshPositionPrices = useCallback(async (pos) => {
    const symbols = [...new Set(pos.map(p => p.symbol))]
    const updates = {}
    await Promise.all(symbols.map(async sym => {
      const p = pos.find(x => x.symbol === sym)
      try {
        if (p.asset_type === 'stock') {
          const r = await fetchStockPrice(sym)
          updates[sym] = r.price
        } else {
          const r = await fetchCryptoPrice(p.coin_id || sym)
          updates[sym] = r.price
        }
      } catch {}
    }))
    setLivePrices(prev => ({ ...prev, ...updates }))
  }, [])

  useEffect(() => {
    if (positions.length === 0) return
    refreshPositionPrices(positions)
    priceInterval.current = setInterval(() => refreshPositionPrices(positions), 15000)
    return () => clearInterval(priceInterval.current)
  }, [positions])

  // ── Asset search ───────────────────────────────────────────
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
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => clearTimeout(searchTimeout.current)
  }, [query])

  // ── Select asset → fetch price ─────────────────────────────
  async function selectAsset(asset) {
    setSelectedAsset(asset)
    setQuery('')
    setSearchResults([])
    setPrice(null)
    setPriceError('')
    setQuantity('')
    setTradeError('')
    setTradeSuccess('')
    setPriceLoading(true)
    clearInterval(priceInterval.current)
    try {
      let result
      if (asset.type === 'stock') {
        result = await fetchStockPrice(asset.symbol)
      } else {
        result = await fetchCryptoPrice(asset.coinId || asset.symbol)
      }
      setPrice(result)
    } catch (e) {
      setPriceError('Could not fetch price. Try again.')
    } finally {
      setPriceLoading(false)
    }
    // refresh price every 15s
    priceInterval.current = setInterval(async () => {
      try {
        let result
        if (asset.type === 'stock') result = await fetchStockPrice(asset.symbol)
        else result = await fetchCryptoPrice(asset.coinId || asset.symbol)
        setPrice(result)
      } catch {}
    }, 15000)
  }

  useEffect(() => () => clearInterval(priceInterval.current), [])

  // ── Execute buy ────────────────────────────────────────────
  async function handleBuy() {
    if (!selectedAsset || !price || !quantity) return
    const qty = parseFloat(quantity)
    if (isNaN(qty) || qty <= 0) { setTradeError('Enter a valid quantity.'); return }
    const cost = price.price * qty
    if (cost > account.balance) { setTradeError(`Insufficient balance. Need ${fmtUSD(cost)}, have ${fmtUSD(account.balance)}.`); return }

    setTradeLoading(true)
    setTradeError('')
    try {
      const { error: tradeErr } = await supabase.from('trades').insert({
        user_id: session.user.id,
        company_id: companyId,
        symbol: selectedAsset.symbol,
        asset_type: selectedAsset.type,
        asset_name: selectedAsset.name,
        coin_id: selectedAsset.coinId || null,
        side: 'buy',
        quantity: qty,
        entry_price: price.price,
        status: 'open',
      })
      if (tradeErr) throw tradeErr

      const { error: balErr } = await supabase
        .from('trading_accounts')
        .update({ balance: account.balance - cost })
        .eq('user_id', session.user.id)
      if (balErr) throw balErr

      setTradeSuccess(`Bought ${fmt(qty, 8).replace(/\.?0+$/, '')} ${selectedAsset.symbol} at ${fmtUSD(price.price)}`)
      setQuantity('')
      await fetchData()
    } catch (e) {
      setTradeError(e.message || 'Trade failed.')
    } finally {
      setTradeLoading(false)
    }
  }

  // ── Execute sell ───────────────────────────────────────────
  async function handleSell() {
    if (!selectedAsset || !price || !quantity || !sellTradeId) { setTradeError('Select a position to sell from.'); return }
    const qty = parseFloat(quantity)
    if (isNaN(qty) || qty <= 0) { setTradeError('Enter a valid quantity.'); return }

    const pos = positions.find(p => p.id === sellTradeId)
    if (!pos) { setTradeError('Position not found.'); return }
    const remaining = pos.quantity - (pos.closed_quantity || 0)
    if (qty > remaining) { setTradeError(`Max sellable: ${fmt(remaining, 8).replace(/\.?0+$/, '')} ${pos.symbol}`); return }

    const proceeds = price.price * qty
    setTradeLoading(true)
    setTradeError('')
    try {
      const newClosed = (pos.closed_quantity || 0) + qty
      const newStatus = newClosed >= pos.quantity ? 'closed' : 'partial'

      const { error: tradeErr } = await supabase
        .from('trades')
        .update({
          closed_quantity: newClosed,
          exit_price: price.price,
          status: newStatus,
          closed_at: newStatus === 'closed' ? new Date().toISOString() : null,
        })
        .eq('id', sellTradeId)
      if (tradeErr) throw tradeErr

      const { error: balErr } = await supabase
        .from('trading_accounts')
        .update({ balance: account.balance + proceeds })
        .eq('user_id', session.user.id)
      if (balErr) throw balErr

      setTradeSuccess(`Sold ${fmt(qty, 8).replace(/\.?0+$/, '')} ${pos.symbol} at ${fmtUSD(price.price)} (+${fmtUSD(proceeds)})`)
      setQuantity('')
      setSellTradeId('')
      await fetchData()
    } catch (e) {
      setTradeError(e.message || 'Sell failed.')
    } finally {
      setTradeLoading(false)
    }
  }

  const cost = price && quantity ? price.price * parseFloat(quantity || 0) : null
  const selectedPositions = positions.filter(p => p.symbol === selectedAsset?.symbol)

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <TrendingUp size={22} color="var(--primary)" />
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Trading</h1>
        {account && (
          <span style={{ marginLeft: 'auto', background: 'var(--primary-light)', color: 'var(--primary)', padding: '6px 14px', borderRadius: 8, fontWeight: 700, fontSize: 15 }}>
            Balance: {fmtUSD(account.balance)}
          </span>
        )}
      </div>

      {!account && (
        <div style={{ background: '#fff8ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '14px 18px', marginBottom: 20, color: '#92400e' }}>
          No trading account yet. Ask an admin to create one for you.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
        {/* ── Left: search + asset + portfolio ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Search */}
          <div style={{ background: 'var(--card)', borderRadius: 10, padding: 18, border: '1px solid var(--border)' }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search stock (AAPL) or crypto (Bitcoin)…"
                style={{ width: '100%', paddingLeft: 32 }}
              />
              {query && (
                <button onClick={() => { setQuery(''); setSearchResults([]) }} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <X size={14} />
                </button>
              )}
            </div>
            {searching && <div className="text-muted text-sm" style={{ marginTop: 8 }}>Searching…</div>}
            {searchResults.length > 0 && (
              <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => selectAsset(r)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', background: 'none', border: 'none', borderBottom: i < searchResults.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <span style={{ fontWeight: 600, minWidth: 60 }}>{r.symbol}</span>
                    <span className="text-muted text-sm">{r.name}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, background: r.type === 'crypto' ? '#f0fdf4' : '#eff6ff', color: r.type === 'crypto' ? '#166534' : '#1d4ed8', padding: '2px 7px', borderRadius: 99, fontWeight: 600 }}>
                      {r.type}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected asset price */}
          {selectedAsset && (
            <div style={{ background: 'var(--card)', borderRadius: 10, padding: 18, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17 }}>{selectedAsset.symbol}</div>
                  <div className="text-muted text-sm">{selectedAsset.name}</div>
                </div>
                {priceLoading && <div className="spinner" style={{ width: 18, height: 18, marginLeft: 'auto' }} />}
                {price && !priceLoading && (
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 22 }}>{fmtUSD(price.price)}</div>
                    {price.changePercent != null && (
                      <div style={{ color: price.changePercent >= 0 ? 'var(--gain)' : 'var(--loss)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                        {price.changePercent >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                        {price.changePercent >= 0 ? '+' : ''}{fmt(price.changePercent)}%
                        <RefreshCw size={11} style={{ color: 'var(--text-muted)', marginLeft: 4 }} title="Auto-refreshes every 15s" />
                      </div>
                    )}
                  </div>
                )}
                {priceError && <div style={{ color: 'var(--danger)', fontSize: 13, marginLeft: 'auto' }}>{priceError}</div>}
              </div>
            </div>
          )}

          {/* Open Positions */}
          <div style={{ background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>Open Positions</div>
            {positions.length === 0 ? (
              <div className="text-muted text-sm" style={{ padding: '18px', textAlign: 'center' }}>No open positions yet.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
                    {['Asset', 'Qty', 'Entry', 'Current', 'P&L', ''].map(h => (
                      <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {positions.map(p => {
                    const remaining = p.quantity - (p.closed_quantity || 0)
                    const currentPrice = livePrices[p.symbol]
                    const pnl = currentPrice != null ? (currentPrice - p.entry_price) * remaining : null
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 600 }}>{p.symbol}</div>
                          <div className="text-muted text-sm">{p.asset_name}</div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>{fmt(remaining, 8).replace(/\.?0+$/, '')}</td>
                        <td style={{ padding: '10px 14px' }}>{fmtUSD(p.entry_price)}</td>
                        <td style={{ padding: '10px 14px' }}>{currentPrice ? fmtUSD(currentPrice) : <span className="text-muted">…</span>}</td>
                        <td style={{ padding: '10px 14px' }}><PnlBadge value={pnl} /></td>
                        <td style={{ padding: '10px 14px' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => { setTab('sell'); selectAsset({ symbol: p.symbol, name: p.asset_name, type: p.asset_type, coinId: p.coin_id }); setSellTradeId(p.id) }}
                          >
                            Sell
                          </button>
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
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>Trade History</div>
            {history.length === 0 ? (
              <div className="text-muted text-sm" style={{ padding: '18px', textAlign: 'center' }}>No closed trades yet.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
                    {['Asset', 'Qty', 'Entry', 'Exit', 'P&L'].map(h => (
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
                          <div className="text-muted text-sm">{t.asset_name}</div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>{fmt(t.closed_quantity || t.quantity, 8).replace(/\.?0+$/, '')}</td>
                        <td style={{ padding: '10px 14px' }}>{fmtUSD(t.entry_price)}</td>
                        <td style={{ padding: '10px 14px' }}>{fmtUSD(t.exit_price)}</td>
                        <td style={{ padding: '10px 14px' }}><PnlBadge value={pnl} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Right: Trade Form ── */}
        <div style={{ background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)', position: 'sticky', top: 20 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            {['buy', 'sell'].map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setTradeError(''); setTradeSuccess('') }}
                style={{
                  flex: 1, padding: '13px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14,
                  background: tab === t ? (t === 'buy' ? 'var(--gain)' : 'var(--loss)') : 'none',
                  color: tab === t ? '#fff' : 'var(--text-muted)',
                  borderRadius: t === 'buy' ? '10px 0 0 0' : '0 10px 0 0',
                  transition: 'all 0.15s',
                }}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Asset display */}
            <div>
              <label className="text-muted text-sm" style={{ display: 'block', marginBottom: 4 }}>Asset</label>
              <div style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, color: selectedAsset ? 'var(--text)' : 'var(--text-muted)', fontSize: 14 }}>
                {selectedAsset ? `${selectedAsset.symbol} — ${selectedAsset.name}` : 'Search and select an asset'}
              </div>
            </div>

            {/* Price */}
            <div>
              <label className="text-muted text-sm" style={{ display: 'block', marginBottom: 4 }}>Current Price</label>
              <div style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontWeight: 700 }}>
                {priceLoading ? '…' : price ? fmtUSD(price.price) : '—'}
              </div>
            </div>

            {/* Sell: position selector */}
            {tab === 'sell' && selectedPositions.length > 0 && (
              <div>
                <label className="text-muted text-sm" style={{ display: 'block', marginBottom: 4 }}>Position</label>
                <div style={{ position: 'relative' }}>
                  <select value={sellTradeId} onChange={e => setSellTradeId(e.target.value)} style={{ width: '100%', appearance: 'none', paddingRight: 28 }}>
                    <option value="">Select position…</option>
                    {selectedPositions.map(p => {
                      const rem = p.quantity - (p.closed_quantity || 0)
                      return <option key={p.id} value={p.id}>Qty {fmt(rem, 8).replace(/\.?0+$/, '')} @ {fmtUSD(p.entry_price)}</option>
                    })}
                  </select>
                  <ChevronDown size={14} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                </div>
              </div>
            )}

            {/* Quantity */}
            <div>
              <label className="text-muted text-sm" style={{ display: 'block', marginBottom: 4 }}>Quantity</label>
              <input
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={e => { setQuantity(e.target.value); setTradeError(''); setTradeSuccess('') }}
                placeholder="e.g. 1.5"
                style={{ width: '100%' }}
              />
            </div>

            {/* Estimated cost/proceeds */}
            {cost > 0 && price && (
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">{tab === 'buy' ? 'Estimated cost' : 'Estimated proceeds'}</span>
                  <span style={{ fontWeight: 700 }}>{fmtUSD(cost)}</span>
                </div>
                {tab === 'buy' && account && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span className="text-muted">Remaining balance</span>
                    <span style={{ color: account.balance - cost < 0 ? 'var(--loss)' : 'var(--text)', fontWeight: 600 }}>{fmtUSD(account.balance - cost)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Error / success */}
            {tradeError && <div style={{ color: 'var(--loss)', fontSize: 13, background: '#fff1f2', padding: '8px 12px', borderRadius: 6 }}>{tradeError}</div>}
            {tradeSuccess && <div style={{ color: 'var(--gain)', fontSize: 13, background: '#f0fdf4', padding: '8px 12px', borderRadius: 6 }}>{tradeSuccess}</div>}

            {/* Submit */}
            <button
              className="btn w-full"
              onClick={tab === 'buy' ? handleBuy : handleSell}
              disabled={!account || !selectedAsset || !price || !quantity || tradeLoading}
              style={{
                background: tab === 'buy' ? 'var(--gain)' : 'var(--loss)',
                color: '#fff', fontWeight: 700, fontSize: 15, padding: '12px',
                opacity: (!account || !selectedAsset || !price || !quantity || tradeLoading) ? 0.5 : 1,
                cursor: (!account || !selectedAsset || !price || !quantity || tradeLoading) ? 'not-allowed' : 'pointer',
              }}
            >
              {tradeLoading ? 'Processing…' : `${tab === 'buy' ? 'Buy' : 'Sell'} ${selectedAsset?.symbol || ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
