import yahooFinance from 'yahoo-finance2';
console.log(Object.keys(yahooFinance));
console.log(typeof yahooFinance);
if (yahooFinance.default) {
  console.log('default exists', Object.keys(yahooFinance.default));
}
