import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,DELETE');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // In Vercel, [ticker].js makes the parameter available in req.query.ticker
    const { ticker } = req.query;
    const { date } = req.query;
    
    if (!ticker) {
      return res.status(400).json({ success: false, message: 'Ticker is required' });
    }
    
    console.log(`Fetching options for ${ticker}...`);
    
    const queryOptions = {};
    if (date) {
      queryOptions.date = new Date(date);
    }
    
    const results = await yahooFinance.options(ticker, queryOptions);
    
    res.status(200).json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error fetching options:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch options data',
      error: error.message
    });
  }
}
