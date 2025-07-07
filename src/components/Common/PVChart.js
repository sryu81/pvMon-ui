import React, { useState, useEffect, useRef, useMemo } from 'react';
import './PVChart.css';

function PVChart({ selectedPVs, pvData, isVisible }) {
  const canvasRef = useRef(null);
  const [timeRange, setTimeRange] = useState(300); // 5 minutes in seconds
  const [autoScale, setAutoScale] = useState(true);
  const [yMin, setYMin] = useState(0);
  const [yMax, setYMax] = useState(100);
  const [showGrid, setShowGrid] = useState(true);
  const [lineWidth, setLineWidth] = useState(2);
  const [dataHistory, setDataHistory] = useState(new Map());

  // Color palette for different PVs - wrapped in useMemo to prevent re-creation
  const colors = useMemo(() => [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
    '#1abc9c', '#e67e22', '#34495e', '#e91e63', '#00bcd4'
  ], []);

  // Update data history when pvData changes
  // In PVChart.js, update the data connection check:
  useEffect(() => {
    if (!selectedPVs || selectedPVs.size === 0) return;

    const now = Date.now();
    const cutoffTime = now - (timeRange * 1000);

    setDataHistory(prev => {
      const newHistory = new Map(prev);

      // Add new data points for each selected PV
      selectedPVs.forEach(pvName => {
        const data = pvData[pvName];
        // Updated connection check to match your API format
        if (data && data.connectionStatus === 'CONNECTED' && data.value !== null && data.value !== undefined) {
          if (!newHistory.has(pvName)) {
            newHistory.set(pvName, []);
          }

          const pvHistory = newHistory.get(pvName);
          const numericValue = parseFloat(data.value);
          
          if (!isNaN(numericValue)) {
            // Add new data point
            pvHistory.push({
              timestamp: data.timestamp || now,
              value: numericValue,
              formattedValue: data.formattedValue || String(data.value),
              units: data.units || ''
            });

            // Remove old data points
            const filteredHistory = pvHistory.filter(point => point.timestamp >= cutoffTime);
            newHistory.set(pvName, filteredHistory);
          }
        }
      });

      // Remove PVs that are no longer selected
      const currentPVs = new Set(selectedPVs);
      for (const pvName of newHistory.keys()) {
        if (!currentPVs.has(pvName)) {
          newHistory.delete(pvName);
        }
      }

      return newHistory;
    });
  }, [pvData, selectedPVs, timeRange]);

  // Calculate auto-scale values
  const { calculatedYMin, calculatedYMax } = useMemo(() => {
    if (!autoScale || dataHistory.size === 0) {
      return { calculatedYMin: yMin, calculatedYMax: yMax };
    }

    let min = Infinity;
    let max = -Infinity;

    for (const history of dataHistory.values()) {
      for (const point of history) {
        min = Math.min(min, point.value);
        max = Math.max(max, point.value);
      }
    }

    if (min === Infinity || max === -Infinity) {
      return { calculatedYMin: 0, calculatedYMax: 100 };
    }

    // Add 10% padding
    const padding = (max - min) * 0.1;
    return {
      calculatedYMin: min - padding,
      calculatedYMax: max + padding
    };
  }, [dataHistory, autoScale, yMin, yMax]);

  // Draw the chart
  useEffect(() => {
    if (!isVisible || !canvasRef.current || dataHistory.size === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    // Set canvas size
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 100, bottom: 40, left: 60 };
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

      // Vertical grid lines (time)
      const timeSteps = 5;
      for (let i = 0; i <= timeSteps; i++) {
        const x = padding.left + (chartWidth * i / timeSteps);
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + chartHeight);
        ctx.stroke();
      }

      // Horizontal grid lines (values)
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
    // Y-axis
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    // X-axis
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

    // Draw X-axis labels (time)
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
    for (const [pvName, history] of dataHistory.entries()) {
      if (history.length < 2) continue;

      const color = colors[colorIndex % colors.length];
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();

      let firstPoint = true;
      for (const point of history) {
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

      // Draw legend
      const legendY = padding.top + (colorIndex * 20);
      ctx.fillStyle = color;
      ctx.fillRect(padding.left + chartWidth + 10, legendY - 6, 12, 12);
      ctx.fillStyle = '#333333';
      ctx.font = '12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(pvName, padding.left + chartWidth + 30, legendY + 4);

      colorIndex++;
    }

    // Draw title
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Real-time PV Monitoring', width / 2, 20);

  }, [dataHistory, timeRange, calculatedYMin, calculatedYMax, showGrid, lineWidth, isVisible, colors]);

  const handleTimeRangeChange = (newRange) => {
    setTimeRange(newRange);
    // Clear history to start fresh with new time range
    setDataHistory(new Map());
  };

  if (!isVisible || !selectedPVs || selectedPVs.size === 0) {
    return (
      <div className="pv-chart-container">
        <div className="no-selection">
          <h3>Real-time PV Monitoring</h3>
          <p>Select one or more PVs from the table above to view their real-time data.</p>
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
            <option value={60}>1 minute</option>
            <option value={300}>5 minutes</option>
            <option value={600}>10 minutes</option>
            <option value={1800}>30 minutes</option>
            <option value={3600}>1 hour</option>
          </select>
        </div>

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
            Clear Data
          </button>
        </div>
      </div>

      <div className="chart-area">
        <canvas 
          ref={canvasRef}
          className="pv-chart-canvas"
        />
      </div>

      <div className="chart-info">
        <p>Monitoring {selectedPVs.size} PV{selectedPVs.size !== 1 ? 's' : ''}</p>
        <p>Data points: {Array.from(dataHistory.values()).reduce((sum, history) => sum + history.length, 0)}</p>
      </div>
    </div>
  );
}

export default PVChart;