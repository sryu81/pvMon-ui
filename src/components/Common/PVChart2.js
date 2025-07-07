import React, { useState, useEffect, useRef, useMemo } from 'react';
import historyService from '../../services/historyService';
import './PVChart.css';

function PVChart({ selectedPVs, pvData, isVisible, systemName }) {
  const canvasRef = useRef(null);
  const [timeRange, setTimeRange] = useState(300); // 5 minutes in seconds
  const [autoScale, setAutoScale] = useState(true);
  const [yMin, setYMin] = useState(0);
  const [yMax, setYMax] = useState(100);
  const [showGrid, setShowGrid] = useState(true);
  const [lineWidth, setLineWidth] = useState(2);
  const [dataHistory, setDataHistory] = useState(new Map());
  const [historicalData, setHistoricalData] = useState(new Map());
  const [showHistorical, setShowHistorical] = useState(true);
  const [aggregation, setAggregation] = useState('mean');
  const [loading, setLoading] = useState(false);

  // Color palette for different PVs
  const colors = useMemo(() => [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
    '#1abc9c', '#e67e22', '#34495e', '#e91e63', '#00bcd4'
  ], []);

  // Load historical data when selectedPVs or timeRange changes
  useEffect(() => {
    if (!selectedPVs || selectedPVs.size === 0 || !showHistorical) {
      setHistoricalData(new Map());
      return;
    }

    const loadHistoricalData = async () => {
      setLoading(true);
      try {
        const pvNamesArray = Array.from(selectedPVs);
        const timeRangeStr = `${timeRange}s`;
        const interval = timeRange > 3600 ? '1m' : '10s'; // Adjust interval based on time range
        
        const history = await historyService.getMultiplePVHistory(
          pvNamesArray, 
          timeRangeStr, 
          aggregation, 
          interval
        );
        
        const historyMap = new Map();
        Object.entries(history).forEach(([pvName, points]) => {
          historyMap.set(pvName, points.map(point => ({
            timestamp: new Date(point.time).getTime(),
            value: point.value,
            isHistorical: true
          })));
        });
        
        setHistoricalData(historyMap);
      } catch (error) {
        console.error('Error loading historical data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHistoricalData();
  }, [selectedPVs, timeRange, showHistorical, aggregation]);

  // Update real-time data history
  useEffect(() => {
    if (!selectedPVs || selectedPVs.size === 0) return;

    const now = Date.now();
    const cutoffTime = now - (timeRange * 1000);

    setDataHistory(prev => {
      const newHistory = new Map(prev);

      selectedPVs.forEach(pvName => {
        const data = pvData[pvName];
        if (data && data.connectionStatus === 'CONNECTED' && data.value !== null && data.value !== undefined) {
          if (!newHistory.has(pvName)) {
            newHistory.set(pvName, []);
          }

          const pvHistory = newHistory.get(pvName);
          const numericValue = parseFloat(data.value);
          
          if (!isNaN(numericValue)) {
            pvHistory.push({
              timestamp: data.timestamp || now,
              value: numericValue,
              isHistorical: false
            });

            const filteredHistory = pvHistory.filter(point => point.timestamp >= cutoffTime);
            newHistory.set(pvName, filteredHistory);
          }
        }
      });

      const currentPVs = new Set(selectedPVs);
      for (const pvName of newHistory.keys()) {
        if (!currentPVs.has(pvName)) {
          newHistory.delete(pvName);
        }
      }

      return newHistory;
    });
  }, [pvData, selectedPVs, timeRange]);

  // Combine historical and real-time data
  const combinedData = useMemo(() => {
    const combined = new Map();
    
    // Add historical data first
    if (showHistorical) {
      historicalData.forEach((points, pvName) => {
        combined.set(pvName, [...points]);
      });
    }
    
    // Add real-time data
    dataHistory.forEach((points, pvName) => {
      if (combined.has(pvName)) {
        const existing = combined.get(pvName);
        const lastHistoricalTime = existing.length > 0 ? 
          Math.max(...existing.map(p => p.timestamp)) : 0;
        
        // Only add real-time points that are newer than historical data
        const newPoints = points.filter(p => p.timestamp > lastHistoricalTime);
        combined.set(pvName, [...existing, ...newPoints]);
      } else {
        combined.set(pvName, [...points]);
      }
    });
    
    return combined;
  }, [historicalData, dataHistory, showHistorical]);

  // Calculate auto-scale values
  const { calculatedYMin, calculatedYMax } = useMemo(() => {
    if (!autoScale || combinedData.size === 0) {
      return { calculatedYMin: yMin, calculatedYMax: yMax };
    }

    let min = Infinity;
    let max = -Infinity;

    for (const history of combinedData.values()) {
      for (const point of history) {
        min = Math.min(min, point.value);
        max = Math.max(max, point.value);
      }
    }

    if (min === Infinity || max === -Infinity) {
      return { calculatedYMin: 0, calculatedYMax: 100 };
    }

    const padding = (max - min) * 0.1;
    return {
      calculatedYMin: min - padding,
      calculatedYMax: max + padding
    };
  }, [combinedData, autoScale, yMin, yMax]);

  // Draw the chart
  useEffect(() => {
    if (!isVisible || !canvasRef.current || combinedData.size === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 120, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const now = Date.now();
    const startTime = now - (timeRange * 1000);
    const endTime = now;

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;

      const timeSteps = 5;
      for (let i = 0; i <= timeSteps; i++) {
        const x = padding.left + (chartWidth * i / timeSteps);
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + chartHeight);
        ctx.stroke();
      }

      const valueSteps = 5;
      for (let i = 0; i <= valueSteps; i++) {
        const y = padding.top + (chartHeight * i / valueSteps);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();
      }
    }

    // Draw axes
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
    ctx.stroke();

    // Draw Y-axis labels
    ctx.fillStyle = '#666666';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    const valueSteps = 5;
    for (let i = 0; i <= valueSteps; i++) {
      const value = calculatedYMin + ((calculatedYMax - calculatedYMin) * (valueSteps - i) / valueSteps);
      const y = padding.top + (chartHeight * i / valueSteps);
      ctx.fillText(value.toFixed(2), padding.left - 10, y + 4);
    }

    // Draw X-axis labels
    ctx.textAlign = 'center';
    const timeSteps = 5;
    for (let i = 0; i <= timeSteps; i++) {
      const time = startTime + ((endTime - startTime) * i / timeSteps);
      const x = padding.left + (chartWidth * i / timeSteps);
      const timeStr = new Date(time).toLocaleTimeString();
      ctx.fillText(timeStr, x, padding.top + chartHeight + 20);
    }

    // Draw data lines
    let colorIndex = 0;
    for (const [pvName, history] of combinedData.entries()) {
      if (history.length < 2) continue;

      const color = colors[colorIndex % colors.length];
      
      // Draw historical data with dashed line
      const historicalPoints = history.filter(p => p.isHistorical);
      const realtimePoints = history.filter(p => !p.isHistorical);
      
      // Historical data (dashed line)
      if (historicalPoints.length > 1 && showHistorical) {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();

        let firstPoint = true;
        for (const point of historicalPoints) {
          const x = padding.left + ((point.timestamp - startTime) / (endTime - startTime)) * chartWidth;
          const y = padding.top + ((calculatedYMax - point.value) / (calculatedYMax - calculatedYMin)) * chartHeight;

          if (firstPoint) {
            ctx.moveTo(x, y);
            firstPoint = false;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }
// Real-time data (solid line)
      if (realtimePoints.length > 1) {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.setLineDash([]); // Solid line
        ctx.beginPath();

        let firstPoint = true;
        for (const point of realtimePoints) {
          const x = padding.left + ((point.timestamp - startTime) / (endTime - startTime)) * chartWidth;
          const y = padding.top + ((calculatedYMax - point.value) / (calculatedYMax - calculatedYMin)) * chartHeight;

          if (firstPoint) {
            ctx.moveTo(x, y);
            firstPoint = false;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      // Draw legend
      const legendY = padding.top + (colorIndex * 25);
      ctx.fillStyle = color;
      ctx.fillRect(padding.left + chartWidth + 10, legendY - 6, 12, 12);
      
      // Legend text
      ctx.fillStyle = '#333333';
      ctx.font = '11px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(pvName, padding.left + chartWidth + 30, legendY + 4);
      
      // Show current value
      const latestPoint = history[history.length - 1];
      if (latestPoint) {
        ctx.font = '10px Arial';
        ctx.fillStyle = '#666666';
        ctx.fillText(`${latestPoint.value.toFixed(2)}`, padding.left + chartWidth + 30, legendY + 16);
      }

      colorIndex++;
    }

    // Draw title with system name and data source info
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    const title = systemName ? `Real-time PV Monitoring - ${systemName}` : 'Real-time PV Monitoring';
    ctx.fillText(title, width / 2, 20);

    // Draw data source legend
    if (showHistorical) {
      ctx.font = '10px Arial';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#666666';
      
      // Historical data legend
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = '#666666';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, height - 25);
      ctx.lineTo(30, height - 25);
      ctx.stroke();
      ctx.fillText('Historical', 35, height - 20);
      
      // Real-time data legend
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(10, height - 10);
      ctx.lineTo(30, height - 10);
      ctx.stroke();
      ctx.fillText('Real-time', 35, height - 5);
    }

  }, [combinedData, timeRange, calculatedYMin, calculatedYMax, showGrid, lineWidth, isVisible, colors, systemName, showHistorical]);

  const handleTimeRangeChange = (newRange) => {
    setTimeRange(newRange);
    setDataHistory(new Map());
  };

  const handleRefreshHistorical = () => {
    if (selectedPVs && selectedPVs.size > 0) {
      setHistoricalData(new Map());
      // This will trigger the useEffect to reload historical data
    }
  };

  if (!isVisible || !selectedPVs || selectedPVs.size === 0) {
    return (
      <div className="pv-chart-container">
        <div className="no-selection">
          <h3>Real-time PV Monitoring with Historical Data</h3>
          <p>Select one or more PVs from the table above to view their real-time and historical data.</p>
          <p className="persistence-note">📌 Your selections are automatically saved and will persist across tab switches.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pv-chart-container">
      <div className="chart-controls">
        <div className="control-group">
          <label>Time Range:</label>
          <select 
            value={timeRange} 
            onChange={(e) => handleTimeRangeChange(parseInt(e.target.value))}
          >
            <option value={300}>5 minutes</option>
            <option value={600}>10 minutes</option>
            <option value={1800}>30 minutes</option>
            <option value={3600}>1 hour</option>
            <option value={7200}>2 hours</option>
            <option value={21600}>6 hours</option>
            <option value={86400}>24 hours</option>
          </select>
        </div>

        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={showHistorical}
              onChange={(e) => setShowHistorical(e.target.checked)}
            />
            Show Historical Data
          </label>
        </div>

        {showHistorical && (
          <div className="control-group">
            <label>Aggregation:</label>
            <select 
              value={aggregation} 
              onChange={(e) => setAggregation(e.target.value)}
            >
              <option value="mean">Average</option>
              <option value="max">Maximum</option>
              <option value="min">Minimum</option>
              <option value="last">Last Value</option>
            </select>
          </div>
        )}

        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={autoScale}
              onChange={(e) => setAutoScale(e.target.checked)}
            />
            Auto Scale Y-axis
          </label>
        </div>

        {!autoScale && (
          <>
            <div className="control-group">
              <label>Y Min:</label>
              <input
                type="number"
                value={yMin}
                onChange={(e) => setYMin(parseFloat(e.target.value) || 0)}
                step="0.1"
              />
            </div>
            <div className="control-group">
              <label>Y Max:</label>
              <input
                type="number"
                value={yMax}
                onChange={(e) => setYMax(parseFloat(e.target.value) || 100)}
                step="0.1"
              />
            </div>
          </>
        )}

        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
            />
            Show Grid
          </label>
        </div>

        <div className="control-group">
          <label>Line Width:</label>
          <input
            type="range"
            min="1"
            max="5"
            value={lineWidth}
            onChange={(e) => setLineWidth(parseInt(e.target.value))}
          />
          <span>{lineWidth}px</span>
        </div>

        <div className="control-group">
          <button 
            onClick={() => setDataHistory(new Map())}
            className="clear-data-btn"
          >
            Clear Real-time Data
          </button>
        </div>

        {showHistorical && (
          <div className="control-group">
            <button 
              onClick={handleRefreshHistorical}
              className="refresh-btn"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Refresh Historical'}
            </button>
          </div>
        )}
      </div>

      <div className="chart-area">
        <canvas 
          ref={canvasRef}
          className="pv-chart-canvas"
        />
      </div>

      <div className="chart-info">
        <p>📊 Monitoring {selectedPVs.size} PV{selectedPVs.size !== 1 ? 's' : ''} (persistent selection)</p>
        <p>Real-time points: {Array.from(dataHistory.values()).reduce((sum, history) => sum + history.length, 0)}</p>
        {showHistorical && (
          <p>Historical points: {Array.from(historicalData.values()).reduce((sum, history) => sum + history.length, 0)}</p>
        )}
        {systemName && <p>System: {systemName}</p>}
        {loading && <p className="loading-indicator">⏳ Loading historical data...</p>}
      </div>
    </div>
  );
}

export default PVChart;