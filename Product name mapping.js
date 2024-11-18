const fs = require('fs');
const csv = require('csv-parser');
const fastCsv = require('fast-csv');

// Function to normalize product names
function normalizeProductName(productName) {
    return productName
        .toLowerCase()
        .replace(/[^a-z0-9\s]/gi, '') // Remove special characters
        .trim(); // Remove extra spaces
}

// Function to tokenize product names
function tokenizeProductName(productName) {
    return normalizeProductName(productName).split(/\s+/);
}

// Function to calculate similarity score (front-to-back word sequence)
function calculateSimilarity(product1, product2) {
    const tokens1 = tokenizeProductName(product1);
    const tokens2 = tokenizeProductName(product2);

    let score = 0;
    let index = 0;

    // Compare sequentially from the beginning
    while (index < tokens1.length && index < tokens2.length) {
        if (tokens1[index] === tokens2[index]) {
            score += 1; // Increment score for each matching word
        } else {
            break; // Stop when the sequence breaks
        }
        index++;
    }

    return score / Math.max(tokens1.length, tokens2.length); // Normalize score
}

// Main function to process files and find unique best matches
function processFiles(file1Path, file2Path, outputPath) {
    const file1Data = [];
    const file2Data = [];
    const matchedProducts = new Set(); // To track already matched products from File 2

    // Read File 1
    fs.createReadStream(file1Path)
        .pipe(csv())
        .on('data', (row) => file1Data.push(row))
        .on('end', () => {
            console.log('File 1 loaded.');

            // Read File 2
            fs.createReadStream(file2Path)
                .pipe(csv())
                .on('data', (row) => file2Data.push(row))
                .on('end', () => {
                    console.log('File 2 loaded.');

                    // Process and find the best matches
                    const results = [];
                    for (const row1 of file1Data) {
                        let bestMatch = null;
                        let highestScore = 0;

                        for (const row2 of file2Data) {
                            if (matchedProducts.has(row2.Product)) continue; // Skip already matched products

                            const similarityScore = calculateSimilarity(row1.Product, row2.Product);
                            if (similarityScore > highestScore) {
                                highestScore = similarityScore;
                                bestMatch = row2;
                            }
                        }

                        // Record the best match if it exists
                        if (bestMatch) {
                            results.push({
                                Product1: row1.Product,
                                Product2: bestMatch.Product,
                                SimilarityScore: highestScore.toFixed(2)
                            });

                            matchedProducts.add(bestMatch.Product); // Mark product as matched
                        }
                    }

                    // Write results to CSV
                    const ws = fs.createWriteStream(outputPath);
                    fastCsv
                        .write(results, { headers: true })
                        .pipe(ws)
                        .on('finish', () => {
                            console.log(`Unique best matches written to ${outputPath}`);
                        });
                });
        });
}

// Run the script with file paths
const file1Path = './wappalyzer_combined__NoDuplicates.csv'; // Update with actual path
const file2Path = './Tech_products_list_cleaned.csv'; // Update with actual path
const outputPath = './unique_best_matches.csv';

processFiles(file1Path, file2Path, outputPath);


