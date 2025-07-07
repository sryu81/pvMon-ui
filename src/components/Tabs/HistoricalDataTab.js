import React, { useState, useEffect } from 'react';
import historyService from '../../services/historyService';
import './HistoricalDataTab.css';

function HistoricalDataTab({ systems }) {
  const [selectedSystem, setSelectedSystem] = useState('');
  const [selectedPVs, setSelectedPVs] = useState([]);
  const [timeRange, setTimeRange] = useState('24h');
  const [aggregation, setAggregation] = useState('mean');
  const [interval, setInterval] = useState('1h');
  const [historicalData, setHistoricalData] = useState({});
  const [alarmHistory, setAlarmHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('trends');

  // Get available PVs for selected system
  const availablePVs = selectedSystem && systems ? 
    (systems.find(s => s.id === selectedSystem)?.pvs || []) : [];

  const loadHistoricalData = async () => {
    if (selectedPVs.length === 0) return;

    setLoading(true);
    try {
      const data = await historyService.getMultiplePVHistory(
        selectedPVs, 
        timeRange, 
        aggregation, 
        interval
      );
      setHistoricalData(data);
    } catch (error) {
      console.error('Error loading historical data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAlarmHistory = async () => {
    setLoading(true);
    try {
      const alarms = await historyService.getAlarmHistory(timeRange);
      setAlarmHistory(alarms);
    } catch (error) {
      console.error('Error loading alarm history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'trends') {
      loadHistoricalData();
    } else if (activeTab === 'alarms') {
      loadAlarmHistory();
    }
  }, [selectedPVs, timeRange, aggregation, interval, activeTab]);

  const handlePVToggle = (pvName) => {
    setSelectedPVs(prev => 
      prev.includes(pvName) 
        ? prev.filter(pv => pv !== pvName)
        : [...prev, pvName]
    );
  };

  const exportData = () => {
    const dataToExport = {
      timestamp: new Date().toISOString(),
      timeRange,
      aggregation,
      interval,
      data: historicalData
    };
    
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `epics-historical-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="historical-data-tab">
      <div className="historical-header">
        <h2>Historical Data Analysis</h2>
        <div className="tab-selector">
          <button 
            className={activeTab === 'trends' ? 'active' : ''}
            onClick={() => setActiveTab('trends')}
          >
            Trend Analysis
          </button>
          <button 
            className={activeTab === 'alarms' ? 'active' : ''}
            onClick={() => setActiveTab('alarms')}
          >
            Alarm History
          </button>
        </div>
      </div>

      <div className="historical-controls">
        <div className="control-row">
          <div className="control-group">
            <label>System:</label>
            <select 
              value={selectedSystem} 
              onChange={(e) => {
                setSelectedSystem(e.target.value);
                setSelectedPVs([]);
              }}
            >
              <option value="">Select System</option>
              {systems?.map(system => (
                <option key={system.id} value={system.id}>
                  {system.name}
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label>Time Range:</label>
            <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
              <option value="1h">Last Hour</option>
              <option value="6h">Last 6 Hours</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>

          {activeTab === 'trends' && (
            <>
              <div className="control-group">
                <label>Aggregation:</label>
                <select value={aggregation} onChange={(e) => setAggregation(e.target.value)}>
                  <option value="mean">Average</option>
                  <option value="max">Maximum</option>
                  <option value="min">Minimum</option>
                  <option value="last">Last Value</option>
                </select>
              </div>

              <div className="control-group">
                <label>Interval:</label>
                <select value={interval} onChange={(e) => setInterval(e.target.value)}>
                  <option value="1m">1 Minute</option>
                  <option value="5m">5 Minutes</option>
                  <option value="15m">15 Minutes</option>
                  <option value="1h">1 Hour</option>
                  <option value="6h">6 Hours</option>
                  <option value="1d">1 Day</option>
                </select>
              </div>
            </>
          )}

          <div className="control-group">
            <button 
              onClick={activeTab === 'trends' ? loadHistoricalData : loadAlarmHistory}
              disabled={loading || (activeTab === 'trends' && selectedPVs.length === 0)}
              className="load-btn"
            >
              {loading ? 'Loading...' : 'Load Data'}
            </button>
          </div>

          {activeTab === 'trends' && Object.keys(historicalData).length > 0 && (
            <div className="control-group">
              <button onClick={exportData} className="export-btn">
                Export Data
              </button>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'trends' && (
        <div className="trends-section">
          {selectedSystem && (
            <div className="pv-selector">
              <h3>Select PVs to Analyze:</h3>
              <div className="pv-grid">
                {availablePVs.map(pvName => (
                  <label key={pvName} className="pv-checkbox">
<input
                      type="checkbox"
                      checked={selectedPVs.includes(pvName)}
                      onChange={() => handlePVToggle(pvName)}
                    />
                    <span className="pv-name">{pvName}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {Object.keys(historicalData).length > 0 && (
            <div className="data-summary">
              <h3>Data Summary</h3>
              <div className="summary-grid">
                {Object.entries(historicalData).map(([pvName, points]) => {
                  const values = points.map(p => p.value);
                  const avg = values.reduce((a, b) => a + b, 0) / values.length;
                  const min = Math.min(...values);
                  const max = Math.max(...values);
                  
                  return (
                    <div key={pvName} className="summary-card">
                      <h4>{pvName}</h4>
                      <div className="stats">
                        <div className="stat">
                          <span className="label">Average:</span>
                          <span className="value">{avg.toFixed(2)}</span>
                        </div>
                        <div className="stat">
                          <span className="label">Min:</span>
                          <span className="value">{min.toFixed(2)}</span>
                        </div>
                        <div className="stat">
                          <span className="label">Max:</span>
                          <span className="value">{max.toFixed(2)}</span>
                        </div>
                        <div className="stat">
                          <span className="label">Points:</span>
                          <span className="value">{points.length}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {Object.keys(historicalData).length > 0 && (
            <div className="data-table">
              <h3>Historical Data Table</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      {Object.keys(historicalData).map(pvName => (
                        <th key={pvName}>{pvName}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Create rows by timestamp */}
                    {(() => {
                      const allTimestamps = new Set();
                      Object.values(historicalData).forEach(points => {
                        points.forEach(point => {
                          allTimestamps.add(point.time);
                        });
                      });
                      
                      return Array.from(allTimestamps)
                        .sort()
                        .slice(0, 100) // Limit to first 100 rows
                        .map(timestamp => (
                          <tr key={timestamp}>
                            <td>{new Date(timestamp).toLocaleString()}</td>
                            {Object.keys(historicalData).map(pvName => {
                              const point = historicalData[pvName].find(p => p.time === timestamp);
                              return (
                                <td key={pvName}>
                                  {point ? point.value.toFixed(2) : '-'}
                                </td>
                              );
                            })}
                          </tr>
                        ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'alarms' && (
        <div className="alarms-section">
          <div className="alarm-summary">
            <h3>Alarm Summary</h3>
            <div className="alarm-stats">
              <div className="alarm-stat">
                <span className="count">{alarmHistory.length}</span>
                <span className="label">Total Alarms</span>
              </div>
              <div className="alarm-stat">
                <span className="count">
                  {alarmHistory.filter(a => a.alarmSeverity?.includes('MAJOR')).length}
                </span>
                <span className="label">Major Alarms</span>
              </div>
              <div className="alarm-stat">
                <span className="count">
                  {alarmHistory.filter(a => a.alarmSeverity?.includes('MINOR')).length}
                </span>
                <span className="label">Minor Alarms</span>
              </div>
              <div className="alarm-stat">
                <span className="count">
                  {new Set(alarmHistory.map(a => a.pvName)).size}
                </span>
                <span className="label">Affected PVs</span>
              </div>
            </div>
          </div>

          {alarmHistory.length > 0 && (
            <div className="alarm-table">
              <h3>Alarm Events</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>PV Name</th>
                      <th>System</th>
                      <th>Severity</th>
                      <th>Connection Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alarmHistory
                      .sort((a, b) => new Date(b.time) - new Date(a.time))
                      .slice(0, 200) // Limit to 200 most recent alarms
                      .map((alarm, index) => (
                        <tr key={index} className={`alarm-row ${alarm.alarmSeverity?.toLowerCase()}`}>
                          <td>{new Date(alarm.time).toLocaleString()}</td>
                          <td className="pv-name">{alarm.pvName}</td>
                          <td>{alarm.system}</td>
                          <td>
                            <span className={`severity-badge ${alarm.alarmSeverity?.toLowerCase()}`}>
                              {alarm.alarmSeverity}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge ${alarm.connectionStatus?.toLowerCase()}`}>
                              {alarm.connectionStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading historical data...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default HistoricalDataTab;