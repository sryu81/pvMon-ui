import React, { useState, useEffect } from 'react';
import Modal from '../Common/Modal';
import { parseCSVPreview } from '../../utils/csvParser';
import './DBImport.css';

function CSVPreviewModal({ extractedPVs, csvContent, onAddSelected, onCancel, connectionStatus }) {
  const [selectedPVs, setSelectedPVs] = useState(new Set(extractedPVs));
  const [searchTerm, setSearchTerm] = useState('');
  const [csvPreview, setCsvPreview] = useState(null);

  useEffect(() => {
    const preview = parseCSVPreview(csvContent, 10);
    setCsvPreview(preview);
  }, [csvContent]);

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
    <Modal onClose={onCancel} className="csv-preview-modal">
      <div className="modal-header">
        <h3>Import PVs from CSV File</h3>
        <button className="modal-close-btn" onClick={onCancel}>×</button>
      </div>
      
      <div className="modal-body">
        <div className="csv-summary">
          <p>Found <strong>{extractedPVs.length}</strong> PVs in the CSV file.</p>
          <p>Selected: <strong>{selectedPVs.size}</strong> PVs</p>
          
          {csvPreview && (
            <div className="csv-preview-section">
              <strong>CSV Preview (first {csvPreview.preview.length} lines):</strong>
              <div className="csv-preview-table">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th>Line</th>
                      <th>PV Name (Column 1)</th>
                      <th>Other Columns</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.preview.map((row, index) => (
                      <tr key={index}>
                        <td>{row.lineNumber}</td>
                        <td className="pv-name-preview">{row.pvName}</td>
                        <td className="other-columns">
                          {row.otherColumns.length > 0 ? row.otherColumns.join(', ') : '(none)'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {csvPreview.totalLines > csvPreview.preview.length && (
                <p className="preview-note">
                  ... and {csvPreview.totalLines - csvPreview.preview.length} more lines
                </p>
              )}
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

export default CSVPreviewModal;