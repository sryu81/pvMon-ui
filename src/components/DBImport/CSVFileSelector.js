import React, { useState, useRef } from 'react';
import CSVPreviewModal from './CSVPreviewModal';
import { extractPVNamesFromCSV, validateCSVContent } from '../../utils/csvParser';
import './DBImport.css';

function CSVFileSelector({ systemId, onPVsExtracted, connectionStatus }) {
  const [filePath, setFilePath] = useState('');
  const [extractedPVs, setExtractedPVs] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [rawCSVContent, setRawCSVContent] = useState('');
  const fileInputRef = useRef(null); // Add ref for file input

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.txt'))) {
      setFilePath(file.name);
      parseCSVFile(file);
    } else if (file) {
      alert('Please select a valid .csv or .txt file');
      resetFileInput();
    }
  };

  const handlePathInput = () => {
    if (filePath.trim()) {
      alert('Manual path input: Please use the browse button to select a file for now.');
    }
  };

  const parseCSVFile = async (file) => {
    setIsProcessing(true);
    try {
      const text = await file.text();
      setRawCSVContent(text);
      
      const validation = validateCSVContent(text);
      if (!validation.isValid) {
        alert(`Invalid CSV file: ${validation.error}`);
        resetState();
        return;
      }
      
      const pvNames = extractPVNamesFromCSV(text);
      
      if (pvNames.length === 0) {
        alert('No valid PV names found in the CSV file. Make sure PV names are in the first column.');
        resetState();
        return;
      }
      
      console.log(`CSV parsed: Found ${pvNames.length} PVs for system ${systemId}`);
      setExtractedPVs(pvNames);
      setShowPreview(true);
      
    } catch (error) {
      console.error('Error parsing CSV file:', error);
      alert('Error parsing CSV file: ' + error.message);
      resetState();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddSelectedPVs = (selectedPVs) => {
    console.log(`CSVFileSelector: Adding ${selectedPVs.length} selected PVs to system ${systemId}`);
    
    // Call the parent function to add PVs to the system
    onPVsExtracted(systemId, selectedPVs);
    resetState();
  };

  const handleCancel = () => {
    resetState();
  };

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetState = () => {
    setShowPreview(false);
    setFilePath('');
    setExtractedPVs([]);
    setRawCSVContent('');
    resetFileInput(); // Reset file input to allow same file selection
  };

  return (
    <div className="csv-file-selector">
      <h5>Import PVs from CSV File</h5>
      <p className="csv-info">
        Select a CSV file where the first column contains PV names. Other columns will be ignored.
      </p>
      
      <div className="file-input-section">
        <div className="file-input-group">
          <input
            type="text"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            onBlur={handlePathInput}
            placeholder="Enter file path or use browse button"
            className="file-path-input"
          />
          <label className="file-browse-btn">
            Browse...
            <input
              ref={fileInputRef} // Add ref here
              type="file"
              accept=".csv,.txt"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </label>
        </div>
        
        {isProcessing && (
          <div className="processing-indicator">
            <span>Processing CSV file...</span>
          </div>
        )}
      </div>

      {showPreview && (
        <CSVPreviewModal
          extractedPVs={extractedPVs}
          csvContent={rawCSVContent}
          onAddSelected={handleAddSelectedPVs}
          onCancel={handleCancel}
          connectionStatus={connectionStatus}
        />
      )}
    </div>
  );
}

export default CSVFileSelector;