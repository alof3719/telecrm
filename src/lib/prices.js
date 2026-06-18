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
