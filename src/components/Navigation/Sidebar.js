import React from 'react';
import './Sidebar.css';

function Sidebar({ activeTab, setActiveTab, systems = [], switchToSystemView }) {
  // Ensure systems is always an array
  const safeSystems = Array.isArray(systems) ? systems : [];

  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <h2>Navigation</h2>
      </div>
      
      <ul className="nav-list">
        <li className={`nav-item ${activeTab === 'gui-config' ? 'active' : ''}`}>
          <button 
            onClick={() => setActiveTab('gui-config')}
            className="nav-button"
          >
            🔧 GUI Configuration
          </button>
        </li>
        
        <li className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}>
          <button 
            onClick={() => setActiveTab('overview')}
            className="nav-button"
          >
            📊 System Overview
          </button>
        </li>
        
        {safeSystems.length > 0 && (
          <li className="nav-section">
            <div className="nav-section-header">Systems</div>
            <ul className="nav-subsection">
              {safeSystems.map(system => (
                <li key={system.id} className={`nav-item ${activeTab === `system-${system.id}` ? 'active' : ''}`}>
                  <button 
                    onClick={() => switchToSystemView(system.id)}
                    className="nav-button nav-sub-button"
                    title={`${system.name} (${system.pvs?.length || 0} PVs)`}
                  >
                    🖥️ {system.name}
                    <span className="pv-count">({system.pvs?.length || 0})</span>
                  </button>
                </li>
              ))}
            </ul>
          </li>
        )}
      </ul>
    </nav>
  );
}

export default Sidebar;