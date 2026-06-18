const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY

const CRYPTO_ID_MAP = {
  btc: 'bitcoin', bitcoin: 'bitcoin',
  eth: 'ethereum', ethereum: 'ethereum',
  sol: 'solana', solana: 'solana',
  bnb: 'binancecoin',
  xrp: 'ripple', ripple: 'ripple',
  ada: 'cardano', cardano: 'cardano',
  doge: 'dogecoin', dogecoin: 'dogecoin',
  dot: 'polkadot', polkadot: 'polkadot',
  avax: 'avalanche-2',
  matic: 'matic-network', polygon: 'matic-network',
  link: 'chainlink', chainlink: 'chainlink',
  ltc: 'litecoin', litecoin: 'litecoin',
  uni: 'uniswap', uniswap: 'uniswap',
  atom: 'cosmos', cosmos: 'cosmos',
  xlm: 'stellar', stellar: 'stellar',
}

export async function fetchStockPrice(symbol) {
  const res = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`
  )
  const data = await res.json()
  if (!data.c || data.c === 0) throw new Error('Symbol not found')
  return {
    price: data.c,
    change: data.d,
    changePercent: data.dp,
  }
}

export async function fetchCryptoPrice(coinId) {
  const id = CRYPTO_ID_MAP[coinId.toLowerCase()] || coinId.toLowerCase()
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`
  )
  const data = await res.json()
  if (!data[id]) throw new Error('Coin not found')
  return {
    price: data[id].usd,
    changePercent: data[id].usd_24h_change,
    change: null,
    coinId: id,
  }
}

export async function searchStocks(query) {
  if (!query || query.length < 1) return []
  const res = await fetch(
    `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${FINNHUB_KEY}`
  )
  const data = await res.json()
  return (data.result || [])
    .filter(r => r.type === 'Common Stock' && !r.symbol.includes('.'))
    .slice(0, 8)
    .map(r => ({ symbol: r.symbol, name: r.description }))
}

export async function searchCrypto(query) {
  if (!query || query.length < 1) return []
  const res = await fetch(
    `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`
  )
  const data = await res.json()
  return (data.coins || []).slice(0, 8).map(c => ({
    id: c.id,
    symbol: c.symbol.toUpperCase(),
    name: c.name,
  }))
}

export function resolveCryptoId(symbolOrId) {
  return CRYPTO_ID_MAP[symbolOrId.toLowerCase()] || symbolOrId.toLowerCase()
}

// timeframe: '1D' | '1W' | '1M' | '3M'
export async function fetchStockCandles(symbol, timeframe = '1M') {
  const now = Math.floor(Date.now() / 1000)
  const configs = {
    '1D': { resolution: '5',  from: now - 86400 },
    '1W': { resolution: '60', from: now - 7 * 86400 },
    '1M': { resolution: 'D',  from: now - 30 * 86400 },
    '3M': { resolution: 'D',  from: now - 90 * 86400 },
  }
  const { resolution, from } = configs[timeframe] || configs['1M']
  const res = await fetch(
    `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${from}&to=${now}&token=${FINNHUB_KEY}`
  )
  const data = await res.json()
  if (data.s !== 'ok' || !data.t) throw new Error('No candle data')
  return data.t.map((t, i) => ({ time: t, value: data.c[i] }))
}

export async function fetchCryptoCandles(coinId, timeframe = '1M') {
  const id = CRYPTO_ID_MAP[coinId.toLowerCase()] || coinId.toLowerCase()
  const days = { '1D': 1, '1W': 7, '1M': 30, '3M': 90 }[timeframe] || 30
  const interval = days <= 1 ? '' : '&interval=daily'
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}${interval}`
  )
  const data = await res.json()
  if (!data.prices) throw new Error('No price data')
  return data.prices.map(([ts, price]) => ({ time: Math.floor(ts / 1000), value: price }))
}
