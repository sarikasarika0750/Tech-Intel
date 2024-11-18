const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Reuse browser instance for scraping
let browser;

// Function to scrape data from the provided URL
async function scrapeData(url, page, tag) {
  await page.goto(url, { waitUntil: 'networkidle' });

  // Selector for the "View all" button (same for all pages)
  const viewAllButtonSelector = 'button.v-btn.v-btn--outlined.theme--light.v-size--small.accent--text';

  // Wait for the button to appear and click it if it exists
  try {
    await page.waitForSelector(viewAllButtonSelector, { timeout: 5000 });
    const viewAllButton = await page.$(viewAllButtonSelector);
    if (viewAllButton) {
      await viewAllButton.click();
      console.log('Clicked "View All" button. Waiting for additional content to load...');
      await page.waitForTimeout(3000);
    } else {
      console.log('"View All" button not found.');
    }
  } catch (error) {
    console.log('"View All" button not found or timed out.');
  }

  // Wait for the rows to be visible after clicking the button
  await page.waitForSelector('tbody tr');

  const data = await page.evaluate((tag) => {
    const rows = document.querySelectorAll('tbody tr');
    const scrapedData = [];

    rows.forEach((row) => {
      const rankElement = row.querySelector('td:nth-child(1)');
      const technologyElement = row.querySelector('td:nth-child(2) a');
      const websitesTrackedElement = row.querySelector('td:nth-child(3) a');
      const marketShareElement = row.querySelector('td:nth-child(4) .bar__label');

      const rank = rankElement ? rankElement.innerText.trim() : 'N/A';
      const technologyName = technologyElement ? technologyElement.innerText.trim() : 'N/A';
      const technologyLink = technologyElement ? technologyElement.href : null;
      const websitesTracked = websitesTrackedElement ? websitesTrackedElement.innerText.replace(/,/g, '').trim() : 'N/A';
      const marketShare = marketShareElement ? marketShareElement.innerText.trim() : 'N/A';

      if (technologyName !== 'N/A' && rank !== 'N/A') {
        scrapedData.push({
          rank,
          technologyName,
          technologyLink,
          tag,
          websitesTracked,
          marketShare
        });
      }
    });

    return scrapedData;
  }, tag);

  console.log(`Scraped ${data.length} technologies from ${url}`);
  return data;
}

// Function to append data to existing CSV and JSON files, handling duplicates
function appendDataToFile(data) {
  const csvFilePath = path.join(__dirname, 'Marketing.csv');
  const jsonFilePath = path.join(__dirname, 'Marketing.json');

  // Define the CSV header for the Technology Link
  const csvHeader = 'Rank,Technology Name,Tag,Websites Tracked,Market Share,Description,Image Path,Technology Link\n';

  // Load existing CSV and JSON data to check for duplicates
  let existingCsvData = fs.existsSync(csvFilePath) ? fs.readFileSync(csvFilePath, 'utf-8') : '';
  let existingJsonData = fs.existsSync(jsonFilePath) ? JSON.parse(fs.readFileSync(jsonFilePath)) : [];

  // Split CSV into lines for easier processing
  let csvLines = existingCsvData.split('\n').map(line => line.trim()).filter(line => line);

  // Handle duplicates for each new entry
  data.forEach(newEntry => {
    let csvUpdated = false;
    let jsonUpdated = false;

    // Check if entry already exists in the CSV based on Technology Name
    for (let i = 1; i < csvLines.length; i++) {
      if (csvLines[i].includes(`"${newEntry.technologyName}"`)) {
        const csvFields = csvLines[i].split(',');
        const existingTag = csvFields[2].replace(/"/g, ''); // Extract existing tag

        // Append the new tag if it's not already there
        if (!existingTag.includes(newEntry.tag)) {
          csvFields[2] = `"${existingTag}, ${newEntry.tag}"`;
          csvLines[i] = csvFields.join(',');
        }
        csvUpdated = true;
        break;
      }
    }

    // If CSV not updated, it's a new entry, so add it
    if (!csvUpdated) {
      const csvRow = `${newEntry.rank},"${newEntry.technologyName}","${newEntry.tag}","${newEntry.websitesTracked}","${newEntry.marketShare}","${newEntry.description || 'N/A'}","${newEntry.imagePath || 'N/A'}","${newEntry.technologyLink || 'N/A'}"`;
      csvLines.push(csvRow);
    }

    // Check if entry already exists in the JSON based on Technology Name
    for (let j = 0; j < existingJsonData.length; j++) {
      if (existingJsonData[j].technologyName === newEntry.technologyName) {
        // Append the new tag if it's not already there
        if (!existingJsonData[j].tag.includes(newEntry.tag)) {
          existingJsonData[j].tag += `, ${newEntry.tag}`;
        }
        jsonUpdated = true;
        break;
      }
    }

    // If JSON not updated, it's a new entry, so add it
    if (!jsonUpdated) {
      existingJsonData.push(newEntry);
    }
  });

  // Write back updated CSV file, skipping header if it already exists
  if (existingCsvData) {
    fs.writeFileSync(csvFilePath, csvLines.join('\n') + '\n');
  } else {
    fs.writeFileSync(csvFilePath, csvHeader + csvLines.join('\n') + '\n');
  }
  console.log(`Data appended to ${csvFilePath}`);

  // Write back updated JSON file
  fs.writeFileSync(jsonFilePath, JSON.stringify(existingJsonData, null, 2));
  console.log(`Data appended to ${jsonFilePath}`);
}

// Function to sanitize filenames
function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*]/g, '_'); // Replace invalid characters with underscores
}

