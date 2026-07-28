import yahooFinance from 'yahoo-finance2';

async function test() {
  try {
    const results = await yahooFinance.options('MSFT');
    console.log("SUCCESS:", results.underlyingSymbol);
  } catch (err) {
    console.error("ERROR 1:", err.message);
  }
}
test();
