import React from 'react';
import './Modal.css';

function Modal({ children, onClose, className = '' }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={`modal-content ${className}`} 
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export default Modal;