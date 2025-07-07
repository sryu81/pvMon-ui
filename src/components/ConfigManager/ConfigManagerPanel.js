import React, { useState } from 'react';
import './ConfigManager.css';

function ConfigManagerPanel({ 
  config, 
  hasUnsavedChanges, 
  onSave, 
  onExport, 
  onImport, 
  onReset 
}) {
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Safely get systems array and calculate total PVs
  const systems = Array.isArray(config?.systems) ? config.systems : [];
  const totalPVs = systems.reduce((total, system) => {
    return total + (Array.isArray(system.pvs) ? system.pvs.length : 0);
  }, 0);

  const handleImportFile = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const result = await onImport(file);
      if (result.success) {
        alert('Configuration imported successfully!');
        setShowImportDialog(false);
      } else {
        alert(`Import failed: ${result.error}`);
      }
      event.target.value = ''; // Reset file input
    }
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset to default configuration? This will clear all systems and PVs.')) {
      onReset();
      alert('Configuration reset to defaults');
    }
  };

  const handleExport = () => {
    const success = onExport();
    if (success) {
      alert('Configuration exported successfully!');
    } else {
      alert('Export failed. Please try again.');
    }
  };

  return (
    <div className="config-manager-panel">
      <h3>Configuration Management</h3>
      
      <div className="config-status">
        <div className="status-item">
          <strong>Last Saved:</strong> {config?.lastSaved ? new Date(config.lastSaved).toLocaleString() : 'Never'}
        </div>
        <div className="status-item">
          <strong>Status:</strong> 
          <span className={hasUnsavedChanges ? 'status-unsaved' : 'status-saved'}>
            {hasUnsavedChanges ? 'Unsaved Changes' : 'All Changes Saved'}
          </span>
        </div>
        <div className="status-item">
          <strong>Systems:</strong> {systems.length}
        </div>
        <div className="status-item">
          <strong>Total PVs:</strong> {totalPVs}
        </div>
      </div>

      <div className="config-actions">
        <button 
          onClick={onSave} 
          className="config-btn save-btn"
          disabled={!hasUnsavedChanges}
        >
          💾 Save Configuration
        </button>
        
        <button 
          onClick={handleExport} 
          className="config-btn export-btn"
        >
          📤 Export Configuration
        </button>
        
        <button 
          onClick={() => setShowImportDialog(true)} 
          className="config-btn import-btn"
        >
          📥 Import Configuration
        </button>
        
        <button 
          onClick={handleReset} 
          className="config-btn reset-btn"
        >
          🔄 Reset to Defaults
        </button>
      </div>

      {showImportDialog && (
        <div className="import-dialog">
          <div className="import-dialog-content">
            <h4>Import Configuration</h4>
            <p>Select a configuration file to import:</p>
            <input
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="file-input"
            />
            <div className="import-dialog-actions">
              <button 
                onClick={() => setShowImportDialog(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConfigManagerPanel;