import React, { useState, useMemo, useCallback, useEffect } from 'react';
import './DBImport.css';

function CSVPreviewModal({ 
  extractedPVs, 
  csvContent, 
  onAddSelected, 
  onCancel, 
  connectionStatus 
}) {
  const [selectedPVs, setSelectedPVs] = useState(new Set(extractedPVs));
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter PVs based on search term
  const filteredPVs = useMemo(() => {
    if (!searchTerm.trim()) return extractedPVs;
    const searchLower = searchTerm.toLowerCase();
    return extractedPVs.filter(pv => 
      pv.toLowerCase().includes(searchLower)
    );
  }, [extractedPVs, searchTerm]);

  // Update selected PVs when filtered PVs change
  useEffect(() => {
    if (searchTerm.trim()) {
      // When searching, only keep selected PVs that match the filter
      setSelectedPVs(prev => {
        const newSelected = new Set();
        filteredPVs.forEach(pv => {
          if (prev.has(pv)) {
            newSelected.add(pv);
          }
        });
        return newSelected;
      });
    }
  }, [filteredPVs, searchTerm]);

  // Handle select all/deselect all
  const handleSelectAll = useCallback(() => {
    if (selectedPVs.size === filteredPVs.length && filteredPVs.every(pv => selectedPVs.has(pv))) {
      // Deselect all filtered PVs
      setSelectedPVs(prev => {
        const newSelected = new Set(prev);
        filteredPVs.forEach(pv => newSelected.delete(pv));
        return newSelected;
      });
    } else {
      // Select all filtered PVs
      setSelectedPVs(prev => {
        const newSelected = new Set(prev);
        filteredPVs.forEach(pv => newSelected.add(pv));
        return newSelected;
      });
    }
  }, [filteredPVs, selectedPVs]);

  // Handle individual PV toggle
  const handlePVToggle = useCallback((pvName) => {
    setSelectedPVs(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(pvName)) {
        newSelected.delete(pvName);
      } else {
        newSelected.add(pvName);
      }
      return newSelected;
    });
  }, []);

  // Handle search input change
  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value);
  }, []);

  // Handle adding selected PVs
  const handleAddSelected = useCallback(async () => {
    const selectedArray = Array.from(selectedPVs);
    if (selectedArray.length === 0) {
      alert('Please select at least one PV to add.');
      return;
    }

    if (connectionStatus !== 'Connected') {
      alert('Cannot add PVs: Not connected to server.');
      return;
    }

    setIsProcessing(true);
    try {
      await onAddSelected(selectedArray);
    } catch (error) {
      console.error('Error adding PVs:', error);
      alert('Error adding PVs. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedPVs, connectionStatus, onAddSelected]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (isProcessing) {
      const confirmCancel = window.confirm('Import is in progress. Are you sure you want to cancel?');
      if (!confirmCancel) return;
    }
    onCancel();
  }, [isProcessing, onCancel]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (!isProcessing && selectedPVs.size > 0) {
          handleAddSelected();
        }
      } else if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSelectAll();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleCancel, handleAddSelected, handleSelectAll, isProcessing, selectedPVs.size]);

  // Calculate selection statistics
  const selectedCount = selectedPVs.size;
  const totalCount = filteredPVs.length;
  const allFilteredSelected = filteredPVs.length > 0 && filteredPVs.every(pv => selectedPVs.has(pv));

  // Validate PV names (basic validation)
  const validPVs = useMemo(() => {
    return filteredPVs.filter(pv => {
      // Basic PV name validation - should not be empty and should contain valid characters
      return pv && pv.trim().length > 0 && /^[A-Za-z0-9_:.-]+$/.test(pv.trim());
    });
  }, [filteredPVs]);

  const invalidPVs = useMemo(() => {
    return filteredPVs.filter(pv => !validPVs.includes(pv));
  }, [filteredPVs, validPVs]);

  return (
    <div className="csv-preview-modal-overlay" onClick={(e) => e.target === e.currentTarget && handleCancel()}>
      <div className="csv-preview-modal">
        <div className="modal-header">
          <h3>CSV Import Preview</h3>
          <button onClick={handleCancel} className="close-btn" title="Close (Esc)">✕</button>
        </div>
        
        <div className="modal-content">
          <div className="preview-summary">
            <p>
              <strong>Found {extractedPVs.length} PV{extractedPVs.length !== 1 ? 's' : ''}</strong> in the CSV file.
            </p>
            {invalidPVs.length > 0 && (
              <p style={{ color: '#dc3545', fontWeight: 600 }}>
                ⚠️ {invalidPVs.length} PV{invalidPVs.length !== 1 ? 's have' : ' has'} invalid format and will be skipped.
              </p>
            )}
            <p className="selection-info">
              {selectedCount} of {totalCount} PV{totalCount !== 1 ? 's' : ''} selected
              {searchTerm && ` (filtered from ${extractedPVs.length} total)`}
            </p>
            {connectionStatus !== 'Connected' && (
              <p style={{ color: '#dc3545', fontWeight: 600 }}>
                ⚠️ Not connected to server. Cannot add PVs.
              </p>
            )}
          </div>

          <div className="preview-controls">
            <div className="search-control">
              <input
                type="text"
                placeholder="Search PVs... (supports partial matching)"
                value={searchTerm}
                onChange={handleSearchChange}
                className="pv-search-input"
                disabled={isProcessing}
              />
            </div>
            <button 
              onClick={handleSelectAll}
              className="select-all-btn"
              disabled={isProcessing || filteredPVs.length === 0}
              title={`${allFilteredSelected ? 'Deselect' : 'Select'} all filtered PVs (Ctrl+A)`}
            >
              {allFilteredSelected ? 'Deselect All' : 'Select All'}
              {filteredPVs.length > 0 && ` (${filteredPVs.length})`}
            </button>
          </div>
<div className="pv-preview-list">
            {filteredPVs.length > 0 ? (
              filteredPVs.map((pvName, index) => {
                const isValid = validPVs.includes(pvName);
                const isSelected = selectedPVs.has(pvName);
                
                return (
                  <div 
                    key={`${pvName}-${index}`} 
                    className={`pv-preview-item ${isSelected ? 'selected' : ''} ${!isValid ? 'invalid' : ''}`}
                    title={!isValid ? 'Invalid PV name format' : pvName}
                  >
                    <label className="pv-checkbox-label">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handlePVToggle(pvName)}
                        className="pv-checkbox"
                        disabled={isProcessing || !isValid}
                        aria-label={`Select PV ${pvName}`}
                      />
                      <span className={`pv-preview-name ${!isValid ? 'invalid-pv' : ''}`}>
                        {pvName}
                        {!isValid && <span className="invalid-indicator"> ⚠️</span>}
                      </span>
                    </label>
                  </div>
                );
              })
            ) : searchTerm ? (
              <div className="no-results">
                No PVs match your search term "{searchTerm}"
                <br />
                <small>Try a different search term or clear the search to see all PVs</small>
              </div>
            ) : (
              <div className="no-results">
                No PVs found in the CSV file
                <br />
                <small>Make sure PV names are in the first column</small>
              </div>
            )}
          </div>

          {/* Additional information */}
          {(invalidPVs.length > 0 || selectedCount > 0) && (
            <div className="additional-info">
              {invalidPVs.length > 0 && (
                <div className="invalid-pvs-info">
                  <details>
                    <summary>
                      <strong>{invalidPVs.length} Invalid PV{invalidPVs.length !== 1 ? 's' : ''}</strong>
                      <small> (click to expand)</small>
                    </summary>
                    <div className="invalid-pvs-list">
                      {invalidPVs.slice(0, 10).map((pv, index) => (
                        <div key={index} className="invalid-pv-item">
                          <code>{pv}</code>
                        </div>
                      ))}
                      {invalidPVs.length > 10 && (
                        <div className="more-invalid">
                          ... and {invalidPVs.length - 10} more
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              )}
              
              {selectedCount > 0 && (
                <div className="selection-summary">
                  <strong>Ready to import:</strong> {selectedCount} valid PV{selectedCount !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="modal-actions">
          <button 
            onClick={handleCancel}
            className="cancel-btn"
            disabled={isProcessing}
            title="Cancel import (Esc)"
          >
            {isProcessing ? 'Canceling...' : 'Cancel'}
          </button>
          <button 
            onClick={handleAddSelected}
            disabled={selectedCount === 0 || connectionStatus !== 'Connected' || isProcessing}
            className="add-selected-btn"
            title={`Add selected PVs (Ctrl+Enter)`}
          >
            {isProcessing ? (
              <>
                <span className="loading-spinner"></span>
                Adding PVs...
              </>
            ) : (
              `Add ${selectedCount} Selected PV${selectedCount !== 1 ? 's' : ''}`
            )}
          </button>
        </div>

        {/* Keyboard shortcuts help */}
        <div className="keyboard-shortcuts">
          <small>
            <strong>Shortcuts:</strong> 
            Esc = Cancel | Ctrl+A = Select All | Ctrl+Enter = Add Selected
          </small>
        </div>
      </div>
    </div>
  );
}

export default CSVPreviewModal;