import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, doc, getDoc, setDoc, serverTimestamp } from '../firebase';

const POPULAR_TICKERS = [
  'AAPL', 'MSFT', 'TSLA', 'NVDA', 'AMZN', 'META', 'GOOGL', 'NFLX', 'AMD', 'BABA',
  'SPY', 'QQQ', 'COIN', 'PLTR', 'MARA', 'RIOT', 'SOXL', 'IWM', 'JPM', 'BAC',
  'DIS', 'NKE', 'XOM', 'CVX', 'TSM', 'ASML', 'INTC', 'MU', 'ARM', 'AVGO'
];

function MoverCard({ quote }) {
  const pct = quote.regularMarketChangePercent || 0;
  const isGain = pct >= 0;
  const color = isGain ? '#00c853' : '#ff5252';
  const bg = isGain ? 'rgba(0,200,83,0.07)' : 'rgba(213,0,0,0.07)';
  const border = isGain ? 'rgba(0,200,83,0.25)' : 'rgba(213,0,0,0.25)';
  const arrow = isGain ? '\u25B2' : '\u25BC';
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '160px', flex: '1', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
      className="mover-card-hover"
      onClick={() => window.open('https://finance.yahoo.com/quote/' + quote.symbol, '_blank')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: '800', fontSize: '1rem', color: 'white' }}>{quote.symbol}</span>
        <span style={{ fontSize: '0.78rem', color, fontWeight: '700', background: color + '22', padding: '2px 8px', borderRadius: '20px' }}>
          {arrow} {Math.abs(pct).toFixed(2)}%
        </span>
      </div>
      <div style={{ color: '#8b9eb3', fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {quote.shortName}
      </div>
      <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color }}>
        ${(quote.regularMarketPrice || 0).toFixed(2)}
      </div>
      <div style={{ color: '#8b9eb3', fontSize: '0.75rem' }}>
        تغيير: <span style={{ color }}>{(quote.regularMarketChange || 0) >= 0 ? '+' : ''}{(quote.regularMarketChange || 0).toFixed(2)}</span>
      </div>
    </div>
  );
}

