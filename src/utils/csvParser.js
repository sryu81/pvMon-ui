// src/utils/csvParser.js

/**
 * Validates CSV content and checks if it contains valid PV names
 * @param {string} csvContent - Raw CSV content
 * @returns {object} - Validation result with isValid flag and error message
 */
export function validateCSVContent(csvContent) {
  if (!csvContent || csvContent.trim().length === 0) {
    return {
      isValid: false,
      error: 'File is empty or contains no content'
    };
  }

  const lines = csvContent.trim().split('\n').filter(line => line.trim().length > 0);
  
  if (lines.length === 0) {
    return {
      isValid: false,
      error: 'No valid lines found in file'
    };
  }

  // Extract PV names to validate
  const pvNames = extractPVNamesFromCSV(csvContent);
  const validPVCount = pvNames.filter(pv => isValidPVName(pv)).length;
  const validPercentage = Math.round((validPVCount / pvNames.length) * 100);

  if (validPVCount === 0) {
    return {
      isValid: false,
      error: 'No valid PV names found. Make sure PV names are in the first column or each line for text files.'
    };
  }

  if (validPercentage < 50) {
    return {
      isValid: false,
      error: `First column does not appear to contain valid PV names (only ${validPercentage}% valid)`
    };
  }

  return {
    isValid: true,
    validPVCount,
    totalLines: lines.length,
    validPercentage
  };
}

/**
 * Extracts PV names from CSV content
 * Handles both CSV format and line-by-line text format
 * @param {string} csvContent - Raw CSV content
 * @returns {array} - Array of PV names
 */
export function extractPVNamesFromCSV(csvContent) {
  if (!csvContent || csvContent.trim().length === 0) {
    return [];
  }

  const lines = csvContent.trim().split('\n');
  const pvNames = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (line.length === 0) {
      continue;
    }
    
    // Skip comment lines (starting with # or //)
    if (line.startsWith('#') || line.startsWith('//')) {
      continue;
    }
    
    let pvName = '';
    
    // Check if line contains commas (CSV format)
    if (line.includes(',')) {
      // CSV format - take first column
      const columns = parseCSVLine(line);
      pvName = columns[0]?.trim() || '';
    } else {
      // Text format - entire line is PV name
      pvName = line.trim();
    }
    
    // Clean up the PV name
    pvName = cleanPVName(pvName);
    
    // Add if it's a valid PV name
    if (pvName && isValidPVName(pvName)) {
      pvNames.push(pvName);
    }
  }

  // Remove duplicates
  return [...new Set(pvNames)];
}

/**
 * Parses a single CSV line, handling quoted values
 * @param {string} line - CSV line
 * @returns {array} - Array of column values
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current); // Add the last column
  return result;
}

/**
 * Cleans up PV name by removing quotes, extra spaces, etc.
 * @param {string} pvName - Raw PV name
 * @returns {string} - Cleaned PV name
 */
function cleanPVName(pvName) {
  if (!pvName) return '';
  
  return pvName
    .trim()
    .replace(/^["']|["']$/g, '') // Remove surrounding quotes
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();
}

/**
 * Validates if a string is a valid PV name
 * @param {string} pvName - PV name to validate
 * @returns {boolean} - True if valid PV name
 */
function isValidPVName(pvName) {
  if (!pvName || typeof pvName !== 'string') {
    return false;
  }
  
  const trimmed = pvName.trim();
  
  // Basic validation rules for EPICS PV names
  return (
    trimmed.length > 0 &&                    // Not empty
    trimmed.length <= 60 &&                  // EPICS limit is usually 60 chars
    !/^\s*$/.test(trimmed) &&               // Not just whitespace
    !/^[0-9]/.test(trimmed) &&              // Doesn't start with number
    /^[A-Za-z0-9_:.-]+$/.test(trimmed) &&   // Only valid characters
    !trimmed.includes('..') &&              // No double dots
    !trimmed.startsWith(':') &&             // Doesn't start with colon
    !trimmed.endsWith(':')                  // Doesn't end with colon
  );
}

/**
 * Formats validation results for display
 * @param {object} validation - Validation result
 * @returns {string} - Formatted message
 */
export function formatValidationMessage(validation) {
  if (validation.isValid) {
    return `✅ Valid file: Found ${validation.validPVCount} valid PV names (${validation.validPercentage}% valid)`;
  } else {
    return `❌ ${validation.error}`;
  }
}

/**
 * Generates sample CSV content for help/examples
 * @returns {string} - Sample CSV content
 */
export function generateSampleCSV() {
  return `# Sample PV file - Lines starting with # are comments
# You can use either CSV format or one PV per line

# CSV format (first column will be used):
TEMP:SENSOR:01,Temperature Sensor 1,°C
PRESSURE:GAUGE:01,Pressure Gauge 1,PSI
VOLTAGE:SUPPLY:01,Voltage Supply 1,V

# Or simple text format (one PV per line):
CURRENT:METER:01
FLOW:SENSOR:01
LEVEL:INDICATOR:01`;
}