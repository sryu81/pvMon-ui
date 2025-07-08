import React, { useState, useCallback, useMemo, useEffect } from 'react';
import PVChart from '../Common/PVChart';
import './SystemViewTab.css';

const STORAGE_KEY = 'epics-pv-selections';
const API_BASE_URL = process.env.REACT_APP_EPICS_API_URL || 'http://localhost:8080/api/epics'

function SystemViewTab({ system, pvData, errors = {} }) {
  const [selectedPVs, setSelectedPVs] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [systemHealth, setSystemHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // Load selections from localStorage when system changes
  useEffect(() => {
    if (!system) {
      setSelectedPVs(new Set());
      return;
    }
    
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const allSelections = JSON.parse(saved);
        const systemSelections = allSelections[system.id] || [];
        console.log(`Loading selections for system ${system.name}:`, systemSelections);
        setSelectedPVs(new Set(systemSelections));
      } else {
        setSelectedPVs(new Set());
      }
    } catch (error) {
      console.warn('Failed to load selections:', error);
      setSelectedPVs(new Set());
    }
  }, [system]);

  // Save selections to localStorage whenever selectedPVs changes
  useEffect(() => {
    if (!system) return;

    const timeoutId = setTimeout(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        const allSelections = saved ? JSON.parse(saved) : {};
        
        if (selectedPVs.size === 0) {
          delete allSelections[system.id];
          console.log(`Cleared selections for system ${system.name}`);
        } else {
          allSelections[system.id] = Array.from(selectedPVs);
          console.log(`Saved selections for system ${system.name}:`, Array.from(selectedPVs));
        }
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allSelections));
      } catch (error) {
        console.warn('Failed to save selections:', error);
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [selectedPVs, system]);

  const showChart = selectedPVs.size > 0;

  // Fetch system health
  const fetchSystemHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      if (response.ok) {
        const health = await response.json();
        setSystemHealth(health);
      } else {
        setSystemHealth({ 
          status: 'DOWN', 
          error: `HTTP ${response.status}`,
          totalPVs: 0,
          connectedPVs: 0,
          alarmedPVs: 0
        });
      }
    } catch (err) {
      setSystemHealth({ 
        status: 'DOWN', 
        error: err.message,
        totalPVs: 0,
        connectedPVs: 0,
        alarmedPVs: 0
      });
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSystemHealth();
    const interval = setInterval(fetchSystemHealth, 5000);
    return () => clearInterval(interval);
  }, [fetchSystemHealth]);

  // Get PV status - simplified for new API
  const getPVStatusForRow = useCallback((pvName) => {
    const data = pvData[pvName];
    const error = errors[pvName];
    
    if (error) return 'Error';
    if (!data) return 'Unknown';
    
    if (data.hasAlarm === true) return 'Alarm';
    if (data.connectionStatus !== 'CONNECTED') return 'Disconnected';
    
    return 'Connected';
  }, [pvData, errors]);

  // Get formatted value
  const getFormattedValue = useCallback((pvName) => {
    const data = pvData[pvName];
    if (!data) return 'N/A';
    
    const value = data.formattedValue || data.value;
    if (value === null || value === undefined) return 'N/A';
    
    return String(value);
  }, [pvData]);

  // Check alarm condition - simplified
  const hasAlarmCondition = useCallback((pvName) => {
    const data = pvData[pvName];
    return data && data.hasAlarm === true;
  }, [pvData]);

  // Get alarm level - simplified
  const getAlarmLevel = useCallback((pvName) => {
    const data = pvData[pvName];
    if (!data || !data.hasAlarm) return null;
    
    const severity = data.alarmSeverity?.toLowerCase() || '';
    if (severity.includes('major')) return 'major';
    return 'minor';
  }, [pvData]);

  // Handle PV selection - simple local state
  const handlePVSelect = useCallback((pvName) => {
    setSelectedPVs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pvName)) {
        newSet.delete(pvName);
        console.log(`Deselected PV: ${pvName}`);
      } else {
        newSet.add(pvName);
        console.log(`Selected PV: ${pvName}`);
      }
      return newSet;
    });
  }, []);

  const handleRowClick = useCallback((pvName) => {
    handlePVSelect(pvName);
  }, [handlePVSelect]);

  const isSelected = useCallback((pvName) => {
    return selectedPVs.has(pvName);
  }, [selectedPVs]);

  // Handle sorting
  const handleSort = useCallback((key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  }, [sortConfig]);

  // Filter and sort PVs
  const filteredAndSortedPVs = useMemo(() => {
    if (!system || !system.pvs || !Array.isArray(system.pvs)) {
      return [];
    }

    let filtered = system.pvs.filter(pvName => {
      if (searchTerm && !pvName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      if (filterStatus !== 'all') {
        const status = getPVStatusForRow(pvName);
        if (filterStatus !== status.toLowerCase()) {
          return false;
        }
      }

      return true;
    });

    // Sort PVs
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aValue, bValue;

        switch (sortConfig.key) {
          case 'name':
            aValue = a.toLowerCase();
            bValue = b.toLowerCase();
            break;
          case 'value':
            aValue = getFormattedValue(a);
            bValue = getFormattedValue(b);
            break;
          case 'status':
            aValue = getPVStatusForRow(a);
            bValue = getPVStatusForRow(b);
            break;
          case 'timestamp':
            aValue = pvData[a]?.timestamp || 0;
            bValue = pvData[b]?.timestamp || 0;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [system, searchTerm, filterStatus, sortConfig, getPVStatusForRow, getFormattedValue, pvData]);

  // Calculate statistics - simplified
  const systemStats = useMemo(() => {
    if (!system || !system.pvs || !Array.isArray(system.pvs)) {
      return { total: 0, connected: 0, disconnected: 0, alarms: 0, errors: 0 };
    }

    const total = system.pvs.length;
    let connected = 0;
    let disconnected = 0;
    let alarms = 0;
    let errorCount = 0;

    system.pvs.forEach(pvName => {
      const status = getPVStatusForRow(pvName);
      switch (status) {
        case 'Connected':
          connected++;
          break;
        case 'Disconnected':
          disconnected++;
          break;
        case 'Alarm':
          alarms++;
          break;
        case 'Error':
          errorCount++;
          break;
        default:
          disconnected++;
      }
    });

    return { total, connected, disconnected, alarms, errors: errorCount };
  }, [system, getPVStatusForRow]);

  // Handle bulk operations
  const handleSelectAll = useCallback(() => {
    if (selectedPVs.size === filteredAndSortedPVs.length && filteredAndSortedPVs.length > 0) {
      // Deselect all
      setSelectedPVs(new Set());
      console.log('Deselected all PVs');
    } else {
      // Select all filtered PVs
      setSelectedPVs(new Set(filteredAndSortedPVs));
      console.log('Selected all filtered PVs:', filteredAndSortedPVs);
    }
  }, [selectedPVs.size, filteredAndSortedPVs]);

  const handleClearSelection = useCallback(() => {
    setSelectedPVs(new Set());
    console.log('Cleared all selections');
  }, []);

  if (!system) {
    return (
      <div className="system-view-tab">
        <div className="no-system">
          <h2>No System Selected</h2>
          <p>Please select a system from the sidebar to view its PVs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="system-view-tab">
      {/* Enhanced Header with Health Status */}
      <div className="system-header">
        <div className="header-main">
          <h2>{system.name}</h2>
          
          {/* System Health Status */}
          <div className="health-status">
            {healthLoading ? (
              <span className="health-loading">Checking health...</span>
            ) : systemHealth ? (
              <div className={`health-indicator ${systemHealth.status.toLowerCase()}`}>
                <span className="health-dot"></span>
                <span className="health-text">
                  EPICS {systemHealth.status}
                  {systemHealth.error && ` (${systemHealth.error})`}
                </span>
              </div>
            ) : (
              <div className="health-indicator unknown">
                <span className="health-dot"></span>
                <span className="health-text">Health Unknown</span>
              </div>
            )}
          </div>
        </div>

        <div className="system-stats">
          <div className="stat-item">
            <span className="stat-value">{systemStats.total}</span>
            <span className="stat-label">Total PVs</span>
          </div>
          <div className="stat-item connected">
            <span className="stat-value">{systemStats.connected}</span>
            <span className="stat-label">Connected</span>
          </div>
          <div className="stat-item disconnected">
            <span className="stat-value">{systemStats.disconnected}</span>
            <span className="stat-label">Disconnected</span>
          </div>
          <div className="stat-item alarm">
            <span className="stat-value">{systemStats.alarms}</span>
            <span className="stat-label">Alarms</span>
          </div>
          <div className="stat-item error">
            <span className="stat-value">{systemStats.errors}</span>
            <span className="stat-label">Errors</span>
          </div>
          
          {/* Global Health Stats */}
          {systemHealth && (
            <>
              <div className="stat-item global">
                <span className="stat-value">{systemHealth.totalPVs}</span>
                <span className="stat-label">Global Total</span>
              </div>
              <div className="stat-item global connected">
                <span className="stat-value">{systemHealth.connectedPVs}</span>
                <span className="stat-label">Global Connected</span>
              </div>
              {systemHealth.alarmedPVs > 0 && (
                <div className="stat-item global alarm">
                  <span className="stat-value">{systemHealth.alarmedPVs}</span>
                  <span className="stat-label">Global Alarms</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="system-controls">
        <div className="search-filter-section">
          <input
            type="text"
            placeholder="Search PVs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <select
value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="status-filter"
          >
            <option value="all">All Status</option>
            <option value="connected">Connected</option>
            <option value="disconnected">Disconnected</option>
            <option value="alarm">Alarm</option>
            <option value="error">Error</option>
          </select>
        </div>

        <div className="selection-controls">
          {selectedPVs.size > 0 && (
            <span className="selection-count">
              {selectedPVs.size} selected for monitoring (saved)
            </span>
          )}
          <button 
            onClick={handleSelectAll}
            className="select-all-btn"
          >
            {selectedPVs.size === filteredAndSortedPVs.length && filteredAndSortedPVs.length > 0 
              ? 'Deselect All' 
              : 'Select All'
            }
          </button>
          <button 
            onClick={handleClearSelection}
            className="clear-selection-btn"
            disabled={selectedPVs.size === 0}
          >
            Clear Selection
          </button>
        </div>
      </div>

      {/* PV Table */}
      <div className="pv-table-container">
        {filteredAndSortedPVs.length > 0 ? (
          <table className="pv-table">
            <thead>
              <tr>
                <th className="select-column">
                  <input
                    type="checkbox"
                    checked={selectedPVs.size === filteredAndSortedPVs.length && filteredAndSortedPVs.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th 
                  className={`sortable ${sortConfig.key === 'name' ? sortConfig.direction : ''}`}
                  onClick={() => handleSort('name')}
                >
                  PV Name
                  <span className="sort-indicator">
                    {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </span>
                </th>
                <th 
                  className={`sortable ${sortConfig.key === 'value' ? sortConfig.direction : ''}`}
                  onClick={() => handleSort('value')}
                >
                  Value
                  <span className="sort-indicator">
                    {sortConfig.key === 'value' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </span>
                </th>
                <th 
                  className={`sortable ${sortConfig.key === 'status' ? sortConfig.direction : ''}`}
                  onClick={() => handleSort('status')}
                >
                  Status
                  <span className="sort-indicator">
                    {sortConfig.key === 'status' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </span>
                </th>
                <th 
                  className={`sortable ${sortConfig.key === 'timestamp' ? sortConfig.direction : ''}`}
                  onClick={() => handleSort('timestamp')}
                >
                  Last Update
                  <span className="sort-indicator">
                    {sortConfig.key === 'timestamp' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedPVs.map((pvName) => {
                const data = pvData[pvName];
                const error = errors[pvName];
                const status = getPVStatusForRow(pvName);
                const hasAlarm = hasAlarmCondition(pvName);
                const alarmLevel = getAlarmLevel(pvName);
                const isActive = data && data.connectionStatus === 'CONNECTED';
                
                return (
                  <tr 
                    key={pvName} 
                    className={`
                      pv-row
                      ${isSelected(pvName) ? 'selected' : ''} 
                      ${hasAlarm ? `alarm alarm-${alarmLevel}` : ''} 
                      ${isActive ? 'active' : ''}
                      ${status.toLowerCase()}
                    `}
                    onClick={() => handleRowClick(pvName)}
                  >
                    <td className="select-cell">
                      <input
                        type="checkbox"
                        checked={isSelected(pvName)}
                        onChange={() => handlePVSelect(pvName)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="pv-name-cell">
                      <div className="pv-name-container">
                        <span className="pv-name">{pvName}</span>
                        {hasAlarm && (
                          <span className={`alarm-indicator alarm-${alarmLevel}`}>
                            ⚠
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="pv-value-cell">
                      <div className={`value ${status.toLowerCase()}`}>
                        {error ? (
                          <span className="error-text">Error</span>
                        ) : data ? (
                          <>
                            <span className="value-text">
                              {getFormattedValue(pvName)}
                            </span>
                            {data.units && (
                              <span className="units">{data.units}</span>
                            )}
                          </>
                        ) : (
                          <span className="no-data">N/A</span>
                        )}
                      </div>
                    </td>
                    <td className="status-cell">
                      <span className={`status-badge ${status.toLowerCase()}`}>
                        {status}
                      </span>
                    </td>
                    <td className="timestamp-cell">
                      <span className="timestamp">
                        {data && data.timestampFormatted ? 
                          data.timestampFormatted : 
                          'Never'
                        }
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="no-pvs">
            {system.pvs && system.pvs.length > 0 ? (
              <>
                <p>No PVs match your current filters.</p>
                <p>Try adjusting your search term or status filter.</p>
              </>
            ) : (
              <>
                <p>No PVs configured for this system.</p>
                <p>Go to the GUI Config tab to add PVs to this system.</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Real-time PV Monitoring Chart */}
      <PVChart 
        selectedPVs={selectedPVs}
        pvData={pvData}
        isVisible={showChart}
      />
    </div>
  );
}

export default SystemViewTab;