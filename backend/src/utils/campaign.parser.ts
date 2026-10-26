import * as XLSX from "xlsx";
import { ExcelParseError, readExcelWorkbook } from "./excel.parser";

export type CampaignDiscountType = "PERCENTAGE" | "FIXED_AMOUNT";
export type CampaignStatus = "ACTIVE" | "INACTIVE" | "COMPLETED" | "CANCELLED";

export interface CampaignImportRow {
  campaignId: string;
  campaignName: string;
  promotionType: string;
  campaignChannel: string;
  startDate: Date;
  endDate: Date;
  marketingCost: string;
  discountPercentage: string;
  discountType: CampaignDiscountType | null;
  discountValue: string | null;
  status: CampaignStatus | null;
  sourceRow: number;
}

export interface CampaignWorksheetErrors {
  worksheet: string;
  rejectedRows: number[];
  errors: string[];
}

export class CampaignParseError extends Error {
  constructor(
    message: string,
    readonly worksheetErrors: CampaignWorksheetErrors[] = [],
  ) {
    super(message);
    this.name = "CampaignParseError";
  }
}

export interface ParsedCampaignWorkbook {
  worksheetName: string;
  worksheetNames: string[];
  campaigns: CampaignImportRow[];
}

const CAMPAIGN_HEADERS = {
  campaignId: ["campaignid"],
  campaignName: ["campaignname"],
  promotionType: ["promotiontype"],
  campaignChannel: ["marketingchannel", "campaignchannel", "channel"],
  startDate: ["startdate"],
  endDate: ["enddate"],
  marketingCost: ["marketingcost"],
  discountType: ["discounttype"],
  discountValue: ["discountvalue"],
  discountPercentage: ["discountpercentage", "discountpercent"],
  status: ["campaignstatus", "status"],
} as const;

type CampaignField = keyof typeof CAMPAIGN_HEADERS;

const DISCOUNT_TYPES = new Set<CampaignDiscountType>([
  "PERCENTAGE",
  "FIXED_AMOUNT",
]);
const CAMPAIGN_STATUSES = new Set<CampaignStatus>([
  "ACTIVE",
  "INACTIVE",
  "COMPLETED",
  "CANCELLED",
]);

function normalizeName(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
}

function cellString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }
  return String(value).trim();
}

function rowIsBlank(row: unknown[]): boolean {
  return row.every((value) => cellString(value) === "");
}

function parseDate(value: unknown): Date | undefined {
  let year: number;
  let month: number;
  let day: number;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    year = value.getUTCFullYear();
    month = value.getUTCMonth() + 1;
    day = value.getUTCDate();
  } else if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return undefined;
    year = parsed.y;
    month = parsed.m;
    day = parsed.d;
  } else {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cellString(value));
    if (!match) return undefined;
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }
  return date;
}

function parseMoney(value: unknown): string | undefined {
  const text = cellString(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return undefined;
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount > 9999999999.99) return undefined;
  return amount.toFixed(2);
}