function USOptions() {
  const navigate = useNavigate();
  const [ticker, setTicker] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expirationDates, setExpirationDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [calls, setCalls] = useState([]);
  const [puts, setPuts] = useState([]);
  const [underlyingPrice, setUnderlyingPrice] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [moversTab, setMoversTab] = useState('gainers');
  const [moversData, setMoversData] = useState({ gainers: [], losers: [], active: [] });
  const [moversLoading, setMoversLoading] = useState(true);



  // Fetch Market Movers on mount
  useEffect(() => {
    const fetchMovers = async () => {
      setMoversLoading(true);
      try {
        const [gainersRes, losersRes, activeRes] = await Promise.all([
          fetch('/api/movers?type=gainers'),
          fetch('/api/movers?type=losers'),
          fetch('/api/movers?type=active_options'),
        ]);
        const [gainersData, losersData, activeData] = await Promise.all([
          gainersRes.json(),
          losersRes.json(),
          activeRes.json(),
        ]);
        setMoversData({
          gainers: gainersData.success ? gainersData.quotes : [],
          losers: losersData.success ? losersData.quotes : [],
          active: activeData.success ? activeData.quotes : [],
        });
      } catch (err) {
        console.error('Error fetching movers:', err);
      } finally {
        setMoversLoading(false);
      }
    };
    fetchMovers();
  }, []);

  const fetchOptionsChain = async (symbol, dateStr = '') => {

    setLoading(true);
    setError('');
    try {
      const tickerUpper = symbol.toUpperCase();
      const docId = dateStr ? `${tickerUpper}_${dateStr}` : tickerUpper;
      
      // 1. محاولة جلب البيانات من Firebase أولاً
      const docRef = doc(db, 'market_data', docId);
      const docSnap = await getDoc(docRef);
      
      let data = null;
      let shouldRefresh = false;
      
      if (docSnap.exists()) {
        const storedData = docSnap.data();
        const lastUpdated = storedData.lastUpdated?.toDate() || new Date(0);
        const now = new Date();
        const ageInMinutes = (now - lastUpdated) / (1000 * 60);
        
        // إذا كانت البيانات أقدم من 5 دقائق، أو البيانات تالفة، قم بتحديثها
        if (ageInMinutes > 5 || !storedData.data || !storedData.data.expirationDates || storedData.data.expirationDates.length === 0) {
          shouldRefresh = true;
        } else {
          data = storedData.data;
        }
      } else {
        shouldRefresh = true;
      }
      
      // 2. إذا كانت البيانات قديمة أو غير موجودة، جلبها من الـ Serverless Function الخاصة بنا
      if (shouldRefresh) {
        console.log(`Fetching fresh data for ${tickerUpper} (date: ${dateStr}) from Vercel API...`);
        
        const apiUrl = `/api/options/${tickerUpper}?t=${Date.now()}${dateStr ? `&date=${dateStr}` : ''}`;
        const response = await fetch(apiUrl, { cache: 'no-store' });
        
        if (!response.ok) {
          throw new Error('Failed to fetch from Vercel API');
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
          data = result.data;
          
          // تخزين البيانات في Firebase
          await setDoc(docRef, {
            ticker: tickerUpper,
            date: dateStr || '',
            data: data,
            lastUpdated: serverTimestamp()
          }, { merge: true });
          
          console.log(`Data stored in Firebase for ${docId}`);
        } else {
          throw new Error('Invalid data format from Vercel API');
        }
      }
      
      // 3. عرض البيانات
      if (data) {
        // Set underlying price if available
        if (data.quote && data.quote.regularMarketPrice) {
          setUnderlyingPrice(data.quote.regularMarketPrice);
        }
        
        // Set available expiration dates
        if (data.expirationDates && data.expirationDates.length > 0) {
          const dates = data.expirationDates.map(d => {
            const date = typeof d === 'number' ? new Date(d * 1000) : new Date(d);
            return date.toISOString().split('T')[0];
          });
          setExpirationDates(dates);
          if (!dateStr && dates.length > 0) {
            setSelectedDate(dates[0]);
          }
        }
        
        // Extract options data
        if (data.options && data.options.length > 0) {
          const currentOptionChain = data.options[0];
          setCalls(currentOptionChain.calls || []);
          setPuts(currentOptionChain.puts || []);
        } else {
          setCalls([]);
          setPuts([]);
        }
      } else {
        setError('فشل جلب البيانات. يرجى المحاولة لاحقاً.');
      }
    } catch (err) {
      console.error(err);
      setError('لا يمكن الاتصال بخادم جلب البيانات. يرجى المحاولة لاحقاً.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('etegah_user');
    if (savedUser && ticker) {
      fetchOptionsChain(ticker);
    }
  }, [ticker]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setTicker(searchInput.trim().toUpperCase());
      setShowSuggestions(false);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value.toUpperCase();
    setSearchInput(val);
    if (val.trim()) {
      const filtered = POPULAR_TICKERS.filter(t => t.startsWith(val));
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    fetchOptionsChain(ticker, date);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleOutsideClick = () => {
      setShowSuggestions(false);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  return (
    <div className="container" style={{ padding: '40px 20px', minHeight: '80vh' }} onClick={() => setShowSuggestions(false)}>
      {/* Title Header */}
      <div className="text-center mb-8">
        <h1 style={{ fontSize: '2.5rem', color: 'var(--primary-blue)', fontWeight: '800' }}>رادار الأوبشن الأمريكي 🎯</h1>
        <p style={{ color: '#8b9eb3', fontSize: '1.1rem' }}>شاشة ذكية لمتابعة عقود خيارات الأسهم الأمريكية لحظة بلحظة</p>
      </div>

      {/* ===== MARKET MOVERS SECTION ===== */}
      <div className="glass card" style={{ padding: '24px', borderRadius: '16px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: 'white' }}>📊 حركة السوق الأمريكي</h2>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'gainers', label: '🟢 أعلى صعوداً', activeColor: '#00c853' },
              { id: 'losers', label: '🔴 أعلى هبوطاً', activeColor: '#ff5252' },
              { id: 'active', label: '⚡ الأكثر نشاطاً', activeColor: 'var(--primary-blue)' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setMoversTab(tab.id)}
                style={{
                  padding: '7px 14px', borderRadius: '20px', cursor: 'pointer',
                  fontWeight: '700', fontSize: '0.82rem', transition: 'all 0.2s',
                  background: moversTab === tab.id ? tab.activeColor + '30' : 'rgba(255,255,255,0.05)',
                  color: moversTab === tab.id ? tab.activeColor : '#8b9eb3',
                  border: moversTab === tab.id ? `1px solid ${tab.activeColor}60` : '1px solid rgba(255,255,255,0.08)'
                }}
              >{tab.label}</button>
            ))}
          </div>
        </div>

        {moversLoading ? (
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px 16px', minWidth: '160px', flex: '1', height: '90px', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : (moversData[moversTab] || []).length === 0 ? (
          <div style={{ textAlign: 'center', color: '#8b9eb3', padding: '20px' }}>لا توجد بيانات متاحة حالياً</div>
        ) : (
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
            {(moversData[moversTab] || []).map((q) => (
              <MoverCard key={q.symbol} quote={q} />
            ))}
          </div>
        )}
        <div style={{ marginTop: '12px', fontSize: '0.78rem', color: '#8b9eb3', textAlign: 'right' }}>
          * البيانات متأخرة 15 دقيقة · انقر على أي بطاقة للتفاصيل على Yahoo Finance
        </div>
      </div>


      <div className="glass card" style={{ padding: '30px', borderRadius: '16px', marginBottom: '30px' }} onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
          
          <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#8b9eb3', fontWeight: '600' }}>رمز السهم الأمريكي (Ticker)</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input 
                type="text" 
                value={searchInput} 
                onChange={handleInputChange}
                onFocus={() => {
                  if (searchInput.trim()) {
                    const filtered = POPULAR_TICKERS.filter(t => t.startsWith(searchInput.toUpperCase()));
                    setSuggestions(filtered);
                    setShowSuggestions(true);
                  }
                }}
                placeholder="مثال: AAPL, TSLA, NVDA"
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-blue)',
                  background: 'var(--dark-navy)',
                  color: 'white',
                  fontWeight: 'bold',
                  outline: 'none'
                }}
              />
              <button className="button primary" type="submit" style={{ padding: '12px 24px' }}>بحث</button>
            </div>

            {/* Premium Autocomplete Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'var(--dark-navy)',
                border: '1px solid var(--border-blue)',
                borderRadius: '8px',
                marginTop: '5px',
                maxHeight: '200px',
                overflowY: 'auto',
                zIndex: 1000,
                boxShadow: '0 8px 32px rgba(0, 210, 255, 0.25)',
                backdropFilter: 'blur(10px)'
              }}>
                {suggestions.map((sym) => (
                  <div 
                    key={sym} 
                    onClick={() => {
                      setSearchInput(sym);
                      setTicker(sym);
                      setShowSuggestions(false);
                    }}
                    style={{
                      padding: '12px 15px',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(19, 48, 78, 0.5)',
                      textAlign: 'right',
                      fontWeight: 'bold',
                      color: 'white',
                      transition: 'background 0.2s'
                    }}
                    className="suggestion-item-hover"
                  >
                    {sym} - عقود خيارات سهم
                  </div>
                ))}
              </div>
            )}

            {/* Scrollable Popular Tickers strip */}
            <div style={{ marginTop: '15px' }}>
              <span style={{ fontSize: '0.85rem', color: '#8b9eb3', display: 'block', marginBottom: '8px', fontWeight: '600' }}>🔥 اختر عقداً للتحليل السريع:</span>
              <div 
                style={{
                  display: 'flex',
                  gap: '8px',
                  overflowX: 'auto',
                  paddingBottom: '8px',
                  scrollbarWidth: 'thin',
                  WebkitOverflowScrolling: 'touch'
                }}
                className="custom-ticker-scroll"
              >
                {POPULAR_TICKERS.map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => {
                      setSearchInput(sym);
                      setTicker(sym);
                      setShowSuggestions(false);
                    }}
                    style={{
                      padding: '6px 14px',
                      background: ticker === sym ? 'rgba(0, 210, 255, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                      border: ticker === sym ? '1px solid var(--primary-blue)' : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '20px',
                      color: ticker === sym ? 'var(--primary-blue)' : 'white',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      fontSize: '0.85rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {ticker && expirationDates.length > 0 && (
            <div style={{ flex: '1 1 100%' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#8b9eb3', fontWeight: '600' }}>تاريخ انتهاء العقد (Expiration)</label>
              <div 
                style={{
                  display: 'flex',
                  gap: '8px',
                  overflowX: 'auto',
                  paddingBottom: '8px',
                  scrollbarWidth: 'thin',
                  WebkitOverflowScrolling: 'touch'
                }}
                className="custom-ticker-scroll"
              >
                {expirationDates.map((date) => (
                  <button
                    key={date}
                    type="button"
                    onClick={() => handleDateChange(date)}
                    style={{
                      padding: '8px 16px',
                      background: selectedDate === date ? 'var(--primary-blue)' : 'rgba(255, 255, 255, 0.05)',
                      border: selectedDate === date ? '1px solid var(--primary-blue)' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: selectedDate === date ? '#07111f' : 'white',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      fontSize: '0.9rem',
                      transition: 'all 0.2s',
                      boxShadow: selectedDate === date ? '0 4px 15px rgba(0, 210, 255, 0.3)' : 'none'
                    }}
                  >
                    {new Date(date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </button>
                ))}
              </div>
            </div>
          )}

          {underlyingPrice && (
            <div style={{ padding: '10px 20px', background: 'rgba(0, 210, 255, 0.1)', borderRadius: '8px', border: '1px solid var(--primary-blue)', textAlign: 'center' }}>
              <span style={{ color: '#8b9eb3', display: 'block', fontSize: '0.85rem' }}>سعر السهم الحالي</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--primary-blue)' }}>${underlyingPrice.toFixed(2)}</span>
            </div>
          )}
        </form>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <div className="spinner" style={{
            border: '4px solid rgba(255,255,255,0.1)',
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            borderLeftColor: 'var(--primary-blue)',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px auto'
          }}></div>
          <p style={{ color: 'var(--primary-blue)', fontWeight: '600' }}>جاري سحب بيانات سلاسل الأوبشن مجاناً...</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="glass" style={{ padding: '20px', borderRadius: '8px', border: '1px solid #ff4a4a', background: 'rgba(255,74,74,0.05)', color: '#ff7e7e', textAlign: 'center', marginBottom: '30px' }}>
          <p style={{ fontWeight: '600', margin: 0 }}>⚠️ {error}</p>
        </div>
      )}

      {/* Blank State Placeholder when no ticker is loaded */}
      {!ticker && !loading && (
        <div className="glass card text-center animate-fadeIn" style={{ padding: '60px 20px', borderRadius: '16px', border: '1px dashed rgba(0, 210, 255, 0.3)', marginBottom: '30px', background: 'rgba(10, 25, 47, 0.3)' }}>
          <div style={{ fontSize: '4.5rem', marginBottom: '20px', animation: 'pulse 2s infinite' }}>🎯</div>
          <h3 style={{ color: 'white', fontWeight: 'bold', fontSize: '1.6rem', marginBottom: '12px' }}>شاشة الرادار جاهزة لبدء التحليل</h3>
          <p style={{ color: '#8b9eb3', maxWidth: '600px', margin: '0 auto 25px auto', fontSize: '1.05rem', lineHeight: '1.7' }}>
            يرجى إدخال رمز السهم الأمريكي في خانة البحث أعلاه، أو الاختيار المباشر من شريط العقود الأكثر نشاطاً لبدء جلب سلاسل الخيارات والأسعار فوراً.
          </p>
        </div>
      )}

      {/* Data Visualisation Tables */}
      {ticker && !loading && !error && (
        <div className="options-container" style={{ display: 'flex', gap: '30px', flexDirection: 'column' }}>
          
          {/* Legend / Info */}
          <div className="text-center" style={{ color: '#8b9eb3', fontSize: '0.9rem' }}>
            <span>💡 ملاحظة: البيانات مجانية ومتأخرة بمقدار 15 دقيقة فقط طبقاً لبورصة شيكاغو للخيارات (CBOE).</span>
          </div>

          {/* Side by side Tables (Calls vs Puts) */}
          <div className="tables-layout" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '30px' }}>
            
            {/* CALLS TABLE */}
            <div className="glass card" style={{ borderRadius: '16px', overflow: 'hidden', padding: 0 }}>
              <div style={{ background: 'rgba(0, 200, 83, 0.1)', padding: '15px 20px', borderBottom: '1px solid rgba(0, 200, 83, 0.3)', display: 'flex', justifyContent: 'between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#00c853', fontWeight: 'bold' }}>عقود الشراء (Calls 🟢)</h3>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: '600px', overflowY: 'auto', scrollbarWidth: 'thin' }} className="custom-ticker-scroll">
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.85rem' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--dark-navy)' }}>
                    <tr style={{ borderBottom: '1px solid var(--border-blue)' }}>
                      <th style={{ padding: '12px 8px' }}>Strike</th>
                      <th style={{ padding: '12px 8px' }}>Bid</th>
                      <th style={{ padding: '12px 8px' }}>Ask</th>
                      <th style={{ padding: '12px 8px' }}>Last</th>
                      <th style={{ padding: '12px 8px' }}>Vol</th>
                      <th style={{ padding: '12px 8px' }}>OI</th>
                      <th style={{ padding: '12px 8px' }}>IV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calls.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ padding: '30px', color: '#8b9eb3' }}>لا توجد بيانات عقود شراء متوفرة.</td>
                      </tr>
                    ) : (
                      calls.map((opt, idx) => (
                        <tr key={idx} style={{ 
                          borderBottom: '1px solid rgba(19, 48, 78, 0.5)', 
                          transition: 'background 0.2s',
                          background: opt.inTheMoney ? 'rgba(0, 200, 83, 0.05)' : 'transparent'
                        }} className="table-row-hover">
                          <td style={{ padding: '10px 8px', fontWeight: 'bold', color: 'var(--primary-blue)' }}>${opt.strike}</td>
                          <td style={{ padding: '10px 8px', color: '#8b9eb3' }}>{opt.bid?.toFixed(2) || '-'}</td>
                          <td style={{ padding: '10px 8px', color: '#8b9eb3' }}>{opt.ask?.toFixed(2) || '-'}</td>
                          <td style={{ padding: '10px 8px', color: 'white', fontWeight: 'bold' }}>${opt.lastPrice?.toFixed(2) || '0.00'}</td>
                          <td style={{ padding: '10px 8px', color: '#8b9eb3' }}>{opt.volume || '0'}</td>
                          <td style={{ padding: '10px 8px', color: '#8b9eb3' }}>{opt.openInterest || '0'}</td>
                          <td style={{ padding: '10px 8px', color: '#e2a300' }}>{opt.impliedVolatility ? (opt.impliedVolatility * 100).toFixed(1) + '%' : '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PUTS TABLE */}
            <div className="glass card" style={{ borderRadius: '16px', overflow: 'hidden', padding: 0 }}>
              <div style={{ background: 'rgba(213, 0, 0, 0.1)', padding: '15px 20px', borderBottom: '1px solid rgba(213, 0, 0, 0.3)', display: 'flex', justifyContent: 'between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#d50000', fontWeight: 'bold' }}>عقود البيع (Puts 🔴)</h3>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: '600px', overflowY: 'auto', scrollbarWidth: 'thin' }} className="custom-ticker-scroll">
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.85rem' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--dark-navy)' }}>
                    <tr style={{ borderBottom: '1px solid var(--border-blue)' }}>
                      <th style={{ padding: '12px 8px' }}>Strike</th>
                      <th style={{ padding: '12px 8px' }}>Bid</th>
                      <th style={{ padding: '12px 8px' }}>Ask</th>
                      <th style={{ padding: '12px 8px' }}>Last</th>
                      <th style={{ padding: '12px 8px' }}>Vol</th>
                      <th style={{ padding: '12px 8px' }}>OI</th>
                      <th style={{ padding: '12px 8px' }}>IV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {puts.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ padding: '30px', color: '#8b9eb3' }}>لا توجد بيانات عقود بيع متوفرة.</td>
                      </tr>
                    ) : (
                      puts.map((opt, idx) => (
                        <tr key={idx} style={{ 
                          borderBottom: '1px solid rgba(19, 48, 78, 0.5)', 
                          transition: 'background 0.2s',
                          background: opt.inTheMoney ? 'rgba(213, 0, 0, 0.05)' : 'transparent'
                        }} className="table-row-hover">
                          <td style={{ padding: '10px 8px', fontWeight: 'bold', color: 'var(--primary-blue)' }}>${opt.strike}</td>
                          <td style={{ padding: '10px 8px', color: '#8b9eb3' }}>{opt.bid?.toFixed(2) || '-'}</td>
                          <td style={{ padding: '10px 8px', color: '#8b9eb3' }}>{opt.ask?.toFixed(2) || '-'}</td>
                          <td style={{ padding: '10px 8px', color: 'white', fontWeight: 'bold' }}>${opt.lastPrice?.toFixed(2) || '0.00'}</td>
                          <td style={{ padding: '10px 8px', color: '#8b9eb3' }}>{opt.volume || '0'}</td>
                          <td style={{ padding: '10px 8px', color: '#8b9eb3' }}>{opt.openInterest || '0'}</td>
                          <td style={{ padding: '10px 8px', color: '#e2a300' }}>{opt.impliedVolatility ? (opt.impliedVolatility * 100).toFixed(1) + '%' : '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}
      
      {/* Dynamic Keyframes inject in component */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.9; }
        }
        .mover-card-hover:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 30px rgba(0,0,0,0.35);
        }
        .table-row-hover:hover {
          background: rgba(0, 210, 255, 0.03) !important;
        }
        .suggestion-item-hover:hover {
          background: rgba(0, 210, 255, 0.1) !important;
          color: var(--primary-blue) !important;
        }
        @media (max-width: 768px) {
          .tables-layout {
            grid-template-columns: 1fr !important;
          }
        }
        .custom-ticker-scroll::-webkit-scrollbar {
          height: 6px;
        }
        .custom-ticker-scroll::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.02);
          border-radius: 10px;
        }
        .custom-ticker-scroll::-webkit-scrollbar-thumb {
          background: rgba(0, 210, 255, 0.3);
          border-radius: 10px;
        }
        .custom-ticker-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 210, 255, 0.5);
        }
      `}</style>
    </div>
  );
}

export default USOptions;
