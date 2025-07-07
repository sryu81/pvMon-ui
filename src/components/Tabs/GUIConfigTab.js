import React, { useState } from 'react';
import CSVFileSelector from '../DBImport/CSVFileSelector';
import './Tabs.css';

function GUIConfigTab({ 
  pollingFrequency, 
  setPollingFrequency, 
  systems = [],
  addSystem, 
  removeSystem, 
  updateSystemName,
  systemPVInputs = {},
  updateSystemPVInput,
  addPVToSystem,
  removePVFromSystem,
  connectionStatus,
  addMultiplePVsToSystem,
  allPVNames,
  isPVDuplicate,
  getSystemWithPV
}) {
  const safeSystems = Array.isArray(systems) ? systems : [];
  const [pvInputErrors, setPvInputErrors] = useState({});

  // Check for duplicates as user types
  const handlePVInputChange = (systemId, value) => {
    updateSystemPVInput(systemId, value);
    
    // Clear previous error
    setPvInputErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[systemId];
      return newErrors;
    });

    // Check for duplicates if value is not empty
    if (value.trim()) {
      const trimmedValue = value.trim();
      if (isPVDuplicate(trimmedValue)) {
        const existingSystemName = getSystemWithPV(trimmedValue);
        setPvInputErrors(prev => ({
          ...prev,
          [systemId]: `PV already exists in "${existingSystemName}"`
        }));
      }
    }
  };

  // Enhanced add PV function with validation
  const handleAddPV = (systemId) => {
    const pvName = systemPVInputs[systemId];
    if (!pvName || !pvName.trim()) {
      return;
    }

    const trimmedPVName = pvName.trim();
    if (isPVDuplicate(trimmedPVName)) {
      const existingSystemName = getSystemWithPV(trimmedPVName);
      setPvInputErrors(prev => ({
        ...prev,
        [systemId]: `PV already exists in "${existingSystemName}"`
      }));
      return;
    }

    // Clear any errors and proceed
    setPvInputErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[systemId];
      return newErrors;
    });

    addPVToSystem(systemId);
  };

  return (
    <div className="gui-config-tab">
      <section className="config-section">
        <h2>Polling Configuration</h2>
        <div className="polling-control">
          <label htmlFor="polling-frequency">Polling Frequency (seconds):</label>
          <input
            id="polling-frequency"
            type="number"
            min="0.5"
            max="60"
            step="0.5"
            value={pollingFrequency / 1000}
            onChange={(e) => setPollingFrequency(parseFloat(e.target.value) * 1000)}
          />
          <span className="frequency-display">
            Current: {pollingFrequency / 1000}s
          </span>
        </div>
      </section>

      <section className="config-section">
        <h2>System Management</h2>
        
        {/* Global PV Statistics */}
        <div className="global-pv-stats">
          <div className="stat-item">
            <span className="stat-label">Total Systems:</span>
            <span className="stat-value">{safeSystems.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total Unique PVs:</span>
            <span className="stat-value">{allPVNames.size}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Connection:</span>
            <span className={`stat-value status-${connectionStatus.toLowerCase().replace(/\s+/g, '-')}`}>
              {connectionStatus}
            </span>
          </div>
        </div>

        <div className="system-controls">
          <button onClick={addSystem} className="add-system-btn">
            Add New System
          </button>
        </div>
        
        <div className="systems-list">
          {safeSystems.map(system => (
            <div key={system.id} className="system-card">
              <div className="system-header">
                <input
                  type="text"
                  value={system.name || ''}
                  onChange={(e) => updateSystemName(system.id, e.target.value)}
                  className="system-name-input"
                />
                <button 
                  onClick={() => removeSystem(system.id)}
                  className="remove-system-btn"
                >
                  Remove System
                </button>
              </div>
              
              <div className="system-pvs">
                <h4>PVs in {system.name}:</h4>
                
                <div className="pv-add-control">
                  <div className="pv-input-wrapper">
                    <input
                      type="text"
                      value={systemPVInputs[system.id] || ''}
                      onChange={(e) => handlePVInputChange(system.id, e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !pvInputErrors[system.id]) {
                          handleAddPV(system.id);
                        }
                      }}
                      placeholder="Enter PV name"
                      disabled={connectionStatus !== 'Connected'}
                      className={`pv-input ${pvInputErrors[system.id] ? 'error' : ''}`}
                    />
                    {pvInputErrors[system.id] && (
                      <div className="pv-input-error">
                        ⚠️ {pvInputErrors[system.id]}
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => handleAddPV(system.id)}
                    disabled={
                      connectionStatus !== 'Connected' || 
                      !systemPVInputs[system.id]?.trim() ||
                      !!pvInputErrors[system.id]
                    }
                    className={`add-pv-btn ${pvInputErrors[system.id] ? 'disabled' : ''}`}
                  >
                    Add PV
                  </button>
                </div>

                <CSVFileSelector
                  systemId={system.id}
                  onPVsExtracted={addMultiplePVsToSystem}
                  connectionStatus={connectionStatus}
                />
                
                {/* Updated PV list with scrolling */}
                <div className="pv-list-container">
                  {(system.pvs || []).length > 0 ? (
                    <>
                      <div className="pv-list-header">
                        <span className="pv-count-info">
                          {system.pvs.length} PV{system.pvs.length !== 1 ? 's' : ''} configured
                        </span>
                      </div>
                      <ul className="pv-list scrollable">
                        {(system.pvs || []).map((pvName, index) => (
                          <li key={`${pvName}-${index}`} className="pv-item">
                            <span className="pv-name" title={pvName}>{pvName}</span>
                            <button 
                              onClick={() => removePVFromSystem(system.id, pvName)}
                              className="remove-pv-btn"
                              title={`Remove ${pvName}`}
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <div className="no-pvs-message">
                      No PVs configured for this system.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default GUIConfigTab;