function parseSheet(
  worksheetName: string,
  worksheet: XLSX.WorkSheet | undefined,
): CampaignImportRow[] {
  if (!worksheet || !worksheet["!ref"]) {
    throw new CampaignParseError(`Worksheet "${worksheetName}" is empty.`, [
      {
        worksheet: worksheetName,
        rejectedRows: [],
        errors: ["Worksheet is empty."],
      },
    ]);
  }

  const invalidCells = Object.entries(worksheet).flatMap(([address, cell]) => {
    if (address.startsWith("!") || typeof cell !== "object" || cell === null) {
      return [];
    }
    const kind =
      "f" in cell
        ? "formula cells are not supported"
        : "t" in cell && cell.t === "e"
          ? "Excel error cells are not supported"
          : undefined;
    return kind
      ? [{ row: XLSX.utils.decode_cell(address).r + 1, address, kind }]
      : [];
  });
  if (invalidCells.length) {
    const rejectedRows = [...new Set(invalidCells.map(({ row }) => row))].sort(
      (a, b) => a - b,
    );
    throw new CampaignParseError(
      `Worksheet "${worksheetName}" contains formula or Excel error cells.`,
      [
        {
          worksheet: worksheetName,
          rejectedRows,
          errors: invalidCells.map(
            ({ row, address, kind }) =>
              `${worksheetName} row ${row}: ${address}: ${kind}.`,
          ),
        },
      ],
    );
  }

  let grid: unknown[][];
  try {
    grid = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      raw: true,
      defval: "",
      blankrows: true,
    });
  } catch {
    throw new CampaignParseError(
      `Worksheet "${worksheetName}" could not be read.`,
    );
  }
  const headers = (grid[0] ?? []).map((value) =>
    normalizeName(cellString(value)),
  );
  if (!headers.length || headers.every((header) => !header)) {
    throw new CampaignParseError(
      `Worksheet "${worksheetName}" is missing its header row.`,
      [
        {
          worksheet: worksheetName,
          rejectedRows: [],
          errors: ["Missing header row."],
        },
      ],
    );
  }

  const duplicateHeaders = new Set<string>();
  const seenHeaders = new Set<string>();
  for (const header of headers) {
    if (header && seenHeaders.has(header)) duplicateHeaders.add(header);
    seenHeaders.add(header);
  }
  if (duplicateHeaders.size) {
    throw new CampaignParseError(
      `Worksheet "${worksheetName}" contains duplicate headers: ${[...duplicateHeaders].join(", ")}.`,
      [
        {
          worksheet: worksheetName,
          rejectedRows: [],
          errors: [`Duplicate headers: ${[...duplicateHeaders].join(", ")}.`],
        },
      ],
    );
  }

  const indexes = new Map<CampaignField, number>();
  for (const field of Object.keys(CAMPAIGN_HEADERS) as CampaignField[]) {
    const aliases: readonly string[] = CAMPAIGN_HEADERS[field];
    const matches = headers.flatMap((header, index) =>
      aliases.includes(header) ? [index] : [],
    );
    if (matches.length > 1) {
      throw new CampaignParseError(
        `Worksheet "${worksheetName}" has ambiguous headers for ${field}.`,
        [
          {
            worksheet: worksheetName,
            rejectedRows: [],
            errors: [`Ambiguous headers for ${field}.`],
          },
        ],
      );
    }
    if (matches.length === 1) indexes.set(field, matches[0]);
  }
  if (indexes.has("discountValue") && indexes.has("discountPercentage")) {
    throw new CampaignParseError(
      `Worksheet "${worksheetName}" has both Discount Value and Discount Percentage columns.`,
      [
        {
          worksheet: worksheetName,
          rejectedRows: [],
          errors: ["Provide Discount Value or Discount Percentage, not both."],
        },
      ],
    );
  }

  const required: CampaignField[] = [
    "campaignId",
    "campaignName",
    "promotionType",
    "campaignChannel",
    "startDate",
    "endDate",
    "marketingCost",
  ];
  const missing = required.filter((field) => !indexes.has(field));
  if (missing.length) {
    throw new CampaignParseError(
      `Worksheet "${worksheetName}" is missing required headers: ${missing.join(", ")}.`,
      [
        {
          worksheet: worksheetName,
          rejectedRows: [],
          errors: [`Missing required headers: ${missing.join(", ")}.`],
        },
      ],
    );
  }

  const errors: string[] = [];
  const rejectedRows = new Set<number>();
  const candidates = grid.slice(1).flatMap((values, index) => {
    if (rowIsBlank(values)) return [];
    const sourceRow = index + 2;
    const get = (field: CampaignField) =>
      indexes.has(field) ? values[indexes.get(field)!] : undefined;
    const rowErrors: string[] = [];
    const addError = (field: string, message: string) =>
      rowErrors.push(`${worksheetName} row ${sourceRow}: ${field} ${message}.`);
    const requiredText = (field: CampaignField): string => {
      const text = cellString(get(field));
      if (!text) addError(field, "is required");
      return text;
    };

    const campaignId = requiredText("campaignId");
    const campaignName = requiredText("campaignName");
    const promotionType = requiredText("promotionType");
    const campaignChannel = requiredText("campaignChannel");
    const startDate = parseDate(get("startDate"));
    const endDate = parseDate(get("endDate"));
    const marketingCost = parseMoney(get("marketingCost"));
    if (!startDate)
      addError("startDate", "must be a valid YYYY-MM-DD or Excel date");
    if (!endDate)
      addError("endDate", "must be a valid YYYY-MM-DD or Excel date");
    if (startDate && endDate && endDate < startDate) {
      addError("endDate", "must not be earlier than startDate");
    }
    if (marketingCost === undefined) {
      addError(
        "marketingCost",
        "must be a nonnegative amount with at most two decimal places",
      );
    }

    const rawDiscountType = cellString(get("discountType")).toUpperCase();
    const rawDiscountValue = cellString(get("discountValue"));
    const rawDiscountPercentage = cellString(get("discountPercentage"));
    let discountType: CampaignDiscountType | null = null;
    let discountValue: string | null = null;
    let discountPercentage = "0.00";

    if (rawDiscountType || rawDiscountValue || rawDiscountPercentage) {
      if (
        rawDiscountType &&
        !DISCOUNT_TYPES.has(rawDiscountType as CampaignDiscountType)
      ) {
        addError("discountType", "must be PERCENTAGE or FIXED_AMOUNT");
      } else if (rawDiscountType) {
        discountType = rawDiscountType as CampaignDiscountType;
      }

      const effectiveType =
        discountType ?? (rawDiscountPercentage ? "PERCENTAGE" : null);
      if (
        rawDiscountPercentage &&
        effectiveType === "FIXED_AMOUNT" &&
        !rawDiscountValue
      ) {
        addError(
          "discountType",
          "cannot be FIXED_AMOUNT when using a Discount Percentage column",
        );
      }
      const rawValue =
        rawDiscountValue ||
        (effectiveType === "PERCENTAGE" ? rawDiscountPercentage : "");
      if (!effectiveType) {
        addError(
          "discountType",
          "is required when a discount value is provided",
        );
      } else if (!rawValue) {
        addError(
          "discountValue",
          "is required when a discount type is provided",
        );
      } else {
        const parsedValue = parseMoney(rawValue);
        if (parsedValue === undefined) {
          addError(
            "discountValue",
            "must be a nonnegative amount with at most two decimal places",
          );
        } else if (
          effectiveType === "PERCENTAGE" &&
          Number(parsedValue) > 100
        ) {
          addError(
            "discountValue",
            "must be between 0 and 100 for percentage discounts",
          );
        } else {
          discountType = effectiveType;
          discountValue = parsedValue;
          if (effectiveType === "PERCENTAGE") discountPercentage = parsedValue;
        }
      }
    }

    const rawStatus = cellString(get("status")).toUpperCase();
    let status: CampaignStatus | null = null;
    if (rawStatus) {
      if (!CAMPAIGN_STATUSES.has(rawStatus as CampaignStatus)) {
        addError(
          "campaignStatus",
          "must be ACTIVE, INACTIVE, COMPLETED, or CANCELLED",
        );
      } else {
        status = rawStatus as CampaignStatus;
      }
    }

    if (values.slice(grid[0].length).some((value) => cellString(value))) {
      addError("row", "contains data outside the header columns");
    }
    if (rowErrors.length) {
      rejectedRows.add(sourceRow);
      errors.push(...rowErrors);
      return [];
    }
    return [
      {
        campaignId,
        campaignName,
        promotionType,
        campaignChannel,
        startDate: startDate!,
        endDate: endDate!,
        marketingCost: marketingCost!,
        discountPercentage,
        discountType,
        discountValue,
        status,
        sourceRow,
      },
    ];
  });

  const firstRows = new Map<string, number>();
  for (const campaign of candidates) {
    const firstRow = firstRows.get(campaign.campaignId);
    if (firstRow !== undefined) {
      rejectedRows.add(firstRow);
      rejectedRows.add(campaign.sourceRow);
      errors.push(
        `${worksheetName} rows ${firstRow} and ${campaign.sourceRow}: duplicate campaignId "${campaign.campaignId}".`,
      );
    } else {
      firstRows.set(campaign.campaignId, campaign.sourceRow);
    }
  }

  if (errors.length) {
    throw new CampaignParseError(
      `Marketing Campaigns worksheet contains ${rejectedRows.size} rejected row(s).`,
      [
        {
          worksheet: worksheetName,
          rejectedRows: [...rejectedRows].sort((a, b) => a - b),
          errors,
        },
      ],
    );
  }
  if (!candidates.length) {
    throw new CampaignParseError(
      `Worksheet "${worksheetName}" contains no campaign records.`,
      [
        {
          worksheet: worksheetName,
          rejectedRows: [],
          errors: ["No campaign records found."],
        },
      ],
    );
  }
  return candidates;
}

