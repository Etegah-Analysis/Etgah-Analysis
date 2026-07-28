import YahooFinance from 'yahoo-finance2';

async function test() {
  try {
    const yf = new YahooFinance();
    const results = await yf.options('MSFT');
    console.log("SUCCESS:", results.underlyingSymbol);
  } catch (err) {
    console.error("ERROR 1:", err.message);
  }
}
test();
