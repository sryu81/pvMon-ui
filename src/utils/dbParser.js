export function extractVariablesFromDB(dbContent) {
  const variables = new Set();
  const variableRegex = /\$\{([^}]+)\}/g;
  let match;
  
  while ((match = variableRegex.exec(dbContent)) !== null) {
    variables.add(match[1]);
  }
  
  return Array.from(variables).sort();
}

export function extractPVNamesFromDB(dbContent, substitutions = {}) {
  const pvNames = [];
  const lines = dbContent.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Look for record definitions
    if (line.startsWith('record(')) {
      // Extract PV name from record definition
      const match = line.match(/record\s*\(\s*\w+\s*,\s*["]?([^",)]+)["]?\s*\)/);
      if (match && match[1]) {
        let pvName = match[1].trim().replace(/['"]/g, '');
        
        // Apply variable substitutions
        Object.entries(substitutions).forEach(([variable, value]) => {
          pvName = pvName.replace(new RegExp(`\\$\\{${variable}\\}`, 'g'), value);
        });
        
        if (pvName && !pvNames.includes(pvName)) {
          pvNames.push(pvName);
        }
      }
    }
  }
  
  return pvNames.sort();
}