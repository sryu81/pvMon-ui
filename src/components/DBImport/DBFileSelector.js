import React, { useState } from 'react';
import VariableDefinitionModal from './VariableDefinitionModal';
import DBPreviewModal from './DBPreviewModal';
import { extractVariablesFromDB, extractPVNamesFromDB } from '../../utils/dbParser';
import './DBImport.css';

function DBFileSelector({ systemId, onPVsExtracted, connectionStatus }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePath, setFilePath] = useState('');
  const [extractedPVs, setExtractedPVs] = useState([]);
  const [detectedVariables, setDetectedVariables] = useState([]);
  const [variableValues, setVariableValues] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [showVariableDefinition, setShowVariableDefinition] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [rawDBContent, setRawDBContent] = useState('');

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.name.endsWith('.db')) {
      setSelectedFile(file);
      setFilePath(file.name);
      parseDBFile(file);
    } else {
      alert('Please select a valid .db file');
      event.target.value = '';
    }
  };

  const parseDBFile = async (file) => {
    setIsProcessing(true);
    try {
      const text = await file.text();
      setRawDBContent(text);
      
      const variables = extractVariablesFromDB(text);
      setDetectedVariables(variables);
      
      if (variables.length > 0) {
        const initialValues = {};
        variables.forEach(variable => {
          initialValues[variable] = '';
        });
        setVariableValues(initialValues);
        setShowVariableDefinition(true);
      } else {
        const pvNames = extractPVNamesFromDB(text, {});
        setExtractedPVs(pvNames);
        setShowPreview(true);
      }
    } catch (error) {
      console.error('Error parsing DB file:', error);
      alert('Error parsing DB file: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVariableDefinitionComplete = () => {
    const emptyVariables = detectedVariables.filter(variable => !variableValues[variable]?.trim());
    
    if (emptyVariables.length > 0) {
      alert(`Please define values for: ${emptyVariables.join(', ')}`);
      return;
    }
    
    const pvNames = extractPVNamesFromDB(rawDBContent, variableValues);
    setExtractedPVs(pvNames);
    setShowVariableDefinition(false);
    setShowPreview(true);
  };

  const handleAddSelectedPVs = (selectedPVs) => {
    onPVsExtracted(systemId, selectedPVs);
    resetState();
  };

  const handleCancel = () => {
    resetState();
  };

  const resetState = () => {
    setShowPreview(false);
    setShowVariableDefinition(false);
    setSelectedFile(null);
    setFilePath('');
    setExtractedPVs([]);
    setDetectedVariables([]);
    setVariableValues({});
    setRawDBContent('');
  };

  const updateVariableValue = (variable, value) => {
    setVariableValues(prev => ({
      ...prev,
      [variable]: value
    }));
  };

  return (
    <div className="db-file-selector">
      <h5>Import PVs from Database File</h5>
      
      <div className="file-input-section">
        <div className="file-input-group">
          <input
            type="text"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            placeholder="Enter file path or use browse button"
            className="file-path-input"
          />
          <label className="file-browse-btn">
            Browse...
            <input
              type="file"
              accept=".db"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </label>
        </div>
        
        {isProcessing && (
          <div className="processing-indicator">
            <span>Processing DB file</span>
          </div>
        )}
      </div>

      {showVariableDefinition && (
        <VariableDefinitionModal
          variables={detectedVariables}
          variableValues={variableValues}
          onUpdateVariable={updateVariableValue}
          onComplete={handleVariableDefinitionComplete}
          onCancel={handleCancel}
        />
      )}

      {showPreview && (
        <DBPreviewModal
          extractedPVs={extractedPVs}
          variableSubstitutions={variableValues}
          onAddSelected={handleAddSelectedPVs}
          onCancel={handleCancel}
          connectionStatus={connectionStatus}
        />
      )}
    </div>
  );
}

export default DBFileSelector;