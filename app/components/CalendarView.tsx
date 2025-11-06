'use client';

import { useMemo, useCallback } from 'react';
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { CalendarEvent, CalendarViewType, DailySummary, CapacityDisplayMode } from '@/types/calendar';
import { formatCurrency, formatNumber, getProcessTypeColor } from '@/lib/calendarUtils';
import { getDateKey } from '@/lib/dateUtils';

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
}

export default function CalendarView({
  events,
  dailySummaries,
  viewType,
  displayMode,
  onDateClick,
  onEventClick,
  onViewChange,
  onNavigate,
  compactMode = false
}: CalendarViewProps) {
  // Convert our CalendarEvent to react-big-calendar format
  const calendarEvents = useMemo(() => {
    return events.map(event => ({
      ...event,
      resource: event
    }));
  }, [events]);

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

  // Custom day prop getter for background colors based on utilization
  const dayPropGetter = useCallback((date: Date) => {
    if (displayMode !== 'overlay') {
      return {};
    }

    const dateKey = getDateKey(date);
    const summary = dailySummaries.get(dateKey);

    if (!summary || summary.utilizationPercent === 0) {
      return {};
    }

    let backgroundColor = 'transparent';
    if (summary.utilizationPercent < 50) {
      backgroundColor = 'rgba(16, 185, 129, 0.1)'; // green
    } else if (summary.utilizationPercent <= 80) {
      backgroundColor = 'rgba(245, 158, 11, 0.1)'; // yellow
    } else {
      backgroundColor = 'rgba(239, 68, 68, 0.1)'; // red
    }

    return {
      style: {
        backgroundColor
      }
    };
  }, [dailySummaries, displayMode]);

  // Custom date header for month view
  const DateHeader = useCallback(({ date, label }: { date: Date; label: string }) => {
    const dateKey = getDateKey(date);
    const summary = dailySummaries.get(dateKey);

    // Process type badges data
    const processTypeBadges = summary ? [
      { key: 'insert', label: 'I', count: summary.processTypeCounts.insert, color: getProcessTypeColor('insert') },
      { key: 'sort', label: 'S', count: summary.processTypeCounts.sort, color: getProcessTypeColor('sort') },
      { key: 'inkjet', label: 'IJ', count: summary.processTypeCounts.inkjet, color: getProcessTypeColor('inkjet') },
      { key: 'labelApply', label: 'L/A', count: summary.processTypeCounts.labelApply, color: getProcessTypeColor('labelApply') },
      { key: 'fold', label: 'F', count: summary.processTypeCounts.fold, color: getProcessTypeColor('fold') },
      { key: 'laser', label: 'L', count: summary.processTypeCounts.laser, color: getProcessTypeColor('laser') },
      { key: 'hpPress', label: 'HP', count: summary.processTypeCounts.hpPress, color: getProcessTypeColor('hpPress') }
    ].filter(badge => badge.count > 0) : [];

    return (
      <div className="calendar-date-header">
        <div className="date-label">{label}</div>
        {summary && summary.totalPieces > 0 && (
          <div className="date-summary">
            <div className="pieces">{formatNumber(summary.totalPieces)} pcs</div>
            <div className="revenue">{formatCurrency(summary.totalRevenue)}</div>
            {processTypeBadges.length > 0 && (
              <div className="process-type-badges">
                {processTypeBadges.map(badge => (
                  <div
                    key={badge.key}
                    className="process-badge"
                    style={{ backgroundColor: badge.color }}
                    title={`${badge.label}: ${formatNumber(badge.count)} pieces`}
                  >
                    <span className="badge-label">{badge.label}</span>
                    <span className="badge-count">{formatNumber(badge.count)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }, [dailySummaries]);

  // Handle slot selection (clicking on a day)
  const handleSelectSlot = useCallback((slotInfo: { start: Date; end: Date; action: string }) => {
    if (slotInfo.action === 'click' || slotInfo.action === 'select') {
      onDateClick(slotInfo.start);
    }
  }, [onDateClick]);

  // Handle event selection
  const handleSelectEvent = useCallback((event: CalendarEvent & { resource?: CalendarEvent }) => {
    if (onEventClick && event.resource) {
      onEventClick(event.resource);
    }
  }, [onEventClick]);

  // Map our view type to react-big-calendar view
  const mapViewType = (view: CalendarViewType): View => {
    return view as View;
  };

  return (
    <div className="calendar-container bg-white rounded-lg border border-[var(--border)] shadow-sm p-4">
      <Calendar
        localizer={localizer}
        events={calendarEvents}
        startAccessor="start"
        endAccessor="end"
        titleAccessor="title"
        style={{ height: compactMode ? '100%' : '700px' }}
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
