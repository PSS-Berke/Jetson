'use client';

import { useMemo, useCallback, useState, memo } from 'react';
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { CalendarEvent, CalendarViewType, DailySummary, CapacityDisplayMode } from '@/types/calendar';
import { formatNumber } from '@/lib/calendarUtils';
import { getDateKey } from '@/lib/dateUtils';
import { ParsedJob } from '@/hooks/useJobs';
import { getProcessTypeColor } from '@/lib/processTypeConfig';

const locales = {
  'en-US': enUS
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales
});

// Use config for process types - not currently used directly
// const PROCESS_TYPES = PROCESS_TYPE_CONFIGS.map(config => ({
//   key: config.key,
//   label: config.label
// }));

interface CalendarViewProps {
  events: CalendarEvent[];
  dailySummaries: Map<string, DailySummary>;
  viewType: CalendarViewType;
  displayMode: CapacityDisplayMode;
  onDateClick: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onViewChange?: (view: View) => void;
  onNavigate?: (date: Date) => void;
  compactMode?: boolean;
  jobs?: ParsedJob[];
  dateRange?: { start: Date; end: Date };
  onJobClick?: (job: ParsedJob) => void;
}

// Memoized DateHeader component for performance
interface DateHeaderProps {
  date: Date;
  label: string;
  dailySummaries: Map<string, DailySummary>;
  expandedBadges: Set<string>;
  toggleBadge: (dateKey: string, processKey: string) => void;
  getJobsForDateAndProcess: (date: Date, processKey: string) => ParsedJob[];
  handleJobClick: (job: ParsedJob) => void;
}