export function parseCampaignWorkbook(
  buffer: Buffer,
  fileName: string,
): ParsedCampaignWorkbook {
  let workbook: XLSX.WorkBook;
  try {
    workbook = readExcelWorkbook(buffer, fileName);
  } catch (error) {
    if (error instanceof ExcelParseError) {
      throw new CampaignParseError(error.message);
    }
    throw error;
  }
  if (!workbook.SheetNames.length) {
    throw new CampaignParseError("The Excel workbook contains no worksheets.");
  }

  const requiredAliases = [
    ["campaignid"],
    ["campaignname"],
    ["promotiontype"],
    ["marketingchannel", "campaignchannel", "channel"],
    ["startdate"],
    ["enddate"],
    ["marketingcost"],
  ];
  const matches = workbook.SheetNames.filter((name) => {
    if (["marketingcampaigns", "campaigns"].includes(normalizeName(name))) {
      return true;
    }
    const worksheet = workbook.Sheets[name];
    if (!worksheet || !worksheet["!ref"]) return false;
    const grid = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      raw: true,
      defval: "",
      blankrows: false,
    });
    const headers = new Set(
      (grid[0] ?? []).map((value) => normalizeName(cellString(value))),
    );
    return requiredAliases.every((aliases) =>
      aliases.some((alias) => headers.has(alias)),
    );
  });
  if (matches.length > 1) {
    throw new CampaignParseError(
      `The workbook contains multiple Marketing Campaigns worksheets: ${matches.join(", ")}.`,
    );
  }
  if (!matches.length) {
    throw new CampaignParseError(
      `The workbook must contain a Marketing Campaigns worksheet. Detected worksheets: ${workbook.SheetNames.join(", ")}.`,
    );
  }
  return {
    worksheetName: matches[0],
    worksheetNames: workbook.SheetNames,
    campaigns: parseSheet(matches[0], workbook.Sheets[matches[0]]),
  };
}
