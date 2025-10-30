/**
 * Query Processing Utilities - Ported from Python
 * All calculations done in TypeScript (dates, numbers, ranges)
 * Azure OpenAI used for text understanding only
 */

import { PercentileData } from "@shared/schema";

// ═══════════════════════════════════════════════════════════════
// SEMANTIC TIME PARSER
// ═══════════════════════════════════════════════════════════════

export class SemanticTimeParser {
  private today: Date;

  constructor() {
    this.today = new Date();
  }

  parse(timeReference: string): [string, string] | null {
    if (!timeReference) return null;

    const timeRef = timeReference.toLowerCase().trim();

    // CATEGORY 1: RELATIVE TIME PERIODS
    if (
      timeRef.includes("next") ||
      timeRef.includes("coming") ||
      timeRef.includes("upcoming") ||
      timeRef.includes("future")
    ) {
      return this.parseFutureReference(timeRef);
    }

    if (
      timeRef.includes("last") ||
      timeRef.includes("past") ||
      timeRef.includes("previous") ||
      timeRef.includes("recent")
    ) {
      return this.parsePastReference(timeRef);
    }

    // CATEGORY 2: VAGUE TIME REFERENCES
    const vagueMappings: Record<string, [number, number]> = {
      soon: [0, 90],
      "near future": [0, 180],
      "short term": [0, 180],
      "medium term": [180, 730],
      "long term": [730, 1825],
      immediately: [0, 30],
      recently: [-90, 0],
      shortly: [0, 60],
      "little while": [0, 90],
    };

    for (const [phrase, [startDays, endDays]] of Object.entries(vagueMappings)) {
      if (timeRef.includes(phrase)) {
        const startDate = this.addDays(this.today, startDays);
        const endDate = this.addDays(this.today, endDays);
        return [this.formatDate(startDate), this.formatDate(endDate)];
      }
    }

    // CATEGORY 3: SPECIFIC TIME PERIODS
    if (timeRef.includes("this quarter")) {
      return this.getCurrentQuarterDates();
    }

    if (timeRef.includes("this year")) {
      const year = this.today.getFullYear();
      return [`${year}-01-01`, `${year}-12-31`];
    }

    const quarterResult = this.parseSpecificQuarter(timeRef);
    if (quarterResult) return quarterResult;

    const yearResult = this.parseSpecificYear(timeRef);
    if (yearResult) return yearResult;

    const monthRange = this.parseMonthRange(timeRef);
    if (monthRange) return monthRange;

    // CATEGORY 4: NUMERIC + UNIT PATTERNS
    const numericResult = this.extractNumericTimeframe(timeRef);
    if (numericResult) return numericResult;

    return null;
  }

  private parseFutureReference(text: string): [string, string] | null {
    const result = this.extractNumericTimeframe(text);
    if (result) return result;

    const futureDefaults: Record<string, number> = {
      quarter: 90,
      year: 365,
      months: 180,
    };

    for (const [unit, days] of Object.entries(futureDefaults)) {
      if (text.includes(unit)) {
        const startDate = this.formatDate(this.today);
        const endDate = this.formatDate(this.addDays(this.today, days));
        return [startDate, endDate];
      }
    }

    const startDate = this.formatDate(this.today);
    const endDate = this.formatDate(this.addDays(this.today, 180));
    return [startDate, endDate];
  }

  private parsePastReference(text: string): [string, string] | null {
    const result = this.extractNumericTimeframe(text);
    if (result) return result;

    const pastDefaults: Record<string, number> = {
      quarter: 90,
      year: 365,
      months: 180,
    };

    for (const [unit, days] of Object.entries(pastDefaults)) {
      if (text.includes(unit)) {
        const startDate = this.formatDate(this.addDays(this.today, -days));
        const endDate = this.formatDate(this.today);
        return [startDate, endDate];
      }
    }

    const startDate = this.formatDate(this.addDays(this.today, -180));
    const endDate = this.formatDate(this.today);
    return [startDate, endDate];
  }

  private extractNumericTimeframe(text: string): [string, string] | null {
    const convertedText = this.convertWrittenNumbers(text);
    const pattern = /(\d+)\s*(month|months|day|days|year|years|week|weeks|quarter|quarters)/;
    const match = convertedText.match(pattern);

    if (match) {
      const quantity = parseInt(match[1]);
      const unit = match[2].replace(/s$/, "");
      const days = this.unitToDays(quantity, unit);

      const isFuture =
        text.includes("next") ||
        text.includes("coming") ||
        text.includes("upcoming") ||
        text.includes("future");
      const isPast =
        text.includes("last") ||
        text.includes("past") ||
        text.includes("previous") ||
        text.includes("recent");

      if (isFuture) {
        const startDate = this.formatDate(this.today);
        const endDate = this.formatDate(this.addDays(this.today, days));
        return [startDate, endDate];
      } else if (isPast) {
        const startDate = this.formatDate(this.addDays(this.today, -days));
        const endDate = this.formatDate(this.today);
        return [startDate, endDate];
      } else {
        const startDate = this.formatDate(this.today);
        const endDate = this.formatDate(this.addDays(this.today, days));
        return [startDate, endDate];
      }
    }

    return null;
  }

