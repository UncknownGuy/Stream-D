const axios = require('axios');
const fs = require('fs');
const cheerio = require('cheerio');
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const website = 'https://xhamsterlive.com/';
const modelsJsonPath = 'models.json';

const token = process.env.DB_TOKEN;
const channelId = process.env.CHANNEL_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const sendNotificationToDiscord = async (model) => {
  const notificationMessage = `${model.name} goes online`;
  const message = `Model ${model.name} is now online!`;

  try {
    // Fetch the stream image link
    const modelUrl = website + model.name;
    const response = await axios.get(modelUrl);

    if (response.status === 200) {
      const $ = cheerio.load(response.data);
      const imageLink = $('.content').attr('src');

      const embed = {
        color: 0x00ff00, // Green color
        title: notificationMessage,
        description: message,
        image: {
          url: imageLink,
        },
      };

      const channel = client.channels.cache.get(channelId);

      if (channel) {
        channel.send({ embeds: [embed] });
      } else {
        console.error(`Discord channel with ID ${channelId} not found`);
      }
    } else {
      console.error(`Failed to fetch stream image for model ${model.name}. HTTP status: ${response.status}`);
    }
  } catch (error) {
    console.error(`Error fetching stream image for model ${model.name}:`, error.message);
  }
};


const checkAndUpdateModelStatus = async (model) => {
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
          const previousStatus = model.status;
          model.status = isOnline ? 'online' : 'offline';
          model.lastUpdate = new Date().toISOString();

          if (isOnline) {
            // Model goes online, send Discord notification
            sendNotificationToDiscord(model);
          }

          console.log(`Model ${model.name} status updated to ${model.status}`);
          return { model, statusChanged: true, previousStatus };
        } else {
          console.log(`Model ${model.name} status unchanged`);
          return { model, statusChanged: false };
        }
      } else {
        // If the availability status element is not found, assume the model is online
        if (model.status !== 'online') {
          const previousStatus = model.status;
          model.status = 'online';
          model.lastUpdate = new Date().toISOString();

          // Model goes online, send Discord notification
          sendNotificationToDiscord(model);

          console.log(`Model ${model.name} status updated to online`);
          return { model, statusChanged: true, previousStatus };
        } else {
          console.log(`Model ${model.name} status unchanged`);
          return { model, statusChanged: false };
        }
      }
    } else {
      console.error(`Failed to fetch model ${model.name}. HTTP status: ${response.status}`);
      return { model, statusChanged: false };
    }
  } catch (error) {
    console.error(`Error checking model ${model.name} status:`, error.message);
    return { model, statusChanged: false };
  }
};

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  setInterval(async () => {
    // Read the current models.json file
    const modelsJson = JSON.parse(fs.readFileSync(modelsJsonPath, 'utf-8'));

    // Use Promise.all to wait for all asynchronous requests to complete
    const updatePromises = modelsJson.map(checkAndUpdateModelStatus);

    const updatedModels = await Promise.all(updatePromises);

    // Filter models with changed status
    const modelsWithChangedStatus = updatedModels.filter(({ statusChanged }) => statusChanged);

    // Write the updated JSON back to the file after checking all models
    fs.writeFileSync(modelsJsonPath, JSON.stringify(modelsJson, null, 2), 'utf-8');

    // Log the models with changed status
    console.log('Models with changed status:', modelsWithChangedStatus);
  }, 5000); // Check every 5 seconds
});

client.login(token);
