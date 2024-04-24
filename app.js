const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const dotenv = require('dotenv');
const logger = require('./logger');
const res = require('express/lib/response');
const pm2 = require('pm2');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
let cronJob;

const query = `
 query {
    metaobjectByHandle(handle: {handle: "price-drop-main-value", type: "price_drop_custom_app"}) {
      displayName
      fields {
        key
        value
      }
    }
 }
`;



const updateProductVariant = async (variantId, newPrice) => {
    console.log("asdasd", variantId, newPrice)
    const mutation = `
    mutation productVariantUpdate($input: ProductVariantInput!) {
      productVariantUpdate(input: $input) {
        productVariant {
            id

         product{
              id
         }
         price
        }
        userErrors {
          field
          message
        }
      }
    }
 `;

    const variables = {
        "input": {
            "id": variantId,
            "price": newPrice
        }
    };

    try {
        const response = await axios.post(process.env.SHOPIFY_API_URL, {
            query: mutation,
            variables: variables,
        }, {
            headers: {
                'X-Shopify-Access-Token': process.env.SHOPIFY_API_PASSWORD,
                'Content-Type': 'application/json',
            },
        });
        // Capture the start time of the scheduler
        const priceUpdatedTime = new Date();
        await updatePriceUpdatedTime(priceUpdatedTime);
        logger.info('Product variant updated successfully:', response.data);
    } catch (error) {
        logger.error('Error updating product variant:', error);
    }
};

async function getProductNewPrice(variant) {
    const query = `
    query {
        product(id: "${variant}") {
          variants(first: 1) {
            edges {
              node {
                id
                price
              }
            }
          }
        }
      }
`;
    try {
        const response = await axios.post(process.env.SHOPIFY_API_URL, {
            query
        }, {
            headers: {
                'X-Shopify-Access-Token': process.env.SHOPIFY_API_PASSWORD,
                'Content-Type': 'application/json',
            },
        });
        const data = response.data.data.product.variants.edges[0].node;
        console.log("data", data)
        return data;
    } catch (error) {
        logger.error('Error geetting variant data:', error);
        return null;
    }
}


function getRandomPercentage(minStr, maxStr) {
    const min = parseFloat(minStr);
    const max = parseFloat(maxStr);
    const randomPercentage = (Math.random() * (max - min)) + min;
    return parseFloat(randomPercentage.toFixed(1));
}

function applyDiscount(originalPrice, percentage) {
    const discountAmount = originalPrice * (percentage / 100);
    const discountedPrice = originalPrice - discountAmount;
    return parseFloat(discountedPrice.toFixed(2));
}

async function generateNewPrice(variant, productPriceData, drop_from, drop_to) {
    const productData = await getProductNewPrice(variant);
    const productPrice = parseFloat(productData.price);
    const variantId = productData.id;
    // Generate a random percentage
    const randomPercentage = getRandomPercentage(drop_from, drop_to);
    const newPrice = applyDiscount(productPrice, randomPercentage);

    logger.info('Product variant price update values:', { data: { productPrice: productPrice, drop_from: drop_from, drop_to: drop_to, randomPercentageGenerated: randomPercentage, newPrice: newPrice } });
    return { newPrice, variantId };
}

// Function to update the scheduler start time in Shopify
const updateSchedulerStartTime = async (startTime) => {
    // Format the scheduler start time to dd/mm/yyyy hh:mm:ss
    const formattedStartTime = `${startTime.getMonth() + 1}/${startTime.getDate()}/${startTime.getFullYear()} ${startTime.getHours()}:${startTime.getMinutes()}:${startTime.getSeconds()}`;

    // Construct the mutation request
    const mutation = `
    mutation metaobjectUpsert($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
      metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
        userErrors {
          field
          message
        }
      }
    }
    `;

    const variables = {
        "handle": {
            "handle": "price-drop-main-value",
            "type": "price_drop_custom_app"
        },
        "metaobject": {
            "capabilities": {
                "publishable": {
                    "status": "ACTIVE"
                }
            },
            "fields": [
                {
                    "key": "scheduler_started_at",
                    "value": formattedStartTime
                }
            ]
        }
    };

    // Send the mutation request
    try {
        const response = await axios.post(process.env.SHOPIFY_API_URL, {
            query: mutation,
            variables: variables,
        }, {
            headers: {
                'X-Shopify-Access-Token': process.env.SHOPIFY_API_PASSWORD,
                'Content-Type': 'application/json',
            },
        });
        logger.info('metaobject updated:', response.data);
    } catch (error) {
        logger.error('Error updating metaobject:', error);
    }
};

