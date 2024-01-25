const fs = require('fs').promises;
const axios = require('axios');

// Your previous code

async function loadModels() {
    try {
      const modelsRaw = await fs.readFile('./models.json');
      return JSON.parse(modelsRaw);
    } catch (error) {
      console.error('Error loading models:', error.message);
      return [];
    }
  }
  
  // The rest of your code
  

async function isModelOnline(model) {
  try {
    const response = await axios.get(model.website);
    return !response.data.includes('<div class="availability-status offline">Offline</div>');
  } catch (error) {
    console.error(`Error checking model ${model.name} status: ${error.message}`);
    return false;
  }
}

async function checkAndSaveModelStatus() {
  try {
    const loadedModels = await loadModels();

    for (let i = 0; i < loadedModels.length; i++) {
      const model = loadedModels[i];
      const isOnline = await isModelOnline(model);

      // Update the model status and notified flag based on online status
      model.status = isOnline ? 'online' : 'offline';
      model.notified = isOnline ? true : false;
    }

    // Save the updated models to models.json
    await saveModelsToFile(loadedModels);
  } catch (error) {
    console.error('Error checking and saving model statuses:', error.message);
  }
}

async function saveModelsToFile(models) {
  try {
    await fs.writeFile('./models.json', JSON.stringify(models, null, 2));
  } catch (error) {
    console.error('Error saving models:', error.message);
  }
}

// Usage: Call checkAndSaveModelStatus() wherever you want to check and update model statuses.
// For example, you can set up a scheduled task using setInterval to periodically check.
