const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

require('dotenv').config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const models = loadModels(); // Load models from the file on bot start

// Function to load models from models.json file
function loadModels() {
  try {
    const data = fs.readFileSync('./models.json', 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading models:', error);
    return {};
  }
}

// Function to save models to models.json file
function saveModelsToFile() {
  fs.writeFileSync('./models.json', JSON.stringify(models, null, 2), 'utf-8');
}

// Function to check if a model is online
async function isModelOnline(modelURL) {
  try {
    const response = await axios.get(modelURL);
    return !response.data.includes('<div class="availability-status offline">Offline</div>');
  } catch (error) {
    console.error('Error checking model status:', error);
    throw new Error('Error checking model status. Please try again.');
  }
}

bot.onText(/\/notify/, async (msg) => {
  const chatId = msg.chat.id;
  const loadedModels = loadModels();
  const keyboardButtons = Object.keys(loadedModels).map((modelName) => ({
    text: modelName,
    callback_data: `notify_${modelName}`
  }));

  const keyboard = {
    inline_keyboard: [keyboardButtons]
  };

  bot.sendMessage(chatId, 'Choose a model to receive notifications:', {
    reply_markup: keyboard
  });
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const modelName = query.data.replace('notify_', '');

  try {
    await notifyUserIfOnline(modelName, chatId);

    // Start listening for changes in the model's status
    startListeningForStatusChanges(modelName, chatId);
  } catch (error) {
    console.error('Error handling callback:', error);
    bot.sendMessage(chatId, 'Error handling callback. Please try again.');
  }
});
function startListeningForStatusChanges(modelName, chatId) {
  setInterval(async () => {
    try {
      const isOnline = await isModelOnline(models[modelName].url);
      if (isOnline) {
        await notifyUserIfOnline(modelName, chatId);
      }
    } catch (error) {
      console.error('Error checking model status:', error);
    }
  }, 60000); // Check every 1 minute (adjust as needed)
}



async function notifyUserIfOnline(modelName, chatId) {
  const loadedModels = loadModels();
  const model = loadedModels[modelName];

  if (model) {
    try {
      const isOnline = await isModelOnline(model.url);
      if (isOnline) {
        const imageURL = model.url;
        const notificationMessage = `Model "${modelName}" is now online!`;

        // Send the photo along with the notification message
        if (imageURL) {
          await bot.sendPhoto(chatId, imageURL, {
            caption: notificationMessage
          });

          // Update the model status and save to models.json
          model.status = 'online';
          saveModelsToFile(loadedModels);
        } else {
          console.error('Image not found');
          bot.sendMessage(chatId, 'Image not found');
        }
      }
    } catch (error) {
      console.error('Error checking model status:', error);
      throw new Error('Error checking model status. Please try again.');
    }
  } else {
    throw new Error(`Model "${modelName}" not found.`);
  }
}



bot.onText(/\/check (.+)/, async (msg, match) => {
  const modelName = match[1];

  try {
    const modelURL = `https://xhamsterlive.com/${modelName}`;
    const response = await axios.get(modelURL);
    const $ = cheerio.load(response.data);

    // Check if the model is online
    const isOnline = !response.data.includes('<div class="availability-status offline">Offline</div>');

    // Determine the appropriate image link based on online or offline status
    let imageURL;
    if (isOnline) {
      imageURL = modelURL;  // Use the modelURL if online
    } else {
      // Use the image link from the specified structure if offline
      imageURL = $('.wrapper .main .strut.view-cam-resizer-boundary-y .big-height.poster.view-cam-resizer-player .backdrop img.image-background').attr('src');
    }

    // Extract the offline time from the specific structure
    const offlineTime = $('.vc-status-offline-inner .offline-status-time').text().trim();

    // Log the extracted image link and offline time to the console for debugging
    console.log('Image Link:', imageURL);
    console.log('Offline Time:', offlineTime);

    // Create inline keyboard
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: `Watch ${modelName} Live`,
            url: modelURL
          }
        ]
      ]
    };

    // Send the status message with the appropriate image, offline time, and inline keyboard
    if (imageURL) {
      const statusMessage = isOnline ? 'Model is online' : `Model is offline. ${offlineTime}`;
      bot.sendPhoto(msg.chat.id, imageURL, {
        caption: statusMessage,
        reply_markup: keyboard
      }).catch((error) => {
        console.error('Error sending photo:', error);
        bot.sendMessage(msg.chat.id, 'Error sending photo');
      });
    } else {
      console.error('Image not found');
      bot.sendMessage(msg.chat.id, 'Image not found');
    }
  } catch (error) {
    console.error('Error checking model status:', error);
    bot.sendMessage(msg.chat.id, 'Error checking model status');
  }
});





bot.onText(/\/.*/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Unknown command. Use /add, /check, /notify, or /stopnotify.');
});
