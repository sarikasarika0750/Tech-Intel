const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');
const csvParser = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');

// Folder path for downloaded logos
const folderPath = path.join(__dirname, 'logos_fetched');

// Ensure the folder exists for saving images
if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath);
}

// Function to download and save images
function downloadImage(url, filename, callback) {
    const file = fs.createWriteStream(filename);
    https.get(url, (response) => {
        response.pipe(file);
        file.on('finish', () => {
            file.close();
            console.log(`Downloaded: ${filename}`);
            callback(null, filename);
        });
    }).on('error', (err) => {
        fs.unlink(filename, () => {}); // Delete the file if there's an error
        console.error(`Error downloading ${filename}: ${err.message}`);
        callback(err, null);
    });
}

async function fetchLogosFromCsv(csvFilePath, jsonFilePath) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const technologyLinks = [];
    const updatedData = [];

    // Read the CSV file and process each technology link
    fs.createReadStream(csvFilePath)
        .pipe(csvParser())
        .on('data', (row) => {
            technologyLinks.push(row);
        })
        .on('end', async () => {
            for (const row of technologyLinks) {
                const link = row['Technology Link'];
                let retries = 2;
                let iconUrl = null;
                let officialUrl = null;

                // Retry mechanism for fetching official website and icon URL
                while (retries > 0 && !iconUrl) {
                    officialUrl = await getOfficialWebsite(link, page);
                    if (officialUrl) {
                        iconUrl = getIconUrl(officialUrl);
                    }
                    retries--;
                }

                if (iconUrl) {
                    // Save every image as .png format
                    const filename = path.join(folderPath, `${path.basename(link, path.extname(link)).replace(/\s+/g, '_')}.png`);
                    
                    await new Promise((resolve) => {
                        downloadImage(iconUrl, filename, (err) => {
                            if (!err) {
                                row['Icon.horse Img'] = filename; // Add image path to CSV row
                                console.log(`Image saved to: ${filename}`);
                            } else {
                                row['Icon.horse Img'] = 'Download failed';
                            }
                            resolve();
                        });
                    });
                } else {
                    row['Icon.horse Img'] = 'Not found';
                }

                updatedData.push(row); // Add the row with updated image path to the data array
            }

            // Write the updated data to CSV
            const csvWriter = createObjectCsvWriter({
                path: csvFilePath,
                header: Object.keys(updatedData[0]).map(key => ({ id: key, title: key }))
            });
            await csvWriter.writeRecords(updatedData);
            console.log('CSV file updated with image paths.');

            // Write the same data to JSON
            fs.writeFileSync(jsonFilePath, JSON.stringify(updatedData, null, 2));
            console.log('JSON file updated with image paths.');

            await browser.close();
        });
}

// Function to fetch the official website from the technology page
async function getOfficialWebsite(technologyPageUrl, page) {
    try {
        await page.goto(technologyPageUrl);
        const officialUrl = await page.evaluate(() => {
            const visitButton = document.querySelector('a[href^="http"]:not([href^="https://www.wappalyzer.com/"])');
            return visitButton ? visitButton.href : null;
        });
        return officialUrl;
    } catch (error) {
        console.error('Error fetching official website:', error);
        return null;
    }
}

// Function to generate the icon URL from the official website
function getIconUrl(url) {
    const hostname = new URL(url).hostname;
    return `https://icon.horse/icon/${hostname}`;
}

// Run the script
const csvFilePath = path.join(__dirname, 'Content.csv'); // Path to your CSV file
const jsonFilePath = path.join(__dirname, 'Content.json'); // Path to your JSON file
fetchLogosFromCsv(csvFilePath, jsonFilePath).catch(error => {
    console.error('Error fetching logos:', error);
});
