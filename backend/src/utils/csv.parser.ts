import Papa from "papaparse";

export const SALES_CSV_HEADERS = [
  "transactionId",
  "saleDate",
  "productName",
  "category",
  "quantity",
  "unitPrice",
  "totalAmount",
  "paymentMethod",
] as const;

export type SalesCsvRow = Record<(typeof SALES_CSV_HEADERS)[number], string>;

export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvParseError";
  }
}

export function parseSalesCsv(csv: string): SalesCsvRow[] {
  if (!csv.trim()) {
    throw new CsvParseError("The CSV file is empty.");
  }

  const parsedHeader = Papa.parse<string[]>(csv, {
    preview: 1,
    skipEmptyLines: "greedy",
  });
  const headers = parsedHeader.data[0]?.map((header) => header.trim()) ?? [];

  if (headers.length === 0) {
    throw new CsvParseError("The CSV file must include a header row.");
  }

  if (new Set(headers).size !== headers.length) {
    throw new CsvParseError("The CSV file contains duplicate headers.");
  }

  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });
  const fields = result.meta.fields ?? [];

  if (fields.length === 0) {
    throw new CsvParseError("The CSV file must include a header row.");
  }

  const missingHeaders = SALES_CSV_HEADERS.filter(
    (header) => !fields.includes(header)
  );

  if (missingHeaders.length > 0) {
    throw new CsvParseError(
      `Missing required CSV headers: ${missingHeaders.join(", ")}.`
    );
  }

  if (result.errors.length > 0) {
    const error = result.errors[0];
    const location =
      typeof error.row === "number" ? ` on line ${error.row + 2}` : "";
    throw new CsvParseError(`CSV parsing failed${location}: ${error.message}`);
  }

  return result.data.map((row) =>
    Object.fromEntries(
      SALES_CSV_HEADERS.map((header) => [header, row[header] ?? ""])
    ) as SalesCsvRow
  );
}