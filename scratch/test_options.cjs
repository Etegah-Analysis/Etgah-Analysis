const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

async function test() {
  try {
    const results = await yahooFinance.options('AAPL');
    console.log(JSON.stringify(results, null, 2).slice(0, 1000));
  } catch (error) {
    console.error(error);
  }
}

test();
