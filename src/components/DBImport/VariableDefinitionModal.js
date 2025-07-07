import React, { useEffect, useState } from 'react';
import Modal from '../Common/Modal';
import './DBImport.css';

function VariableDefinitionModal({ variables, variableValues, onUpdateVariable, onComplete, onCancel }) {
  const [previewPVs, setPreviewPVs] = useState([]);

  useEffect(() => {
    const generatePreview = () => {
      const previews = [];
      variables.forEach(variable => {
        const value = variableValues[variable] || `{${variable}}`;
        previews.push(`Example: \${${variable}} → ${value}`);
      });
      setPreviewPVs(previews);
    };
    
    generatePreview();
  }, [variables, variableValues]);

  return (
    <Modal onClose={onCancel} className="variable-definition-modal">
      <div className="modal-header">
        <h3>Define Variables</h3>
        <button className="modal-close-btn" onClick={onCancel}>×</button>
      </div>
      
      <div className="modal-body">
        <div className="variable-info">
          <p>The database file contains <strong>{variables.length}</strong> variable{variables.length > 1 ? 's' : ''} that need to be defined:</p>
        </div>

        <div className="variables-form">
          {variables.map(variable => (
            <div key={variable} className="variable-input-group">
              <label className="variable-label">
                <span className="variable-name">${`{${variable}}`}</span>
                <input
                  type="text"
                  value={variableValues[variable] || ''}
                  onChange={(e) => onUpdateVariable(variable, e.target.value)}
                  placeholder={`Enter value for ${variable}`}
                  className="variable-input"
                />
              </label>
              <div className="variable-preview">
                Preview: {variableValues[variable] || `{${variable}}`}
              </div>
            </div>
          ))}
        </div>

        <div className="variable-examples">
          <h4>Common Examples:</h4>
          <div className="examples-grid">
            <div className="example-item">
              <strong>DEVICE:</strong> BL01, BL02, CTRL01
            </div>
            <div className="example-item">
              <strong>PREFIX:</strong> EPICS:, TEST:, SYS:
            </div>
            <div className="example-item">
              <strong>SUBSYS:</strong> VAC, TEMP, MOTOR
            </div>
            <div className="example-item">
              <strong>INDEX:</strong> 01, 02, 03
            </div>
          </div>
        </div>
      </div>

      <div className="modal-footer">
        <button onClick={onCancel} className="cancel-btn">
          Cancel
        </button>
        <button 
          onClick={onComplete} 
          className="continue-btn"
          disabled={variables.some(variable => !variableValues[variable]?.trim())}
        >
          Continue to PV Selection
        </button>
      </div>
    </Modal>
  );
}

export default VariableDefinitionModal;