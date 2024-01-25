const axios = require('axios');
const fs = require('fs');
const cheerio = require('cheerio');


const website = 'https://xhamsterlive.com/';
const modelsJsonPath = 'models.json';

const checkModelStatus = async (model) => {
  try {
    const modelUrl = website + model.name;
    const response = await axios.get(modelUrl);

    if (response.status === 200) {
      const $ = cheerio.load(response.data);
      const availabilityStatus = $('.availability-status');

      if (availabilityStatus.length > 0) {
        const isOnline = !availabilityStatus.hasClass('offline');

        // Check if the status has changed
        if (model.status !== undefined && model.status !== (isOnline ? 'online' : 'offline')) {
          model.status = isOnline ? 'online' : 'offline';
          model.lastUpdate = new Date().toISOString();

          console.log(`Model ${model.name} status updated to ${model.status}`);
        } else {
          console.log(`Model ${model.name} status unchanged`);
        }
      } else {
        // If the availability status element is not found, assume the model is online
        if (model.status !== 'online') {
          model.status = 'online';
          model.lastUpdate = new Date().toISOString();

          console.log(`Model ${model.name} status updated to online`);
        } else {
          console.log(`Model ${model.name} status unchanged`);
        }
      }
    } else {
      console.error(`Failed to fetch model ${model.name}. HTTP status: ${response.status}`);
    }
  } catch (error) {
    console.error(`Error checking model ${model.name} status:`, error.message);
  }
};

// Read the current models.json file
const modelsJson = JSON.parse(fs.readFileSync(modelsJsonPath, 'utf-8'));

// Use Promise.all to wait for all asynchronous requests to complete
const updatePromises = modelsJson.map(checkModelStatus);

Promise.all(updatePromises)
  .then(() => {
    // Write the updated JSON back to the file after checking all models
    fs.writeFileSync(modelsJsonPath, JSON.stringify(modelsJson, null, 2), 'utf-8');
  })
  .catch((error) => {
    console.error('Error updating models:', error.message);
  });
