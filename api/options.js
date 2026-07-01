const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
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
    const { ticker } = req.query;
    const { date } = req.query;
    
    console.log(`Fetching options for ${ticker}...`);
    
    const queryOptions = {};
    if (date) {
      queryOptions.date = new Date(date);
    }
    
    const results = await yahooFinance.options(ticker, queryOptions);
    
    res.json({
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
};
