import React, { useState, useCallback, useMemo, useEffect } from 'react';
import './SystemOverviewTab.css';

const API_BASE_URL = process.env.REACT_APP_API_URL | 'http://localhost:8080/api/epics';

function SystemOverviewTab({ 
  systems, 
  updateSystems, 
  pvData, 
  errors = {},
  onSystemSelect 
}) {
  const [selectedSystems, setSelectedSystems] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [systemHealth, setSystemHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);

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

  // Simplified alarm condition check
  const hasAlarmCondition = useCallback((pvName) => {
    const data = pvData[pvName];
    return data && data.hasAlarm === true;
  }, [pvData]);

  // Handle system selection
  const handleSystemSelect = useCallback((systemId) => {
    setSelectedSystems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(systemId)) {
        newSet.delete(systemId);
      } else {
        newSet.add(systemId);
      }
      return newSet;
    });
  }, []);

  // Handle system click for viewing
  const handleSystemClick = useCallback((system) => {
    if (onSystemSelect) {
      onSystemSelect(system);
    }
  }, [onSystemSelect]);

  // Calculate system statistics - simplified for new API
  const getSystemStats = useCallback((system) => {
    if (!system.pvs || system.pvs.length === 0) {
      return { total: 0, connected: 0, active: 0, withAlarms: 0 };
    }

    const total = system.pvs.length;
    const connected = system.pvs.filter(pv => {
      const data = pvData[pv];
      return data && data.connectionStatus === 'CONNECTED';
    }).length;
    
    const active = system.pvs.filter(pv => {
      const data = pvData[pv];
      return data && data.connectionStatus === 'CONNECTED' && 
             data.value !== null && data.value !== undefined;
    }).length;
    
    const withAlarms = system.pvs.filter(pv => {
      return hasAlarmCondition(pv);
    }).length;

    return { total, connected, active, withAlarms };
  }, [pvData, hasAlarmCondition]);

  // Handle sorting
  const handleSort = useCallback((key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  }, [sortConfig]);

  // Filter and sort systems
  const filteredAndSortedSystems = useMemo(() => {
    let filtered = systems.filter(system => {
      if (searchTerm && !system.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      return true;
    });

    // Sort systems
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aValue, bValue;

        switch (sortConfig.key) {
          case 'name':
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case 'pvCount':
            aValue = a.pvs?.length || 0;
            bValue = b.pvs?.length || 0;
            break;
          case 'connected':
            aValue = getSystemStats(a).connected;
            bValue = getSystemStats(b).connected;
            break;
          case 'alarms':
            aValue = getSystemStats(a).withAlarms;
            bValue = getSystemStats(b).withAlarms;
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
  }, [systems, searchTerm, sortConfig, getSystemStats]);

  // Calculate overall statistics - enhanced with health data
  const overallStats = useMemo(() => {
    const totalSystems = systems.length;
    const totalPVs = systems.reduce((sum, sys) => sum + (sys.pvs?.length || 0), 0);
    const totalConnected = systems.reduce((sum, sys) => sum + getSystemStats(sys).connected, 0);
    const totalAlarms = systems.reduce((sum, sys) => sum + getSystemStats(sys).withAlarms, 0);

    // Use health data if available, otherwise fall back to calculated stats
    const globalStats = systemHealth ? {
      globalTotalPVs: systemHealth.totalPVs,
      globalConnectedPVs: systemHealth.connectedPVs,
      globalAlarmedPVs: systemHealth.alarmedPVs
    } : {
      globalTotalPVs: totalPVs,
      globalConnectedPVs: totalConnected,
      globalAlarmedPVs: totalAlarms
    };

    return { 
      totalSystems, 
      totalPVs, 
      totalConnected, 
      totalAlarms,
      ...globalStats
    };
  }, [systems, getSystemStats, systemHealth]);

  // Handle bulk operations
  const handleBulkDelete = useCallback(() => {
    if (selectedSystems.size === 0) return;

    const systemNames = Array.from(selectedSystems)
      .map(id => systems.find(s => s.id === id)?.name)
      .filter(Boolean);

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedSystems.size} system(s)?\n\n${systemNames.join('\n')}`
    );

    if (confirmed) {
      const newSystems = systems.filter(system => !selectedSystems.has(system.id));
      updateSystems(newSystems);
      setSelectedSystems(new Set());
    }
  }, [selectedSystems, systems, updateSystems]);

  return (
    <div className="system-overview-tab">
      {/* Enhanced Header with EPICS Health Status */}
      <div className="overview-header">
        <div className="header-title-section">
          <h2>System Overview</h2>
          
          {/* EPICS Health Status */}
          <div className="epics-health-status">
            {healthLoading ? (
              <span className="health-loading">Checking EPICS health...</span>
            ) : systemHealth ? (
              <div className={`health-indicator ${systemHealth.status.toLowerCase()}`}>
                <span className="health-dot"></span>
                <span className="health-text">
                  EPICS {systemHealth.status}
                  {systemHealth.error && ` (${systemHealth.error})`}
                </span>
                {systemHealth.timestamp && (
                  <span className="health-timestamp">
                    Last checked: {new Date(systemHealth.timestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>
            ) : (
              <div className="health-indicator unknown">
                <span className="health-dot"></span>
                <span className="health-text">EPICS Health Unknown</span>
              </div>
            )}
          </div>
        </div>

        <div className="overall-stats">
          <div className="stat-card">
            <div className="stat-value">{overallStats.totalSystems}</div>
            <div className="stat-label">Systems</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{overallStats.totalPVs}</div>
            <div className="stat-label">Configured PVs</div>
          </div>
          <div className="stat-card">
            <div className="stat-value connected">{overallStats.totalConnected}</div>
            <div className="stat-label">Connected</div>
          </div>
          <div className="stat-card">
            <div className="stat-value alarm">{overallStats.totalAlarms}</div>
            <div className="stat-label">Alarms</div>
          </div>
          
          {/* Global EPICS Stats (if different from configured) */}
          {systemHealth && systemHealth.totalPVs !== overallStats.totalPVs && (
            <>
              <div className="stat-card global">
                <div className="stat-value">{systemHealth.totalPVs}</div>
                <div className="stat-label">Global PVs</div>
              </div>
              <div className="stat-card global">
                <div className="stat-value connected">{systemHealth.connectedPVs}</div>
                <div className="stat-label">Global Connected</div>
              </div>
              {systemHealth.alarmedPVs > 0 && (
                <div className="stat-card global">
                  <div className="stat-value alarm">{systemHealth.alarmedPVs}</div>
                  <div className="stat-label">Global Alarms</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="overview-controls">
        <div className="search-section">
          <input
            type="text"
            placeholder="Search systems..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="bulk-actions">
          {selectedSystems.size > 0 && (
            <>
              <span className="selection-count">
                {selectedSystems.size} selected
              </span>
              <button 
                onClick={handleBulkDelete}
                className="bulk-delete-btn"
              >
                Delete Selected
              </button>
            </>
          )}
          <button 
            onClick={() => setSelectedSystems(new Set())}
            className="clear-selection-btn"
            disabled={selectedSystems.size === 0}
          >
            Clear Selection
          </button>
        </div>
      </div>

      {/* Systems Table */}
      <div className="systems-table-container">
        {filteredAndSortedSystems.length > 0 ? (
          <table className="systems-table">
            <thead>
              <tr>
                <th className="select-column">
                  <input
                    type="checkbox"
                    checked={selectedSystems.size === filteredAndSortedSystems.length && filteredAndSortedSystems.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSystems(new Set(filteredAndSortedSystems.map(s => s.id)));
                      } else {
                        setSelectedSystems(new Set());
                      }
                    }}
                  />
                </th>
                <th 
                  className={`sortable ${sortConfig.key === 'name' ? sortConfig.direction : ''}`}
                  onClick={() => handleSort('name')}
                >
                  System Name
                  <span className="sort-indicator">
                    {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </span>
                </th>
                <th 
                  className={`sortable ${sortConfig.key === 'pvCount' ? sortConfig.direction : ''}`}
                  onClick={() => handleSort('pvCount')}
                >
                  PV Count
                  <span className="sort-indicator">
                    {sortConfig.key === 'pvCount' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </span>
                </th>
                <th 
                  className={`sortable ${sortConfig.key === 'connected' ? sortConfig.direction : ''}`}
                  onClick={() => handleSort('connected')}
                >
                  Connected
                  <span className="sort-indicator">
                    {sortConfig.key === 'connected' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </span>
                </th>
                <th 
                  className={`sortable ${sortConfig.key === 'alarms' ? sortConfig.direction : ''}`}
                  onClick={() => handleSort('alarms')}
                >
                  Alarms
                  <span className="sort-indicator">
                    {sortConfig.key === 'alarms' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </span>
                </th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedSystems.map((system) => {
                const stats = getSystemStats(system);
                const isSelected = selectedSystems.has(system.id);
                const hasAlarms = stats.withAlarms > 0;
                const isHealthy = stats.connected === stats.total && stats.total > 0;

                return (
                  <tr 
                    key={system.id} 
                    className={`system-row ${isSelected ? 'selected' : ''} ${hasAlarms ? 'has-alarms' : ''}`}
                  >
                    <td className="select-cell">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSystemSelect(system.id)}
                      />
                    </td>
                    <td 
                      className="system-name-cell clickable"
                      onClick={() => handleSystemClick(system)}
                    >
                      <div className="system-name-container">
                        <span className="system-name">{system.name}</span>
                        {hasAlarms && <span className="alarm-indicator">⚠</span>}
                      </div>
                    </td>
                    <td className="pv-count-cell">
                      <span className="pv-count">{stats.total}</span>
                    </td>
                    <td className="connected-cell">
                      <span className={`connected-count ${stats.connected === stats.total ? 'all-connected' : 'partial-connected'}`}>
                        {stats.connected}/{stats.total}
                      </span>
                    </td>
                    <td className="alarms-cell">
                      <span className={`alarm-count ${hasAlarms ? 'has-alarms' : 'no-alarms'}`}>
                        {stats.withAlarms}
                      </span>
                    </td>
                    <td className="status-cell">
                      <span className={`status-badge ${
                        stats.total === 0 ? 'empty' :
                        hasAlarms ? 'alarm' :
                        isHealthy ? 'healthy' :
                        stats.connected > 0 ? 'partial' : 'disconnected'
                      }`}>
                        {stats.total === 0 ? 'Empty' :
                         hasAlarms ? 'Alarm' :
                         isHealthy ? 'Healthy' :
                         stats.connected > 0 ? 'Partial' : 'Disconnected'}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button 
                        onClick={() => handleSystemClick(system)}
                        className="view-btn"
                        title="View system details"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="no-systems">
            {systems.length === 0 ? (
              <>
                <p>No systems configured yet.</p>
                <p>Go to the GUI Config tab to create your first system.</p>
              </>
            ) : (
              <>
                <p>No systems match your search criteria.</p>
                <p>Try adjusting your search term.</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SystemOverviewTab;