  private convertWrittenNumbers(text: string): string {
    const wordToNumber: Record<string, string> = {
      one: "1",
      two: "2",
      three: "3",
      four: "4",
      five: "5",
      six: "6",
      seven: "7",
      eight: "8",
      nine: "9",
      ten: "10",
      eleven: "11",
      twelve: "12",
      thirteen: "13",
      fourteen: "14",
      fifteen: "15",
      sixteen: "16",
      seventeen: "17",
      eighteen: "18",
      nineteen: "19",
      twenty: "20",
      thirty: "30",
      forty: "40",
      fifty: "50",
      sixty: "60",
      seventy: "70",
      eighty: "80",
      ninety: "90",
    };

    let result = text;
    for (const [word, number] of Object.entries(wordToNumber)) {
      const regex = new RegExp(`\\b${word}\\b`, "gi");
      result = result.replace(regex, number);
    }
    return result;
  }

  private unitToDays(quantity: number, unit: string): number {
    const unitLower = unit.toLowerCase();
    if (unitLower === "day") return quantity;
    if (unitLower === "week") return quantity * 7;
    if (unitLower === "month") return quantity * 30;
    if (unitLower === "quarter") return quantity * 90;
    if (unitLower === "year") return quantity * 365;
    return 0;
  }

  private getCurrentQuarterDates(): [string, string] {
    const month = this.today.getMonth() + 1;
    const year = this.today.getFullYear();

    if (month <= 3) return [`${year}-01-01`, `${year}-03-31`];
    if (month <= 6) return [`${year}-04-01`, `${year}-06-30`];
    if (month <= 9) return [`${year}-07-01`, `${year}-09-30`];
    return [`${year}-10-01`, `${year}-12-31`];
  }

  private parseSpecificQuarter(text: string): [string, string] | null {
    let match = text.match(/q(\d)\s+(\d{4})/);
    if (match) {
      const quarter = parseInt(match[1]);
      const year = parseInt(match[2]);
      if (quarter >= 1 && quarter <= 4) {
        return this.getQuarterDates(year, quarter);
      }
    }

    const quarterNames: Record<string, number> = {
      first: 1,
      second: 2,
      third: 3,
      fourth: 4,
    };

    for (const [name, num] of Object.entries(quarterNames)) {
      const pattern = new RegExp(`${name}\\s+quarter\\s+(\\d{4})`);
      match = text.match(pattern);
      if (match) {
        const year = parseInt(match[1]);
        return this.getQuarterDates(year, num);
      }
    }

    return null;
  }

  private getQuarterDates(year: number, quarter: number): [string, string] {
    const quarters: Record<number, [string, string]> = {
      1: [`${year}-01-01`, `${year}-03-31`],
      2: [`${year}-04-01`, `${year}-06-30`],
      3: [`${year}-07-01`, `${year}-09-30`],
      4: [`${year}-10-01`, `${year}-12-31`],
    };
    return quarters[quarter] || [`${year}-01-01`, `${year}-12-31`];
  }

  private parseSpecificYear(text: string): [string, string] | null {
    const match = text.match(/\b(20\d{2})\b/);
    if (match) {
      const year = parseInt(match[1]);
      return [`${year}-01-01`, `${year}-12-31`];
    }
    return null;
  }

