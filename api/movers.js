import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    const { type } = req.query; // type = 'gainers' | 'losers' | 'active_options'

    let scrId = 'day_gainers';
    if (type === 'losers') scrId = 'day_losers';
    else if (type === 'active_options') scrId = 'most_actives'; // most active by volume

    const result = await yahooFinance.screener({
      scrIds: scrId,
      count: 5,
    });

    const quotes = (result.quotes || []).map(q => ({
      symbol: q.symbol,
      shortName: q.shortName || q.displayName || q.symbol,
      regularMarketPrice: q.regularMarketPrice,
      regularMarketChange: q.regularMarketChange,
      regularMarketChangePercent: q.regularMarketChangePercent,
      regularMarketVolume: q.regularMarketVolume,
      marketCap: q.marketCap,
      regularMarketDayHigh: q.regularMarketDayHigh,
      regularMarketDayLow: q.regularMarketDayLow,
    }));

    res.status(200).json({ success: true, type, quotes });
  } catch (error) {
    console.error('Error fetching movers:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch movers data', error: error.message });
  }
}
