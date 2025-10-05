import React, { useState, useEffect } from 'react';
import { TrendingUp, Calendar, ExternalLink, RefreshCw, Brain } from 'lucide-react';

interface Token {
  token_id: string;
  outcome: string;
  price: number;
  winner: boolean;
}

interface Market {
  id: number;
  condition_id: string;
  question: string;
  description: string | null;
  market_slug: string | null;
  end_date_iso: string | null;
  active: boolean;
  closed: boolean;
  tokens: Token[];
  tags: string[];
  fetched_at: string;
}

export default function Polymarket() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    loadMarkets();
  }, []);

  const loadMarkets = async () => {
    try {
      const response = await fetch('/api/polymarket/markets?active_only=true&limit=20');
      if (!response.ok) {
        console.error('Failed to fetch markets:', response.status);
        setMarkets([]);
        return;
      }
      const data = await response.json();
      setMarkets(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load markets:', error);
      setMarkets([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchNewMarkets = async () => {
    setFetching(true);
    try {
      const response = await fetch('/api/polymarket/fetch?limit=20', {
        method: 'POST'
      });
      const result = await response.json();
      if (result.success) {
        await loadMarkets();
        alert(`✓ Fetched ${result.total_processed} markets`);
      }
    } catch (error) {
      console.error('Failed to fetch markets:', error);
      alert('Failed to fetch markets from Polymarket');
    } finally {
      setFetching(false);
    }
  };

  const analyzeMarket = async (conditionId: string) => {
    setAnalyzing(conditionId);
    try {
      const response = await fetch('/api/polymarket/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ condition_id: conditionId })
      });
      const result = await response.json();
      if (result.success) {
        setAnalysis(prev => ({ ...prev, [conditionId]: result.analysis }));
      }
    } catch (error) {
      console.error('Failed to analyze market:', error);
    } finally {
      setAnalyzing(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getOutcomeColor = (price: number) => {
    if (price > 0.7) return '#22c55e'; // green
    if (price > 0.5) return '#3b82f6'; // blue
    if (price > 0.3) return '#f59e0b'; // orange
    return '#ef4444'; // red
  };

  if (loading) {
    return (
      <div className="polymarket-container">
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
          Loading markets...
        </div>
      </div>
    );
  }

  return (
    <div className="polymarket-container">
      <div className="polymarket-header">
        <div>
          <h2>
            <TrendingUp size={24} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Polymarket Prediction Markets
          </h2>
          <p style={{ color: '#888', margin: '8px 0 0 0' }}>
            Real-time prediction market data and AI analysis
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={fetchNewMarkets}
          disabled={fetching}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={16} className={fetching ? 'spinning' : ''} />
          {fetching ? 'Fetching...' : 'Refresh Markets'}
        </button>
      </div>

      {markets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
          <p>No markets loaded yet.</p>
          <button className="btn-primary" onClick={fetchNewMarkets} style={{ marginTop: '16px' }}>
            Fetch Markets from Polymarket
          </button>
        </div>
      ) : (
        <div className="markets-grid">
          {markets.map(market => (
            <div key={market.condition_id} className="market-card">
              <div className="market-card-header">
                <h3>{market.question}</h3>
                {market.market_slug && (
                  <a
                    href={`https://polymarket.com/event/${market.market_slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="market-link"
                    title="View on Polymarket"
                  >
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>

              {market.description && (
                <p className="market-description">{market.description}</p>
              )}

              <div className="market-outcomes">
                {market.tokens.map(token => (
                  <div key={token.token_id} className="outcome-row">
                    <span className="outcome-name">{token.outcome}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="outcome-bar-container">
                        <div
                          className="outcome-bar"
                          style={{
                            width: `${token.price * 100}%`,
                            backgroundColor: getOutcomeColor(token.price)
                          }}
                        />
                      </div>
                      <span
                        className="outcome-price"
                        style={{ color: getOutcomeColor(token.price) }}
                      >
                        {(token.price * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="market-footer">
                <div className="market-meta">
                  <Calendar size={14} />
                  <span>Ends: {formatDate(market.end_date_iso)}</span>
                </div>
                <button
                  className="btn-analyze"
                  onClick={() => analyzeMarket(market.condition_id)}
                  disabled={analyzing === market.condition_id}
                >
                  <Brain size={14} />
                  {analyzing === market.condition_id ? 'Analyzing...' : 'Analyze'}
                </button>
              </div>

              {analysis[market.condition_id] && (
                <div className="market-analysis">
                  <h4>AI Analysis</h4>
                  <pre>{analysis[market.condition_id]}</pre>
                </div>
              )}

              {market.tags && market.tags.length > 0 && (
                <div className="market-tags">
                  {market.tags.filter(tag => tag !== 'All').map(tag => (
                    <span key={tag} className="market-tag">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`
        .polymarket-container {
          padding: 20px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .polymarket-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid #333;
        }

        .polymarket-header h2 {
          margin: 0;
          display: flex;
          align-items: center;
        }

        .markets-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
          gap: 20px;
        }

        .market-card {
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 20px;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .market-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .market-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 12px;
        }

        .market-card-header h3 {
          margin: 0;
          font-size: 16px;
          line-height: 1.4;
          flex: 1;
        }

        .market-link {
          color: #3b82f6;
          text-decoration: none;
          opacity: 0.7;
          transition: opacity 0.2s;
          flex-shrink: 0;
        }

        .market-link:hover {
          opacity: 1;
        }

        .market-description {
          color: #888;
          font-size: 13px;
          line-height: 1.5;
          margin: 0 0 16px 0;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .market-outcomes {
          margin: 16px 0;
        }

        .outcome-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 8px 0;
        }

        .outcome-name {
          font-weight: 500;
          min-width: 80px;
        }

        .outcome-bar-container {
          flex: 1;
          height: 24px;
          background: #0a0a0a;
          border-radius: 4px;
          overflow: hidden;
        }

        .outcome-bar {
          height: 100%;
          transition: width 0.3s ease;
          border-radius: 4px;
        }

        .outcome-price {
          font-weight: 600;
          min-width: 50px;
          text-align: right;
        }

        .market-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #2a2a2a;
        }

        .market-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #888;
          font-size: 13px;
        }

        .btn-analyze {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: #2a2a2a;
          border: 1px solid #444;
          border-radius: 4px;
          color: #fff;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-analyze:hover:not(:disabled) {
          background: #333;
          border-color: #555;
        }

        .btn-analyze:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .market-analysis {
          margin-top: 16px;
          padding: 12px;
          background: #0a0a0a;
          border: 1px solid #333;
          border-radius: 4px;
        }

        .market-analysis h4 {
          margin: 0 0 8px 0;
          font-size: 14px;
          color: #3b82f6;
        }

        .market-analysis pre {
          margin: 0;
          white-space: pre-wrap;
          font-size: 12px;
          line-height: 1.5;
          color: #ccc;
        }

        .market-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 12px;
        }

        .market-tag {
          padding: 4px 8px;
          background: #2a2a2a;
          border: 1px solid #444;
          border-radius: 4px;
          font-size: 11px;
          color: #888;
        }

        .spinning {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .markets-grid {
            grid-template-columns: 1fr;
          }

          .polymarket-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }
        }
      `}</style>
    </div>
  );
}
