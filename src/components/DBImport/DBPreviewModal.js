import React, { useState } from 'react';
import Modal from '../Common/Modal';
import './DBImport.css';

function DBPreviewModal({ extractedPVs, variableSubstitutions, onAddSelected, onCancel, connectionStatus }) {
  const [selectedPVs, setSelectedPVs] = useState(new Set(extractedPVs));
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPVs = extractedPVs.filter(pv => 
    pv.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleTogglePV = (pvName) => {
    setSelectedPVs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pvName)) {
        newSet.delete(pvName);
      } else {
        newSet.add(pvName);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    setSelectedPVs(new Set(filteredPVs));
  };

  const handleSelectNone = () => {
    setSelectedPVs(new Set());
  };

  const handleAddSelected = () => {
    onAddSelected(Array.from(selectedPVs));
  };

  return (
    <Modal onClose={onCancel} className="db-preview-modal">
      <div className="modal-header">
        <h3>Import PVs from Database File</h3>
        <button className="modal-close-btn" onClick={onCancel}>×</button>
      </div>
      
      <div className="modal-body">
        <div className="pv-summary">
          <p>Found <strong>{extractedPVs.length}</strong> PVs in the database file.</p>
          <p>Selected: <strong>{selectedPVs.size}</strong> PVs</p>
          
          {Object.keys(variableSubstitutions).length > 0 && (
            <div className="substitution-summary">
              <strong>Variable substitutions applied:</strong>
              <div className="substitution-list">
                {Object.entries(variableSubstitutions).map(([variable, value]) => (
                  <span key={variable} className="substitution-item">
                    ${`{${variable}}`} → {value}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="pv-controls">
          <div className="search-control">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search PVs..."
              className="pv-search-input"
            />
          </div>
          
          <div className="selection-controls">
            <button onClick={handleSelectAll} className="select-btn">
              Select All {filteredPVs.length > 0 && `(${filteredPVs.length})`}
            </button>
            <button onClick={handleSelectNone} className="select-btn">
              Select None
            </button>
          </div>
        </div>

        <div className="pv-list-container">
          {filteredPVs.length === 0 ? (
            <p className="no-results">No PVs match your search.</p>
          ) : (
            <div className="pv-checkbox-list">
              {filteredPVs.map(pvName => (
                <label key={pvName} className="pv-checkbox-item">
                  <input
                    type="checkbox"
                    checked={selectedPVs.has(pvName)}
                    onChange={() => handleTogglePV(pvName)}
                  />
                  <span className="pv-name-text">{pvName}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="modal-footer">
        <button onClick={onCancel} className="cancel-btn">
          Cancel
        </button>
        <button 
          onClick={handleAddSelected} 
          className="add-pvs-btn"
          disabled={selectedPVs.size === 0 || connectionStatus !== 'Connected'}
        >
          Add {selectedPVs.size} PVs to System
        </button>
      </div>
    </Modal>
  );
}

export default DBPreviewModal;