  private parseMonthRange(text: string): [string, string] | null {
    const monthMap: Record<string, number> = {
      january: 1,
      jan: 1,
      february: 2,
      feb: 2,
      march: 3,
      mar: 3,
      april: 4,
      apr: 4,
      may: 5,
      june: 6,
      jun: 6,
      july: 7,
      jul: 7,
      august: 8,
      aug: 8,
      september: 9,
      sep: 9,
      october: 10,
      oct: 10,
      november: 11,
      nov: 11,
      december: 12,
      dec: 12,
    };

    const pattern = /between\s+(\w+)\s+and\s+(\w+)\s+(\d{4})/;
    const match = text.match(pattern);

    if (match) {
      const startMonth = monthMap[match[1].toLowerCase()];
      const endMonth = monthMap[match[2].toLowerCase()];
      const year = parseInt(match[3]);

      if (startMonth && endMonth) {
        const startDate = `${year}-${String(startMonth).padStart(2, "0")}-01`;

        let endDate: string;
        if (endMonth === 12) {
          endDate = `${year}-12-31`;
        } else {
          const nextMonth = new Date(year, endMonth, 0);
          const lastDay = nextMonth.getDate();
          endDate = `${year}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        }

        return [startDate, endDate];
      }
    }

    return null;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}

// ═══════════════════════════════════════════════════════════════
// NUMBER CALCULATOR
// ═══════════════════════════════════════════════════════════════

export class NumberCalculator {
  static parseNumber(text: string): number | null {
    const patterns = [
      /(\d+)\s*million/i,
      /(\d+)m\b/i,
      /(\d+)\s*thousand/i,
      /(\d+)k\b/i,
      /(\d+)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const num = parseFloat(match[1]);
        if (pattern.source.includes("million") || pattern.source.includes("m\\b")) {
          return num * 1_000_000;
        }
        if (pattern.source.includes("thousand") || pattern.source.includes("k\\b")) {
          return num * 1_000;
        }
        return num;
      }
    }

    return null;
  }

  static parseRange(text: string): [number, number] | null {
    const pattern = /between\s+(\d+)\s+and\s+(\d+)/i;
    const match = text.match(pattern);

    if (match) {
      return [parseFloat(match[1]), parseFloat(match[2])];
    }

    return null;
  }

  static parseLimit(text: string): number | null {
    const patterns = [
      /top\s+(\d+)/i,
      /first\s+(\d+)/i,
      /(\d+)\s+largest/i,
      /(\d+)\s+biggest/i,
      /limit\s+(\d+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return parseInt(match[1]);
      }
    }

    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// PROJECT SIZE CALCULATOR
// ═══════════════════════════════════════════════════════════════

export class ProjectSizeCalculator {
  private percentiles: PercentileData | null = null;
  private lastCalculated: Date | null = null;
  private cacheDuration = 24 * 60 * 60 * 1000; // 24 hours

  async calculatePercentiles(
    dbQuery: (sql: string) => Promise<any[]>,
    forceRefresh = false
  ): Promise<PercentileData | null> {
    if (
      !forceRefresh &&
      this.percentiles &&
      this.lastCalculated &&
      Date.now() - this.lastCalculated.getTime() < this.cacheDuration
    ) {
      return this.percentiles;
    }

    try {
      const sql = `
        SELECT 
          PERCENTILE_CONT(0.20) WITHIN GROUP (ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC)) as p20,
          PERCENTILE_CONT(0.40) WITHIN GROUP (ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC)) as p40,
          PERCENTILE_CONT(0.60) WITHIN GROUP (ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC)) as p60,
          PERCENTILE_CONT(0.80) WITHIN GROUP (ORDER BY CAST(NULLIF("Fee", '') AS NUMERIC)) as p80,
          MIN(CAST(NULLIF("Fee", '') AS NUMERIC)) as min_fee,
          MAX(CAST(NULLIF("Fee", '') AS NUMERIC)) as max_fee,
          COUNT(*) as total_projects
        FROM "Sample"
        WHERE "Fee" IS NOT NULL 
        AND "Fee" != ''
        AND CAST(NULLIF("Fee", '') AS NUMERIC) > 10000
      `;

      const result = await dbQuery(sql);

      if (result && result[0]) {
        const row = result[0];
        this.percentiles = {
          p20: parseFloat(row.p20),
          p40: parseFloat(row.p40),
          p60: parseFloat(row.p60),
          p80: parseFloat(row.p80),
          min: parseFloat(row.min_fee),
          max: parseFloat(row.max_fee),
          total_projects: parseInt(row.total_projects),
          calculated_at: new Date().toISOString(),
        };

        this.lastCalculated = new Date();
        return this.percentiles;
      }

      return null;
    } catch (error) {
      console.error("Error calculating percentiles:", error);
      return null;
    }
  }

  getSqlCaseStatement(): string {
    if (!this.percentiles) {
      // Fallback if calculation fails - return just category names without ranges
      return `CASE 
        WHEN CAST(NULLIF("Fee", '') AS NUMERIC) < 100000 THEN 'Micro'
        WHEN CAST(NULLIF("Fee", '') AS NUMERIC) < 1000000 THEN 'Small'
        WHEN CAST(NULLIF("Fee", '') AS NUMERIC) < 10000000 THEN 'Medium'
        WHEN CAST(NULLIF("Fee", '') AS NUMERIC) < 50000000 THEN 'Large'
        ELSE 'Mega'
      END`;
    }

    const p = this.percentiles;

    // Return category names only (no fee ranges) for WHERE clause matching
    return `CASE 
      WHEN CAST(NULLIF("Fee", '') AS NUMERIC) < ${p.p20} 
        THEN 'Micro'
      WHEN CAST(NULLIF("Fee", '') AS NUMERIC) >= ${p.p20} AND CAST(NULLIF("Fee", '') AS NUMERIC) < ${p.p40} 
        THEN 'Small'
      WHEN CAST(NULLIF("Fee", '') AS NUMERIC) >= ${p.p40} AND CAST(NULLIF("Fee", '') AS NUMERIC) < ${p.p60} 
        THEN 'Medium'
      WHEN CAST(NULLIF("Fee", '') AS NUMERIC) >= ${p.p60} AND CAST(NULLIF("Fee", '') AS NUMERIC) < ${p.p80} 
        THEN 'Large'
      ELSE 'Mega'
    END`;
  }

  getSizeCategory(fee: number): string {
    if (!this.percentiles || fee <= 0) return "unknown";

    const p = this.percentiles;

    if (fee < p.p20) return "Micro";
    if (fee < p.p40) return "Small";
    if (fee < p.p60) return "Medium";
    if (fee < p.p80) return "Large";
    return "Mega";
  }
}
