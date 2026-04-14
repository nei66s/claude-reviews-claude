import { NextRequest, NextResponse } from 'next/server';

interface ExchangeRateResponse {
  rates: Record<string, number>;
  base: string;
  date: string;
}

interface GoogleExchangeData {
  conversion_rate: number;
  conversion_rate_ask: number;
  conversion_rate_bid: number;
  conversion_rates: Record<string, number>;
  time_last_updated_utc: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const targetCurrency = searchParams.get('to') || 'BRL';
    const sourceCurrency = searchParams.get('from') || 'USD';

    // Try multiple free APIs for exchange rates
    let exchangeData: any = null;
    let source = '';

    try {
      // Try ExchangeRate-API (free tier)
      const response1 = await fetch(
        `https://api.exchangerate-api.com/v4/latest/${sourceCurrency}`,
        { method: 'GET' }
      );
      
      if (response1.ok) {
        const data: ExchangeRateResponse = await response1.json();
        exchangeData = {
          rate: data.rates[targetCurrency],
          source: sourceCurrency,
          target: targetCurrency,
          timestamp: data.date,
        };
        source = 'exchangerate-api.com';
      }
    } catch (err) {
      console.log('ExchangeRate-API failed, trying alternative...');
    }

    // If first API fails, try Open Exchange Rates API
    if (!exchangeData) {
      try {
        const response2 = await fetch(
          `https://open-exchange-rates.github.io/flask-poc/?base=${sourceCurrency}&symbols=${targetCurrency}`,
          { method: 'GET' }
        );
        
        if (response2.ok) {
          const data: ExchangeRateResponse = await response2.json();
          exchangeData = {
            rate: data.rates[targetCurrency],
            source: sourceCurrency,
            target: targetCurrency,
            timestamp: data.date,
          };
          source = 'open-exchange-rates';
        }
      } catch (err) {
        console.log('Open Exchange Rates failed');
      }
    }

    if (!exchangeData) {
      return NextResponse.json(
        { 
          error: 'Unable to fetch exchange rates from available APIs',
          availableAPIs: ['exchangerate-api.com'],
          fallback: `Please visit https://www.google.com/search?q=cotacao+${sourceCurrency}+para+${targetCurrency}`
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      data: exchangeData,
      source,
      message: `1 ${sourceCurrency} = ${exchangeData.rate.toFixed(2)} ${targetCurrency}`,
    });
  } catch (error) {
    console.error('Currency API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST endpoint for manual currency conversion
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { from = 'USD', to = 'BRL' } = body;

    // Redirect to GET with parameters
    const url = new URL(request.url);
    url.pathname = '/api/currency';
    url.searchParams.set('from', from);
    url.searchParams.set('to', to);

    return GET(new NextRequest(url));
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
