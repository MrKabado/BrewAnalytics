# BrewAnalytics Synthetic Dataset — 2025

All records in these files are synthetic and were created for academic
demonstration. They do not represent a real coffee shop or real people.
Monetary values are Philippine pesos (PHP), stored as numeric values without
currency symbols.

## Files and worksheet structure

Each Excel file contains exactly one worksheet and one header row:

- `Sales_Transactions.xlsx` — 11,625 sales-line records.
- `Products.xlsx` — 56 catalog records.
- `Customers.xlsx` — 80 synthetic customer records.
- `Marketing_Campaigns.xlsx` — 50 campaign records.
- `Daily_Sales_Summary.xlsx` — 365 daily records for January 1–December 31,
  2025.

## Column definitions

### Sales_Transactions.xlsx

One row represents one product line. `transactionId` repeats when a transaction
contains multiple products.

| Column | Definition |
| --- | --- |
| `transactionId` | Synthetic transaction identifier; repeated across its line items. |
| `saleDate` | Sale date in `YYYY-MM-DD` format. |
| `productName` | Product name, matching `Products.xlsx`. |
| `category` | Product category, matching `Products.xlsx`. |
| `quantity` | Positive whole number of units on this line. |
| `unitPrice` | Per-unit selling price in PHP. |
| `totalAmount` | Line revenue in PHP; `quantity × unitPrice`, rounded to two decimals. |
| `paymentMethod` | Synthetic tender category: Cash, GCash, or Card. |

The columns intentionally match BrewAnalytics' existing legacy sales importer.
The importer does not accept product IDs, customer IDs, or campaign IDs in this
file. Product consistency can therefore be checked by matching product name,
category, and unit price rather than by a sales-line foreign key. Customer and
campaign records are not attributed to these sales.

### Products.xlsx

| Column | Definition |
| --- | --- |
| `productId` | Unique synthetic product key. |
| `productName` | Product name; consistent with sales lines where sold. |
| `category` | Coffee shop category; consistent with sales lines. |
| `unitPrice` | Selling price in PHP; consistent with sales lines. |
| `unitCost` | Synthetic estimated unit cost in PHP, below the selling price. It is not used to calculate profit in the sales file. |
| `productStatus` | `ACTIVE` or `DISCONTINUED`; discontinued products have no generated sales. |

### Customers.xlsx

| Column | Definition |
| --- | --- |
| `customerId` | Unique synthetic customer key. |
| `customerType` | Student, Regular, Walk-in, or Loyalty Member. |
| `ageGroup` | Synthetic age-group category; not a verified demographic. |
| `gender` | Synthetic category or blank. |
| `registrationDate` | Synthetic registration date in `YYYY-MM-DD` format. |

No names or contact details are included. Customers are not linked to sales
because the legacy sales importer has no customer-ID field.

### Marketing_Campaigns.xlsx

| Column | Definition |
| --- | --- |
| `campaignId` | Unique synthetic campaign key. |
| `campaignName` | Synthetic campaign label. |
| `promotionType` | Percentage Discount, Fixed Discount, Bundle Offer, Loyalty Reward, or Seasonal Promotion. |
| `marketingChannel` | Social Media, In-Store Promotion, Email, or Loyalty Program. |
| `startDate`, `endDate` | Campaign dates in `YYYY-MM-DD` format; end is not before start. |
| `marketingCost` | Synthetic campaign cost in PHP. |
| `discountType` | `PERCENTAGE` or `FIXED_AMOUNT`. |
| `discountValue` | Percentage from 0–100 or fixed PHP amount, according to `discountType`. |
| `campaignStatus` | `COMPLETED`, `ACTIVE`, or `INACTIVE`. Inactive campaigns with future dates are planned examples, using a status accepted by the importer. |

The 50 campaigns model a frequently promotional fictional shop. Date overlap
with sales is not attribution and does not establish campaign effectiveness.
The sales file contains no campaign IDs; do not interpret period comparisons
as causal impact, ROI, or return on ad spend.

### Daily_Sales_Summary.xlsx

One row covers each calendar date in 2025, including dates with no sales.
Values are derived from `Sales_Transactions.xlsx`; all dates in this dataset
happen to have sales.

| Column | Definition |
| --- | --- |
| `saleDate` | Calendar date in `YYYY-MM-DD` format. |
| `totalRevenue` | Sum of sales-line `totalAmount` for the date, in PHP. |
| `totalTransactions` | Count of distinct `transactionId` values for the date, not line items. |
| `totalUnitsSold` | Sum of sales-line `quantity` for the date. |
| `averageTransactionValue` | Daily revenue divided by distinct transaction count, rounded to two decimals. |
| `averageSellingPricePerUnit` | Daily revenue divided by units sold, rounded to two decimals. |

If a future adaptation has a date with no sales, both averages should be zero
when their denominator is zero.

## Relationships and assumptions

- Products: `Sales_Transactions.productName` corresponds to
  `Products.productName`; category and price are also consistent. The current
  sales format does not carry `productId`.
- Customers: customer IDs are unique in `Customers.xlsx`, but there is no
  customer foreign key in this legacy sales file.
- Campaigns: campaign IDs are unique in `Marketing_Campaigns.xlsx`, but there
  is no campaign foreign key in this legacy sales file.
- Sales transaction IDs repeat for multi-line purchases; the transaction count
  in the daily summary is distinct by date and ID.
- The data includes synthetic weekday/weekend and seasonal variation. It is
  suitable for application demonstrations and academic exercises, not for
  real-world business decisions or claims of forecast accuracy.
- File generation and import-parser checks do not verify that the configured
  database schema is ready. Database migrations and live authenticated imports
  should be verified in an approved non-production environment before use.
