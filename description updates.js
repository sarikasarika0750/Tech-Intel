const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');

async function scrapeDescriptionAndImage(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle' });

    const [description, imageUrl] = await page.evaluate(() => {
      const descElement = document.querySelector('.col-sm-8.col-12 p');
      const imageElement = document.querySelector('.v-image__image'); // Adjust the selector based on the actual image element
      const bgImage = imageElement ? window.getComputedStyle(imageElement).backgroundImage : '';
      const urlMatch = bgImage.match(/url\(["']?([^"']+)["']?\)/);

      return [
        descElement ? descElement.innerText.trim() : null,
        urlMatch ? urlMatch[1] : null // Extract the URL from the background-image style
      ];
    });

    return { description, imageUrl };
  } catch (error) {
    console.error(`Error scraping from ${url}:`, error.message);
    return { description: null, imageUrl: null };
  }
}

function downloadImage(url, filename) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filename);
    const request = https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get image: ${response.statusCode}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve); // Close the file when done
      });
    });

    request.on('error', (err) => {
      fs.unlink(filename, () => reject(err)); // Delete the file if there's an error
    });
  });
}

async function updateDescriptions() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Read the CSV and JSON files
  const csvPath = path.join(__dirname, 'Content.csv');
  const jsonPath = path.join(__dirname, 'Content.json');

  let csvContent = fs.readFileSync(csvPath, 'utf-8');
  let jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  // Convert CSV to array of objects for easier processing
  let csvLines = csvContent.split('\n').map(line => line.trim()).filter(line => line);
  let headers = csvLines[0].split(',');

  // Track updates
  let updatedCount = 0;
  let updatedCSVLines = [...csvLines];  // Create a copy for updated CSV
  let updatedJSONContent = JSON.parse(JSON.stringify(jsonContent));  // Deep copy for updated JSON

  console.log('\n=== Starting Description Updates ===\n');

  // Ensure logos directory exists
  const logosDir = path.join(__dirname, 'logos');
  if (!fs.existsSync(logosDir)) {
    fs.mkdirSync(logosDir);
  }

  // Process each line in CSV
  for (let i = 1; i < csvLines.length; i++) {
    const fields = csvLines[i].split(',').map(field => field.replace(/^"/, '').replace(/"$/, ''));
    const record = {};
    headers.forEach((header, index) => {
      record[header] = fields[index];
    });

    // Check if description is "Description not found"
    if (record['Description'] === 'Description not found' && record['Technology Link']) {
      console.log('\n-----------------------------------');
      console.log(`Processing: ${record['Technology Name']}`);
      console.log(`Rank: ${record['Rank']}`);
      console.log(`URL: ${record['Technology Link']}`);

      const { description, imageUrl } = await scrapeDescriptionAndImage(page, record['Technology Link']);

      if (description) {
        console.log('\nFound new description:');
        console.log('----------------------');
        console.log(description);
        console.log('----------------------');

        // Update CSV line
        fields[headers.indexOf('Description')] = `"${description}"`;
        updatedCSVLines[i] = fields.join(',');

        // Update JSON
        const jsonIndex = updatedJSONContent.findIndex(item => 
          item.technologyName === record['Technology Name']);
        if (jsonIndex !== -1) {
          updatedJSONContent[jsonIndex].description = description;

          if (imageUrl) {
            // Determine the file extension based on the URL
            const fileExtension = path.extname(imageUrl) || '.png'; // Default to .png if no extension found
            const sanitizedTechName = record['Technology Name'].replace(/[/\s]+/g, '-').toLowerCase(); // Replace / with - and spaces with _
            const imageName = `${sanitizedTechName}${fileExtension}`;
            const imagePath = path.join(logosDir, imageName);
            await downloadImage(imageUrl, imagePath);

            // Update Image Path in CSV and JSON with sanitized path
            fields[headers.indexOf('Image Path')] = imagePath; // Update CSV with the new sanitized image path
            updatedJSONContent[jsonIndex].imagePath = imagePath; // Update JSON with the new sanitized image path
            console.log('✓ Image downloaded successfully');
          } else {
            console.log('❌ No image found');
          }
        }

        updatedCount++;
        console.log('✓ Description updated successfully');
      } else {
        console.log('❌ Failed to find description');
      }
    }
  }

  // Write updated content back to new files
  const updatedCSVPath = path.join(__dirname, 'Content-updated.csv');
  const updatedJSONPath = path.join(__dirname, 'Content-updated.json');

  fs.writeFileSync(updatedCSVPath, updatedCSVLines.join('\n'));
  fs.writeFileSync(updatedJSONPath, JSON.stringify(updatedJSONContent, null, 2));

  await browser.close();

  console.log('\n=== Update Summary ===');
  console.log(`Total descriptions updated: ${updatedCount}`);
  console.log(`Updated CSV file created: ${updatedCSVPath}`);
  console.log(`Updated JSON file created: ${updatedJSONPath}`);
  console.log('===================\n');
}

// Run the update
(async () => {
  try {
    await updateDescriptions();
  } catch (error) {
    console.error('Error running update script:', error);
  }
})();
