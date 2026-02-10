export interface DataPoint {
  timeSlot?: string;
  value: number;
}

export interface DailyRecord {
  day: number;
  dateStr: string;
  tonnage: number;
  dataPoints: DataPoint[];
}

export interface Rule {
  min: number;
  minOp: 'lt' | 'le' | 'gt' | 'ge';
  max: number;
  maxOp: 'lt' | 'le' | 'gt' | 'ge';
  label: string;
  type: string;
  factor: number;
  rawCondition?: string;
}

export interface Profile {
  id: string;
  name: string;
  readonly: boolean;
  rules: Rule[];
}

export interface AppConfig {
  year: number;
  month: number;
  minRange: number;
  maxRange: number;
  customMinRange: number;
  customMaxRange: number;
}

export interface ImportConfig {
  quality: {
    sheetName: string;
    dateCol: string;
    timeCol: string;
    valueCol: string;
  };
  tonnage: {
    sheetName: string;
    dateCol: string;
    valueCol: string;
  };
}

export type SamplingMode = '2h' | 'shift' | 'daily';

export interface WeekStats {
    pct: { fixed: number; custom: number };
    impact: { fixed: number; custom: number };
    factor: { fixed: number; custom: number };
    ruleLabels: { fixed?: string; custom?: string };
    isRej: { fixed: boolean; custom: boolean };
    style: { fixed: string; custom: string };
    counts: {
        total: number;
        fixed: { inRange: number; low: number; high: number };
        custom: { inRange: number; low: number; high: number };
    };
    totalTonnage: number;
}