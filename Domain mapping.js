const fs = require('fs');
const csv = require('csv-parser');
const fastCsv = require('fast-csv');

// Function to normalize domain names
function normalizeDomain(domain) {
    return domain
        .toLowerCase()
        .replace(/[^a-z0-9\s.]/gi, '') // Remove special characters but keep periods for domain names
        .trim(); // Remove extra spaces
}

// Function to check domain match
function checkDomainMatch(domain1, domain2) {
    if (!domain1 || !domain2) return false;

    domain1 = normalizeDomain(domain1);
    domain2 = normalizeDomain(domain2);

    return domain1 === domain2; // Exact match
}

// Main function to process files and find unique domain matches
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

                    // Process and find the best domain matches
                    const results = [];
                    for (const row1 of file1Data) {
                        for (const row2 of file2Data) {
                            if (matchedProducts.has(row2.Product)) continue; // Skip already matched products

                            // Check if domains match
                            const domainMatch = checkDomainMatch(row1.domains, row2.MatchDomains);
                            if (domainMatch) {
                                results.push({
                                    Product1: row1.Product,
                                    Product2: row2.Product,
                                    DomainMatch: 1
                                });

                                matchedProducts.add(row2.Product); // Mark product as matched
                            }
                        }
                    }

                    // Write results to CSV
                    const ws = fs.createWriteStream(outputPath);
                    fastCsv
                        .write(results, { headers: true })
                        .pipe(ws)
                        .on('finish', () => {
                            console.log(`Mapped and unique domain matches written to ${outputPath}`);
                        });
                });
        });
}

// Run the script with file paths
const file1Path = './wappalyzer_combined__NoDuplicates.csv'; // Update with actual path
const file2Path = './Tech_products_list_cleaned.csv'; // Update with actual path
const outputPath = './final_unique_domain_matches.csv';

processFiles(file1Path, file2Path, outputPath);
