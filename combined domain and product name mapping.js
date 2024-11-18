const fs = require('fs');
const csv = require('csv-parser');
const fastCsv = require('fast-csv');

// Function to load CSV data
function loadCsvData(filePath) {
    return new Promise((resolve, reject) => {
        const data = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => data.push(row))
            .on('end', () => resolve(data))
            .on('error', (err) => reject(err));
    });
}

// Function to combine unique products from both files, while keeping scores
async function getUniqueProductsWithScores(file1Path, file2Path, outputPath) {
    try {
        // Load both CSV files
        const file1Data = await loadCsvData(file1Path);
        const file2Data = await loadCsvData(file2Path);

        // Create a Map to store unique Product1 names with associated data (including score)
        const uniqueProducts = new Map();
        
        // Process file1 data
        for (const row of file1Data) {
            const product1 = row.Product1;
            if (!uniqueProducts.has(product1)) {
                // Store the entire row, including product and score, if not already in the Map
                uniqueProducts.set(product1, row);
            }
            // If the product is already in the Map, you could choose to retain the row with the highest score
            // Example: Compare SimilarityScore and retain the one with the higher score
            else {
                const existingRow = uniqueProducts.get(product1);
                if (parseFloat(row.SimilarityScore) > parseFloat(existingRow.SimilarityScore)) {
                    uniqueProducts.set(product1, row); // Update with higher score
                }
            }
        }

        // Process file2 data
        for (const row of file2Data) {
            const product1 = row.Product1;
            if (!uniqueProducts.has(product1)) {
                // Add new product from file2
                uniqueProducts.set(product1, row);
            }
            // If the product is already in the Map, compare scores again
            else {
                const existingRow = uniqueProducts.get(product1);
                if (parseFloat(row.SimilarityScore) > parseFloat(existingRow.SimilarityScore)) {
                    uniqueProducts.set(product1, row); // Update with higher score
                }
            }
        }

        // Convert the Map to an array of rows for output
        const combinedResults = Array.from(uniqueProducts.values());

        // Write the unique products with scores to a new CSV file
        const ws = fs.createWriteStream(outputPath);
        fastCsv
            .write(combinedResults, { headers: true })
            .pipe(ws)
            .on('finish', () => {
                console.log(`Unique products with scores written to ${outputPath}`);
            });

    } catch (error) {
        console.error('Error processing the files:', error);
    }
}

// Run the script with file paths
const file1Path = 'C:\\Users\\Saraka\\Desktop\\final_unique_domain_matches.csv'; // Update with actual path
const file2Path = 'C:\\Users\\Saraka\\Desktop\\unique_best_matches.csv'; // Update with actual path
const outputPath = 'C:\\Users\\Saraka\\Desktop\\unique_combined_products_with_scores.csv'; // Output path

getUniqueProductsWithScores(file1Path, file2Path, outputPath);
