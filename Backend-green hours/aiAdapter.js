import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dataPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'DECKATHLON_modified.json');

/**
 * @returns {Object|null} 
 */
export function getAIData() {
  try {
    //  if file exists to fail early with a clean warning
    if (!fs.existsSync(dataPath)) {
      console.warn("⚠️ Could not read DECKATHLON_modified.json, falling back to mock data");
      return null;
    }
    
    const rawData = fs.readFileSync(dataPath, 'utf8');
    
    return JSON.parse(rawData);
  } catch (error) {
    console.warn(`⚠️ Could not read DECKATHLON_modified.json, falling back to mock data: ${error.message}`);
    return null;
  }
}