// Function to update the scheduler start time in Shopify
const updatePriceUpdatedTime = async (updateTime) => {
    // Format the scheduler start time to dd/mm/yyyy hh:mm:ss
    const formattedUpdatedTime = `${updateTime.getMonth() + 1}/${updateTime.getDate()}/${updateTime.getFullYear()} ${updateTime.getHours()}:${updateTime.getMinutes()}:${updateTime.getSeconds()}`;

    // Construct the mutation request
    const mutation = `
    mutation metaobjectUpsert($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
      metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
        userErrors {
          field
          message
        }
      }
    }
    `;

    const variables = {
        "handle": {
            "handle": "price-drop-main-value",
            "type": "price_drop_custom_app"
        },
        "metaobject": {
            "capabilities": {
                "publishable": {
                    "status": "ACTIVE"
                }
            },
            "fields": [
                {
                    "key": "price_updated_at",
                    "value": formattedUpdatedTime
                }
            ]
        }
    };

    // Send the mutation request
    try {
        const response = await axios.post(process.env.SHOPIFY_API_URL, {
            query: mutation,
            variables: variables,
        }, {
            headers: {
                'X-Shopify-Access-Token': process.env.SHOPIFY_API_PASSWORD,
                'Content-Type': 'application/json',
            },
        });
        logger.info('metaobject updated:', response.data);
    } catch (error) {
        logger.error('Error updating metaobject:', error);
    }
};

const fetchShopifyData = async () => {
    try {
        const response = await axios.post(process.env.SHOPIFY_API_URL, {
            query,
        }, {
            headers: {
                'X-Shopify-Access-Token': process.env.SHOPIFY_API_PASSWORD,
                'Content-Type': 'application/json',
            },
        });

        const data = response.data.data.metaobjectByHandle;
        console.log('data Executing', data);

        const enable_price_drop = data.fields.find(field => field.key === 'enable_price_drop').value;
        const timeBetweenPriceDrop = parseInt(data.fields.find(field => field.key === 'time_between_price_drop').value);
        const timeCreated = data.fields.find(field => field.key === 'created_at').value;
        const variant = data.fields.find(field => field.key === 'product').value;
        const productPrice = data.fields.find(field => field.key === 'product_original_price').value;
        const drop_from = data.fields.find(field => field.key === 'percentage_drop_from').value;
        const drop_to = data.fields.find(field => field.key === 'percentage_drop_to').value;

        const delay = 10000; // 10 seconds

        // Capture the start time of the scheduler
        const schedulerStartTime = new Date();
        console.log('Scheduler started at:', schedulerStartTime);

        // Update the scheduler start time in Shopify
        await updateSchedulerStartTime(schedulerStartTime);

        // Schedule the initial task
        setTimeout(() => {
            console.log('Executing scheduled task for the first time');
            if (enable_price_drop === 'true') {
                // Schedule the recurring task using node-cron for minutes
                // const cronJob = cron.schedule(`*/${intervalInMinutes} * * * *`, () => {
                cronJob = cron.schedule(`*/${timeBetweenPriceDrop} * * * * *`, async () => {
                    console.log('Executing scheduled task every 10 seconds');
                    const newPriceData = await generateNewPrice(variant, productPrice, drop_from, drop_to);
                    updateProductVariant(newPriceData.variantId, newPriceData.newPrice);
                }, {
                    scheduled: true,
                    timezone: "America/New_York", // Adjust this based on your timezone
                });
            } else {
                stopCronJob();
            }
        }, delay);

    } catch (error) {
        logger.error('Error fetching Shopify data:', error);
    }
};



app.get('/', (req, res) => {
    res.send('Shopify Cron App');
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    // fetchShopifyData();
});

// New endpoint to start the cron job
app.get('/start-cron', async (req, res) => {
    try {
        await fetchShopifyData();
        res.send('Cron job started');
    } catch (error) {
        console.error('Error starting cron job:', error);
        res.status(500).send('Error starting cron job');
    }
});

// New endpoint to stop the cron job
app.get('/stop-cron', (req, res) => {
    const cronJobStopped = stopCronJob();
    if (cronJobStopped) {
        res.send('Cron job stopped');
    } else {
        res.send('No cron job to stop');
    }
});

app.get('/restart-cron', (req, res) => {
    const cronJobStopped = stopCronJob();
    if (cronJobStopped) {
        fetchShopifyData();
        res.send('Cron job restarted');
    } else {
        res.send('No cron job to stop');
    }
});

app.get('/restart', (req, res) => {
    pm2.connect(() => {
        pm2.restart('app.js', (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Error restarting application');
            }
            res.send('Application restarted successfully');
        });
    });
});

function stopCronJob() {
    if (cronJob) {
        cronJob.stop();
        return true;
    } else {
        console.log('No cron job to stop');
        return false;
    }
}