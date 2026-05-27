from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import numpy as np
from datetime import datetime
try:
    from prophet import Prophet
    HAS_PROPHET = True
except ImportError:
    HAS_PROPHET = False

app = FastAPI(title="AMDOX AI Forecast Service")

class DataPoint(BaseModel):
    date: str
    quantity: float

class ForecastRequest(BaseModel):
    sku: str
    history: List[DataPoint]
    periods: int = 12

class ForecastResponse(BaseModel):
    sku: str
    forecasts: List[dict]
    trend: str
    seasonality: Optional[str]
    model_used: str

@app.post("/forecast", response_model=ForecastResponse)
async def generate_forecast(request: ForecastRequest):
    if len(request.history) < 2:
        raise HTTPException(status_code=400, detail="Insufficient history for forecasting (minimum 2 points)")
    
    # Convert history to DataFrame
    df = pd.DataFrame([{"ds": p.date, "y": p.quantity} for p in request.history])
    df['ds'] = pd.to_datetime(df['ds'])
    df = df.sort_values('ds')

    if HAS_PROPHET and len(df) >= 5:
        return run_prophet_forecast(df, request.sku, request.periods)
    else:
        return run_statistical_forecast(df, request.sku, request.periods)

def run_prophet_forecast(df: pd.DataFrame, sku: str, periods: int):
    try:
        m = Prophet(yearly_seasonality=True, daily_seasonality=False, weekly_seasonality=True)
        m.fit(df)
        
        future = m.make_future_dataframe(periods=periods, freq='MS')
        forecast = m.predict(future)
        
        # Extract the forecast portion (exclude the history)
        results = forecast.iloc[-periods:]
        
        forecast_list = []
        for _, row in results.iterrows():
            forecast_list.append({
                "period": row['ds'].strftime('%Y-%m'),
                "predicted": round(float(row['yhat']), 2),
                "confidence": {
                    "lower": round(float(row['yhat_lower']), 2),
                    "upper": round(float(row['yhat_upper']), 2)
                }
            })
            
        # Determine trend
        slope = (forecast['yhat'].iloc[-1] - forecast['yhat'].iloc[0]) / len(forecast)
        trend = "increasing" if slope > 0.05 else "decreasing" if slope < -0.05 else "stable"
        
        return {
            "sku": sku,
            "forecasts": forecast_list,
            "trend": trend,
            "seasonality": "Detected seasonal patterns (Prophet)",
            "model_used": "Prophet-v1"
        }
    except Exception as e:
        print(f"Prophet failure, falling back: {e}")
        return run_statistical_forecast(df, sku, periods)

def run_statistical_forecast(df: pd.DataFrame, sku: str, periods: int):
    # Sophisticated statistical model with Seasonality detection
    y = df['y'].values
    n = len(df)
    x = np.arange(n)
    
    # Calculate trend using polyfit
    z = np.polyfit(x, y, 1)
    slope = z[0]
    intercept = z[1]
    
    # Calculate Seasonality factors (Monthly)
    df['month'] = df['ds'].dt.month
    monthly_avg = df.groupby('month')['y'].mean()
    overall_avg = df['y'].mean()
    seasonality_factors = (monthly_avg / overall_avg).to_dict()

    forecast_list = []
    last_date = df['ds'].iloc[-1]
    std_dev = np.std(y) if len(y) > 1 else overall_avg * 0.1
    
    for i in range(1, periods + 1):
        future_date = last_date + pd.DateOffset(months=i)
        # Linear trend + Seasonal adjustment
        base_pred = slope * (n + i) + intercept
        seasonal_factor = seasonality_factors.get(future_date.month, 1.0)
        predicted = max(0, base_pred * seasonal_factor)

        forecast_list.append({
            "period": future_date.strftime('%Y-%m'),
            "predicted": round(float(predicted), 2),
            "confidence": {
                "lower": round(float(predicted - 1.96 * std_dev), 2),
                "upper": round(float(predicted + 1.96 * std_dev), 2)
            }
        })

    trend = "increasing" if slope > 0.05 else "decreasing" if slope < -0.05 else "stable"
    
    return {
        "sku": sku,
        "forecasts": forecast_list,
        "trend": trend,
        "seasonality": "Calculated monthly weights",
        "model_used": "Stats-Seasonal-v1"
    }

@app.get("/health")
def health():
    return {
        "status": "healthy", 
        "engine": "Prophet" if HAS_PROPHET else "Statistical-Fallback",
        "version": "1.2.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