// Function to get the correct file extension from a URL
function getFileExtension(url) {
  const ext = path.extname(url);
  return ext ? ext : '.jpg'; // Default to .jpg if no extension found
}

// Function to download images
async function downloadImage(url, technologyName) {
  const sanitizedTechnologyName = sanitizeFilename(technologyName);
  const fileExtension = getFileExtension(url); // Get the correct file extension
  const filePath = path.join(__dirname, 'logos', `${sanitizedTechnologyName}${fileExtension}`); // Use the correct extension

  // Create logos directory if it doesn't exist
  if (!fs.existsSync(path.join(__dirname, 'logos'))) {
    fs.mkdirSync(path.join(__dirname, 'logos'));
  }

  // Make the request and handle the response
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        const file = fs.createWriteStream(filePath);
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`Downloaded image for ${technologyName} to ${filePath}`);
          resolve(filePath); // Resolve with file path
        });
      } else {
        console.error(`Failed to download image for ${technologyName}: ${response.statusCode}`);
        reject(`Failed to download image: ${response.statusCode}`);
      }
    }).on('error', (err) => {
      console.error(`Error downloading image for ${technologyName}:`, err.message);
      reject(err);
    });
  });
}

// Function to scrape description and image from individual technology pages
async function scrapeDescriptionAndLogo(url, page, technologyName) {
  let description, imageUrl;

  // First attempt
  try {
    await page.goto(url, { waitUntil: 'networkidle' });

    description = await page.evaluate(() => {
      const descriptionElement = document.querySelector('.row.align-center .col-sm-8.col-12 .subtitle-1');
      return descriptionElement ? descriptionElement.innerText.trim() : 'Description not found';
    });

    imageUrl = await page.evaluate(() => {
      const imageElement = document.querySelector('.v-image__image');
      const style = imageElement ? imageElement.style.backgroundImage : '';
      const match = style.match(/url\(["']?([^"']+)["']?\)/);
      return match ? match[1] : null;
    });

    // If the image URL is found, return the result
    if (imageUrl) {
      console.log(`Scraped description and image for ${technologyName}: Done, Image URL: ${imageUrl}`);
      return { description, imageUrl };
    } else {
      console.log(`Image URL not found for ${technologyName}. Retrying...`);
    }

  } catch (error) {
    console.error(`Failed to scrape description and logo for ${url}:`, error);
    return { description: 'Description not found', imageUrl: 'Image URL not found after first attempt' };
  }

  // Second attempt if image URL was not found
  try {
    console.log(`Retrying to scrape image URL for ${technologyName}...`);
    await page.reload({ waitUntil: 'networkidle' });

    imageUrl = await page.evaluate(() => {
      const imageElement = document.querySelector('.v-image__image');
      const style = imageElement ? imageElement.style.backgroundImage : '';
      const match = style.match(/url\(["']?([^"']+)["']?\)/);
      return match ? match[1] : null;
    });

    if (imageUrl) {
      console.log(`Successfully scraped image URL for ${technologyName}: ${imageUrl}`);
    } else {
      console.error(`Failed to scrape image URL for ${technologyName} after retry.`);
    }

  } catch (error) {
    console.error(`Error during second attempt to scrape image URL for ${technologyName}:`, error);
  }

  return { description: 'Description not found', imageUrl };
}

// Main scraping function
async function main() {
  // Launch the browser
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Array of technology URLs to scrape (to be filled in as needed)
  const urls = [
    { url: 'https://www.wappalyzer.com/technologies/advertising/', tag: 'advertising'},
    { url: 'https://www.wappalyzer.com/technologies/affiliate-programs/', tag: 'affiliate-programs'},
    { url: 'https://www.wappalyzer.com/technologies/crm/', tag: 'crm'}
    
    // Add more URLs as needed
  ];

  // Iterate over each URL and scrape data
  for (const { url, tag } of urls) {
    const scrapedData = await scrapeData(url, page, tag);

    // Iterate over each scraped entry to get descriptions and logos
    for (const entry of scrapedData) {
      const { description, imageUrl } = await scrapeDescriptionAndLogo(entry.technologyLink, page, entry.technologyName);
      entry.description = description;
      entry.imageUrl = imageUrl;

      // Download the image and get the local path
      if (imageUrl) {
        entry.imagePath = await downloadImage(imageUrl, entry.technologyName);
      }
    }

    // Append data to CSV and JSON files
    appendDataToFile(scrapedData);
  }

  // Close the browser
  await browser.close();
}

// Start the scraping process
main().catch(console.error);
