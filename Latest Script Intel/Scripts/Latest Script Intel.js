const { Client } = require("@notionhq/client");
const fs = require("fs");

// 🔐 Notion credentials
const notion = new Client({
  auth: "secret_oxXcOM3LmS0m8HlutvRqytoflZzGmtVPZHLEgrOEw6Y"
});
const databaseId = "21f82cfd6a18803c9df2e1bfd8f2de44";

// ✅ Keys you want in final output (excluding identifiers)
const baseKeys = [
  "Product",
  "Product ID",
  "Vendor",
  "Vendor ID",
  "Tags",
  "New Justification",
  "Description"
];

// 🔄 These go into the combined signature field
const signatureFields = [
  "Identifier[domain]",
  "Identifier[url]",
  "Identifier[filename]",
  "Identifier[urlpath]",
  "Identifier[source]"
];

// 🔧 Parse and clean Notion properties
async function parseProperty(prop) {
  switch (prop.type) {
    case "title":
      return prop.title.map(t => t.plain_text).join('');
    case "rich_text":
      return prop.rich_text.map(t => t.plain_text).join('');
    case "select":
      return prop.select?.name || "";
    case "multi_select":
      return prop.multi_select.map(i => i.name).join(', ');
    case "people":
      return prop.people.map(p => p.name || p.id).join(', ');
    case "number":
      return prop.number?.toString() || "";
    case "url":
      return prop.url || "";
    case "email":
      return prop.email || "";
    case "phone_number":
      return prop.phone_number || "";
    case "checkbox":
      return prop.checkbox.toString();
    case "date":
      return prop.date?.start || "";
    case "files":
      return prop.files.map(f => f.name || f.external?.url || f.file?.url).join(', ');
    default:
      return "";
  }
}

// 🚀 Fetch data from Notion and export as timestamped JSON
async function fetchAndExportJSON() {
  const data = [];
  let cursor;

  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
    });

    for (const page of response.results) {
      const raw = page.properties;
      const row = {};

      // Collect base fields
      for (const key of baseKeys) {
        if (raw[key]) {
          row[key] = await parseProperty(raw[key]);
        }
      }

      // Collect and merge signature fields
      const signatureParts = [];
      for (const key of signatureFields) {
        if (raw[key]) {
          let value = await parseProperty(raw[key]);
          if (value && value.trim()) {
            value = value.replace(/\n/g, ",");
            signatureParts.push(value.trim());
          }
        }
      }

      // Reorder and insert signature
      const reorderedRow = {};
      for (const key of baseKeys) {
        reorderedRow[key] = row[key] || "";
        if (key === "Tags") {
          reorderedRow["signature"] = signatureParts.join(",");
        }
      }

      data.push(reorderedRow);
    }

    cursor = response.has_more ? response.next_cursor : null;
  } while (cursor);

  // 📁 Generate filename using DDMMYY-HHMM format
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const HH = String(now.getHours()).padStart(2, '0');
  const MM = String(now.getMinutes()).padStart(2, '0');
  const filename = `${dd}${mm}${yy}-${HH}${MM}.json`;

  // 💾 Write data to file
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  console.log(`✅ Exported to ${filename}`);
}

fetchAndExportJSON();
