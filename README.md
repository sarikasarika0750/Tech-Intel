# 📄 Documentation: Latest Script Intel

## Purpose

This Javascript is designed to connect to Notion via its API and extract structured data from the **Latest Script Intel (**[🔗](https://www.notion.so/21f82cfd6a18803c9df2e1bfd8f2de44?pvs=21)) database. The primary objective is to generate a **JSON representation** of all third-party tech intel products listed within this Notion database.

### Data Sources

The Notion master database currently includes **606 third-party products**, sourced from:

1. **3rd Party Tech Intel (**[🔗](https://www.notion.so/3rd-Party-Tech-Intel-73979b1f013642db9400746ed0ae83e7?pvs=21))
    - Compiled using the **Wappalyzer ecommerce sites list**
    - Signatures extracted using the **Domdog scanner**
    - Supplemented with manual research to identify the company names for the script signatures (or domains)
2. **Tech Intel - New (**[🔗](https://www.notion.so/14b82cfd6a188059b7e8c7a3ddbc94c2?pvs=21))
    - Built scrapping **Wappalyzer Technologies (**[🔗](https://www.wappalyzer.com/technologies/))
    - Products from this scraped data are then mapped to Script Intel files (mentioned below) based on product name and signature (or domains)

### Script Intel Files

The structured data is organized across three JSON files:

- `script-intel-1.json`
- `script-intel-2.json`
- `script-intel-3.json`

> 🔹 These files were created by Lava and team, and contain third-party products data (`Product`, `ProductID`, `Summary`, `Vendor`, `VendorID`, `Domains`, `URLs`, `URLPaths`, etc.) used in ecommerce tech.
> 

---

### What This Script Does

- Connects to the **Notion API** using a hardcoded token
- Queries entries from the **"Latest Script Intel"** database using pagination
- Extracts and normalizes structured fields from each database entry
- Combines multiple identifier fields (e.g., domain, URL path) into a single `signature` string
- Outputs the result into a **timestamped JSON file (**`DDMMYY-HHMM.json` format), named based on the current date and time

---

### Inputs

### API Configuration

- `NOTION_TOKEN` – Bearer token for accessing the Notion API.
- `NOTION_DATABASE_ID` – ID of the “Latest Script Intel” database in Notion.

🔒 These values are **embedded inside the script file** (not read from environment variables or a `.env` file).

---

### Output

- JSON array of third-party product entries
- Filename: `DDMMYY-HHMM.json` (e.g., `310725-1447.json`)
- Each item (or “object”) in the list represents **one product entry** from the Notion database.
Eg:

```json
{
  "Product": "LinkedIn Analytics",
  "Product ID": "ORG-10.11",
  "Vendor": "Microsoft Corp.",
  "Vendor ID": "ORG-10",
  "Tags": "Analytics",
  "signature": "snap.licdn.com",
  "New Justification": "LinkedIn Insight Tag is an analytics solution...",
  "Description": "LinkedIn Insight Tag is a lightweight JavaScript tag..."
}
```

Each entry follows the same format.

---

### Data Structure

Each object (entry) in the output JSON includes the following key properties extracted from Notion:

| Field Name | Data Type | Example Value |
| --- | --- | --- |
| `Product` | `string` | `LinkedIn Analytics` |
| `Product ID` | `string` | `ORG-10.11` |
| `Vendor` | `string` | `Microsoft Corp.` |
| `Vendor ID` | `string` | `ORG-10` |
| `Tags` | `string` | `Analytics` |
| `signature` | `string` | `snap.licdn.com` |
| `New Justification` | `string` | `LinkedIn Insight Tag is an analytics solution that enables conversion tracking, audience building...` *(truncated)* |
| `Description` | `string` | `LinkedIn Insight Tag is a lightweight JavaScript tag...` *(truncated)* |

---

### Reusability Notes

- This script can be reused anytime the **“Latest Script Intel”** Notion DB is updated.
- Make sure that:
    - The DB schema remains the same.
    - The external mapping files are kept up to date.
    - API token remains valid or is rotated securely.
- Signature is same as domain

---