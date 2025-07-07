// Enhanced PV name validation
export function validatePVName(pvName) {
  if (!pvName || typeof pvName !== 'string') return false;
  
  // EPICS PV names: must start with letter, contain colons, alphanumeric, underscores, dashes, dots
  const pvPattern = /^[A-Za-z][A-Za-z0-9_:.-]*$/;
  
  // Must contain at least one colon (EPICS convention)
  return pvPattern.test(pvName) && pvName.includes(':') && pvName.length >= 3;
}

export function extractPVNamesFromCSV(csvContent) {
  if (!csvContent || typeof csvContent !== 'string') {
    return [];
  }

  const pvNames = [];
  const lines = csvContent.split('\n');
  const seenPVs = new Set(); // Track duplicates
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Split by comma and take the first column
    const columns = line.split(',');
    const pvName = columns[0].trim().replace(/['"]/g, ''); // Remove quotes if present
    
    // Enhanced validation
    if (validatePVName(pvName) && !seenPVs.has(pvName)) {
      // Skip obvious header rows (case insensitive)
      const lowerPV = pvName.toLowerCase();
      if (!lowerPV.includes('pv') && 
          !lowerPV.includes('name') && 
          !lowerPV.includes('variable') &&
          !lowerPV.includes('channel')) {
        pvNames.push(pvName);
        seenPVs.add(pvName);
      }
    }
  }
  
  return pvNames.sort();
}

export function parseCSVPreview(csvContent, maxPreviewLines = 10) {
  if (!csvContent || typeof csvContent !== 'string') {
    return { preview: [], totalLines: 0, estimatedPVs: 0 };
  }

  const lines = csvContent.split('\n').filter(line => line.trim());
  const preview = [];
  let validPVCount = 0;
  
  for (let i = 0; i < Math.min(lines.length, maxPreviewLines); i++) {
    const columns = lines[i].split(',').map(col => col.trim().replace(/['"]/g, ''));
    const pvName = columns[0] || '';
    const isValidPV = validatePVName(pvName);
    
    if (isValidPV) validPVCount++;
    
    preview.push({
      lineNumber: i + 1,
      pvName,
      isValidPV,
      otherColumns: columns.slice(1),
      columnCount: columns.length
    });
  }
  
  // Estimate total valid PVs based on preview
  const validRatio = validPVCount / Math.min(lines.length, maxPreviewLines);
  const estimatedPVs = Math.round(lines.length * validRatio);
  
  return {
    preview,
    totalLines: lines.length,
    estimatedPVs,
    validPVCount,
    validRatio: validRatio * 100
  };
}

export function validateCSVContent(csvContent) {
  if (!csvContent || typeof csvContent !== 'string') {
    return { isValid: false, error: 'CSV content is empty or invalid' };
  }

  const lines = csvContent.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    return { isValid: false, error: 'CSV file is empty' };
  }
  
  if (lines.length > 10000) {
    return { isValid: false, error: 'CSV file too large (max 10,000 lines)' };
  }
  
  // Check if first few lines look like they contain PV names
  const sampleSize = Math.min(lines.length, 10);
  const sampleLines = lines.slice(0, sampleSize);
  let validPVCount = 0;
  let totalColumns = 0;
  
  for (const line of sampleLines) {
    const columns = line.split(',');
    totalColumns = Math.max(totalColumns, columns.length);
    
    const firstColumn = columns[0].trim().replace(/['"]/g, '');
    if (validatePVName(firstColumn)) {
      validPVCount++;
    }
  }
  
  const validRatio = validPVCount / sampleSize;
  
  if (validRatio < 0.1) { // Less than 10% valid PVs
    return { 
      isValid: false, 
      error: `First column does not appear to contain valid PV names (only ${Math.round(validRatio * 100)}% valid)` 
    };
  }
  
  if (validRatio < 0.5) { // 10-50% valid PVs - warning but allow
    return { 
      isValid: true, 
      warning: `Only ${Math.round(validRatio * 100)}% of entries appear to be valid PV names`,
      totalLines: lines.length,
      estimatedValidPVs: Math.round(lines.length * validRatio),
      totalColumns
    };
  }
  
  return { 
    isValid: true, 
    totalLines: lines.length,
    estimatedValidPVs: Math.round(lines.length * validRatio),
    totalColumns,
    validRatio: Math.round(validRatio * 100)
  };
}

// New utility function to detect CSV format
export function detectCSVFormat(csvContent) {
  if (!csvContent) return null;
  
  const lines = csvContent.split('\n').filter(line => line.trim()).slice(0, 5);
  if (lines.length === 0) return null;
  
  // Detect delimiter
  const delimiters = [',', ';', '\t', '|'];
  let bestDelimiter = ',';
  let maxColumns = 0;
  
  for (const delimiter of delimiters) {
    const avgColumns = lines.reduce((sum, line) => {
      return sum + line.split(delimiter).length;
    }, 0) / lines.length;
    
    if (avgColumns > maxColumns) {
      maxColumns = avgColumns;
      bestDelimiter = delimiter;
    }
  }
  
  // Check if first row might be headers
  const firstRow = lines[0].split(bestDelimiter);
  const hasHeaders = firstRow.some(col => 
    col.toLowerCase().includes('pv') || 
    col.toLowerCase().includes('name') ||
    col.toLowerCase().includes('variable')
  );
  
  return {
    delimiter: bestDelimiter,
    estimatedColumns: Math.round(maxColumns),
    hasHeaders,
    sampleFirstRow: firstRow.map(col => col.trim().replace(/['"]/g, ''))
  };
}

// New utility function for batch processing large CSV files
export function processBatchCSV(csvContent, batchSize = 1000) {
const lines = csvContent.split('\n').filter(line => line.trim());
  const batches = [];
  
  for (let i = 0; i < lines.length; i += batchSize) {
    const batch = lines.slice(i, i + batchSize);
    const batchPVs = [];
    
    for (const line of batch) {
      const pvName = line.split(',')[0].trim().replace(/['"]/g, '');
      if (validatePVName(pvName)) {
        batchPVs.push(pvName);
      }
    }
    
    if (batchPVs.length > 0) {
      batches.push({
        startLine: i + 1,
        endLine: Math.min(i + batchSize, lines.length),
        pvNames: batchPVs,
        count: batchPVs.length
      });
    }
  }
  
  return batches;
}