const MemoizedDateHeader = memo(({
  date,
  label,
  dailySummaries,
  expandedBadges,
  toggleBadge,
  getJobsForDateAndProcess,
  handleJobClick
}: DateHeaderProps) => {
  const dateKey = getDateKey(date);
  const summary = dailySummaries.get(dateKey);

  console.log(`[CalendarView] DateHeader for ${dateKey}, has summary: ${!!summary}`);

  // Process type badges data with full names
  const processTypeBadges = summary ? [
    { key: 'insert', label: 'Insert', count: summary.processTypeCounts.insert, color: getProcessTypeColor('insert') },
    { key: 'sort', label: 'Sort', count: summary.processTypeCounts.sort, color: getProcessTypeColor('sort') },
    { key: 'inkjet', label: 'Inkjet', count: summary.processTypeCounts.inkjet, color: getProcessTypeColor('inkjet') },
    { key: 'labelApply', label: 'Label/Apply', count: summary.processTypeCounts.labelApply, color: getProcessTypeColor('labelApply') },
    { key: 'fold', label: 'Fold', count: summary.processTypeCounts.fold, color: getProcessTypeColor('fold') },
    { key: 'laser', label: 'Laser', count: summary.processTypeCounts.laser, color: getProcessTypeColor('laser') },
    { key: 'hpPress', label: 'HP Press', count: summary.processTypeCounts.hpPress, color: getProcessTypeColor('hpPress') }
  ].filter(badge => badge.count > 0) : [];

  console.log(`[CalendarView] DateHeader rendering for ${dateKey}, expandedBadges:`, Array.from(expandedBadges));

  return (
    <div className="calendar-date-header">
      <div className="date-label">{label}</div>
      {processTypeBadges.length > 0 && (
        <div className="process-type-badges">
          {processTypeBadges.map(badge => {
            const badgeId = `${dateKey}-${badge.key}`;
            const isExpanded = expandedBadges.has(badgeId);
            const badgeJobs = isExpanded ? getJobsForDateAndProcess(date, badge.key) : [];

            console.log(`[CalendarView] Rendering badge ${badge.key} for ${dateKey}`);
            console.log(`[CalendarView]   - badgeId: ${badgeId}`);
            console.log(`[CalendarView]   - isExpanded: ${isExpanded}`);
            console.log(`[CalendarView]   - expandedBadges.has('${badgeId}'): ${expandedBadges.has(badgeId)}`);
            console.log(`[CalendarView]   - badgeJobs.length: ${badgeJobs.length}`);

            return (
              <div key={badge.key} className="process-badge-container">
                <div
                  className="process-badge"
                  style={{ backgroundColor: badge.color }}
                  title={`Click to ${isExpanded ? 'collapse' : 'expand'} ${badge.label} jobs`}
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log(`[CalendarView] Badge clicked: ${badge.key} on ${dateKey}`);
                    toggleBadge(dateKey, badge.key);
                  }}
                >
                  <span>{badge.label}: {formatNumber(badge.count)}</span>
                  <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                </div>

                {isExpanded && (() => {
                  console.log(`[CalendarView] Rendering job-list div for ${badgeId}, isExpanded=${isExpanded}, jobs:`, badgeJobs);
                  return (
                    <div className="job-list" style={{ borderLeft: `3px solid ${badge.color}`, padding: '8px' }}>
                      {badgeJobs.length > 0 ? (
                        badgeJobs.map((job, index) => {
                          console.log(`[CalendarView] Mapping job ${index}:`, job.job_number);
                          return (
                            <div
                              key={job.id}
                              className="job-item clickable"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleJobClick(job);
                              }}
                              style={{ cursor: 'pointer' }}
                            >
                              <div className="job-number">#{job.job_number}</div>
                              <div className="job-name">{job.job_name || job.description}</div>
                              <div className="job-details">
                                <span>{formatNumber(job.quantity)} pcs</span>
                                {(() => {
                                  // Calculate revenue from requirements.price_per_m
                                  if (job.requirements && job.requirements.length > 0) {
                                    const revenue = job.requirements.reduce((total, req) => {
                                      const pricePerMStr = req.price_per_m;
                                      const isValidPrice = pricePerMStr && pricePerMStr !== 'undefined' && pricePerMStr !== 'null';
                                      const pricePerM = isValidPrice ? parseFloat(pricePerMStr) : 0;
                                      return total + ((job.quantity / 1000) * pricePerM);
                                    }, 0);
                                    
                                    if (revenue > 0) {
                                      return (
                                        <span className="job-revenue">
                                          ${revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                      );
                                    }
                                  }
                                  return null;
                                })()}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="job-item" style={{ fontStyle: 'italic', color: '#999' }}>
                          No jobs found for this process type
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for optimal memoization
  const dateKey = getDateKey(prevProps.date);
  const nextDateKey = getDateKey(nextProps.date);

  if (dateKey !== nextDateKey) return false;
  if (prevProps.label !== nextProps.label) return false;

  // Check if this specific date's summary changed
  const prevSummary = prevProps.dailySummaries.get(dateKey);
  const nextSummary = nextProps.dailySummaries.get(dateKey);
  if (prevSummary !== nextSummary) return false;

  // Check if any badges for this date are expanded
  const prevHasExpanded = Array.from(prevProps.expandedBadges).some(id => id.startsWith(dateKey));
  const nextHasExpanded = Array.from(nextProps.expandedBadges).some(id => id.startsWith(dateKey));
  if (prevHasExpanded !== nextHasExpanded) return false;

  // If both have expanded badges, check if they're the same
  if (prevHasExpanded && nextHasExpanded) {
    const prevExpanded = Array.from(prevProps.expandedBadges).filter(id => id.startsWith(dateKey));
    const nextExpanded = Array.from(nextProps.expandedBadges).filter(id => id.startsWith(dateKey));
    if (JSON.stringify(prevExpanded.sort()) !== JSON.stringify(nextExpanded.sort())) return false;
  }

  return true;
});

MemoizedDateHeader.displayName = 'MemoizedDateHeader';

export default function CalendarView({
  dailySummaries,
  viewType,
  onDateClick,
  onViewChange,
  onNavigate,
  compactMode = false,
  jobs = [],
  dateRange,
  onJobClick
}: CalendarViewProps) {
  // State to track which process badges are expanded (dateKey-processType)
  const [expandedBadges, setExpandedBadges] = useState<Set<string>>(new Set());
  // Don't show any events - only show process type badges
  const calendarEvents = useMemo(() => {
    return [];
  }, []);

  // Custom event style getter
  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    return {
      style: {
        backgroundColor: event.color || 'var(--primary-blue)',
        borderRadius: '4px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block',
        fontSize: '0.875rem',
        padding: '2px 5px'
      }
    };
  }, []);

  // No background colors - keep calendar clean with just gridlines
  const dayPropGetter = useCallback(() => {
    return {};
  }, []);

  // Toggle badge expansion
  const toggleBadge = useCallback((dateKey: string, processType: string) => {
    const badgeId = `${dateKey}-${processType}`;
    console.log(`[CalendarView] toggleBadge called with badgeId: ${badgeId}`);
    setExpandedBadges(prev => {
      const newSet = new Set(prev);
      if (newSet.has(badgeId)) {
        console.log(`[CalendarView] Removing ${badgeId} from expanded badges`);
        newSet.delete(badgeId);
      } else {
        console.log(`[CalendarView] Adding ${badgeId} to expanded badges`);
        newSet.add(badgeId);
      }
      console.log(`[CalendarView] New expanded badges:`, Array.from(newSet));
      return newSet;
    });
  }, []);

  // Handle job click
  const handleJobClick = useCallback((job: ParsedJob) => {
    console.log(`[CalendarView] Job clicked: ${job.job_number}`);
    if (onJobClick) {
      onJobClick(job);
    }
  }, [onJobClick]);

  // Get jobs for a specific date and process type
  const getJobsForDateAndProcess = useCallback((date: Date, processType: string) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    console.log(`[CalendarView] ========================================`);
    console.log(`[CalendarView] Getting jobs for ${date.toDateString()} and process type: ${processType}`);
    console.log(`[CalendarView] Total jobs available: ${jobs.length}`);

    // Log all jobs to see their structure
    if (jobs.length > 0) {
      console.log(`[CalendarView] Sample job:`, jobs[0]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      console.log(`[CalendarView] Sample requirements:`, (jobs[0] as any).requirements);
    }

    const filteredJobs = jobs.filter(job => {
      const jobStart = new Date(job.start_date);
      const jobEnd = new Date(job.due_date);

      // Check if job overlaps with this day
      const jobOverlapsDay = jobStart <= dayEnd && jobEnd >= dayStart;

      if (!jobOverlapsDay) {
        return false;
      }

      // Check if job uses this process type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jobRequirements = (job as any).requirements;
      console.log(`[CalendarView] Checking job ${job.job_number}, requirements:`, jobRequirements);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hasProcessType = Array.isArray(jobRequirements) && jobRequirements.some((req: any) => {
        console.log(`[CalendarView]   - Checking requirement:`, req, `looking for process_type: ${processType}`);
        if (!req.process_type) {
          console.log(`[CalendarView]   - No process_type in requirement`);
          return false;
        }
        const normalized = req.process_type.toLowerCase();
        console.log(`[CalendarView]   - Normalized process_type: ${normalized}`);

        // Normalize process type variations (matching calendarUtils.ts logic)
        if (processType === 'insert' && normalized === 'insert') return true;
        if (processType === 'sort' && normalized === 'sort') return true;
        if (processType === 'inkjet' && (normalized === 'inkjet' || normalized === 'ij' || normalized === 'ink jet')) return true;
        if (processType === 'labelApply' && (normalized === 'label/apply' || normalized === 'l/a' || normalized === 'label/affix')) return true;
        if (processType === 'fold' && normalized === 'fold') return true;
        if (processType === 'laser' && normalized === 'laser') return true;
        if (processType === 'hpPress' && normalized === 'hp press') return true;

        return false;
      });

      console.log(`[CalendarView] Job ${job.job_number} hasProcessType: ${hasProcessType}`);

      if (jobOverlapsDay && hasProcessType) {
        console.log(`[CalendarView] ✓ Job ${job.job_number} MATCHES - process: ${processType}`);
      }

      return hasProcessType;
    });

    console.log(`[CalendarView] Found ${filteredJobs.length} jobs for ${processType}`);
    if (filteredJobs.length > 0) {
      console.log(`[CalendarView] Filtered jobs:`, filteredJobs.map(j => ({ id: j.id, number: j.job_number, name: j.job_name })));
    }
    console.log(`[CalendarView] ========================================`);
    return filteredJobs;
  }, [jobs]);

  // Wrapper for memoized DateHeader component
  const DateHeader = useCallback(({ date, label }: { date: Date; label: string }) => {
    return (
      <MemoizedDateHeader
        date={date}
        label={label}
        dailySummaries={dailySummaries}
        expandedBadges={expandedBadges}
        toggleBadge={toggleBadge}
        getJobsForDateAndProcess={getJobsForDateAndProcess}
        handleJobClick={handleJobClick}
      />
    );
  }, [dailySummaries, expandedBadges, toggleBadge, getJobsForDateAndProcess, handleJobClick]);

  // Handle slot selection (clicking on a day)
  const handleSelectSlot = useCallback((slotInfo: { start: Date; end: Date; action: string }) => {
    if (slotInfo.action === 'click' || slotInfo.action === 'select') {
      onDateClick(slotInfo.start);
    }
  }, [onDateClick]);

  // Handle event selection - no events to select anymore
  const handleSelectEvent = useCallback(() => {
    // No-op since we don't show events
  }, []);

  // Map our view type to react-big-calendar view
  const mapViewType = (view: CalendarViewType): View => {
    return view as View;
  };

  // Responsive height calculation - calculate based on number of weeks to show
  const calendarHeight = useMemo(() => {
    // In compact mode, calculate dynamic height based on number of weeks
    if (compactMode) {
      // Most months need 5-6 weeks to display all days
      // Header (50px) + 6 weeks × 150px per week = 950px
      return '950px';
    }
    // Use smaller height on mobile
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return '800px';
    }
    return '950px';
  }, [compactMode]);

  return (
    <div className="calendar-container bg-white rounded-lg border border-[var(--border)] shadow-sm p-2 sm:p-4">
      <Calendar
        localizer={localizer}
        events={calendarEvents}
        startAccessor="start"
        endAccessor="end"
        titleAccessor="title"
        style={{ height: calendarHeight }}
        view={mapViewType(viewType)}
        onView={onViewChange}
        onNavigate={onNavigate}
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        eventPropGetter={eventStyleGetter}
        dayPropGetter={dayPropGetter}
        selectable
        popup
        toolbar={!compactMode}
        date={dateRange?.start}
        showAllEvents
        components={{
          month: {
            dateHeader: DateHeader
          }
        }}
        tooltipAccessor={(event) => {
          const e = event as CalendarEvent;
          return `${e.serviceType}\n${formatNumber(e.totalPieces)} pieces\n${e.jobCount} job${e.jobCount > 1 ? 's' : ''}`;
        }}
      />
    </div>
  );
}
