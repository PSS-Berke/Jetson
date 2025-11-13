"use client";

import { forwardRef } from "react";
import { JobProjection, TimeRange } from "@/hooks/useProjections";
import PDFHeader from "./PDFHeader";
import PDFSummary from "./PDFSummary";
import PDFTable from "./PDFTable";

interface ExportablePDFProps {
  granularity: "weekly" | "monthly" | "quarterly";
  startDate: Date;
  filters: {
    facility: number | null;
    clients: number[];
    serviceTypes: string[];
    searchQuery: string;
  };
  data: {
    jobProjections: JobProjection[];
    timeRanges: TimeRange[];
    totalJobs: number;
    totalRevenue: number;
    totalQuantity: number;
    processTypeCounts: {
      insert: { jobs: number; pieces: number };
      sort: { jobs: number; pieces: number };
      inkjet: { jobs: number; pieces: number };
      labelApply: { jobs: number; pieces: number };
      fold: { jobs: number; pieces: number };
      laser: { jobs: number; pieces: number };
      hpPress: { jobs: number; pieces: number };
    };
  };
}

const ExportablePDF = forwardRef<HTMLDivElement, ExportablePDFProps>(
  ({ granularity, startDate, filters, data }, ref) => {
    return (
      <div ref={ref} className="pdf-export-container p-8 bg-white">
        {/* Header with metadata */}
        <PDFHeader
          granularity={granularity}
          startDate={startDate}
          filters={filters}
        />

        {/* Summary statistics */}
        <PDFSummary
          totalJobs={data.totalJobs}
          totalRevenue={data.totalRevenue}
          totalQuantity={data.totalQuantity}
          processTypeCounts={data.processTypeCounts}
        />

        {/* Main content - Table */}
        <div className="pdf-page-break" />
        <PDFTable
          timeRanges={data.timeRanges}
          jobProjections={data.jobProjections}
        />
      </div>
    );
  },
);

ExportablePDF.displayName = "ExportablePDF";

export default ExportablePDF;
