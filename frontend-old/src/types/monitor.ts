/**
 * Monitor and monitoring data types
 */

export interface MonitorSummary {
  monitor_id: string;
  monitor_name: string | null;
  monitor_type?: string;  // 'monitor' or 'constant'
  url: string;
  unit: string | null;
  decimal_places?: number;
  color?: string | null;
  description?: string | null;
  total_records: number;
  latest_value: number | null;
  latest_timestamp: string;
  min_value: number | null;
  max_value: number | null;
  avg_value: number | null;
  change_count: number;
  hidden?: boolean;
  tags?: string[];
}

export interface ChartData {
  monitor_id: string;
  monitor_name: string;
  url: string;
  data: Array<{
    timestamp: string;
    value: number | null;
    status: string;
  }>;
  summary: {
    total_points: number;
    date_range: string;
    value_range: {
      min: number | null;
      max: number | null;
      avg: number | null;
    };
    changes_detected: number;
    latest_value: number | null;
    latest_timestamp: string | null;
  };
}

export interface Threshold {
  upper?: number;
  lower?: number;
  level?: string;
}
