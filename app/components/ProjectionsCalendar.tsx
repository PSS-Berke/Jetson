'use client';

import { useMemo } from 'react';
import { startOfWeek, addDays, format, isSameDay, startOfMonth, endOfMonth, isSameMonth } from 'date-fns';
import { ParsedJob } from '@/hooks/useJobs';
import { timestampToDate, getDateKey } from '@/lib/dateUtils';

interface ProjectionsCalendarProps {
  jobs: ParsedJob[];
  startDate?: Date;
}

interface DayJob {
  job: ParsedJob;
  quantity: number;
}

interface DayData {
  date: Date;
  jobs: DayJob[];
  totalQuantity: number;
  isCurrentMonth: boolean;
}

export default function ProjectionsCalendar({ jobs, startDate = new Date() }: ProjectionsCalendarProps) {
  console.log('==========================================');
  console.log('[ProjectionsCalendar] COMPONENT IS RENDERING');
  console.log('[ProjectionsCalendar] Received jobs:', jobs.length);
  console.log('[ProjectionsCalendar] First job sample:', jobs[0]);
  console.log('[ProjectionsCalendar] Start date:', startDate);
  console.log('==========================================');

  // Calculate calendar grid (5 weeks)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(startDate);
    const monthEnd = endOfMonth(startDate);
    const start = startOfWeek(monthStart);
    const days: DayData[] = [];

    // Generate 35 days (5 weeks) for the calendar
    for (let i = 0; i < 35; i++) {
      const date = addDays(start, i);
      days.push({
        date,
        jobs: [],
        totalQuantity: 0,
        isCurrentMonth: isSameMonth(date, startDate)
      });
    }

    return days;
  }, [startDate]);

  // Map jobs to calendar days using daily_split
  const calendarWithJobs = useMemo(() => {
    const daysMap = new Map<string, DayData>();
    
    // Initialize map with calendar days
    calendarDays.forEach(day => {
      daysMap.set(getDateKey(day.date), { ...day, jobs: [] });
    });

    console.log('[ProjectionsCalendar] Processing', jobs.length, 'jobs');

    // Process each job
    jobs.forEach((job, idx) => {
      if (!job.start_date || !job.due_date) {
        console.log(`[ProjectionsCalendar] Job ${job.job_number} missing dates`);
        return;
      }

      const jobStart = timestampToDate(job.start_date);
      const jobEnd = timestampToDate(job.due_date);
      const dailySplit = job.daily_split;

      console.log(`[ProjectionsCalendar] Job ${job.job_number}:`, {
        start: jobStart,
        end: jobEnd,
        quantity: job.quantity,
        hasDailySplit: !!dailySplit,
        dailySplitLength: dailySplit?.length,
        dailySplit: dailySplit
      });

      if (!dailySplit || !Array.isArray(dailySplit) || dailySplit.length === 0) {
        // If no daily_split, distribute evenly across all days
        const totalDays = Math.ceil((jobEnd.getTime() - jobStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const quantityPerDay = job.quantity / totalDays;

        console.log(`[ProjectionsCalendar] Job ${job.job_number} using even distribution:`, {
          totalDays,
          quantityPerDay
        });

        for (let i = 0; i < totalDays; i++) {
          const date = addDays(jobStart, i);
          const dateKey = getDateKey(date);
          const dayData = daysMap.get(dateKey);

          if (dayData) {
            dayData.jobs.push({
              job,
              quantity: quantityPerDay
            });
            dayData.totalQuantity += quantityPerDay;
          }
        }
      } else {
        // Use daily_split to determine quantities for each day
        // Flatten the 2D array and place items sequentially starting from start_date
        console.log(`[ProjectionsCalendar] Job ${job.job_number} using daily_split:`, dailySplit);
        
        let dayOffset = 0;
        dailySplit.forEach((week, weekIndex) => {
          week.forEach((dayQuantity, dayIndex) => {
            if (dayQuantity > 0) {
              // Calculate the actual date - sequential days from start_date
              const date = addDays(jobStart, dayOffset);
              const dateKey = getDateKey(date);
              const dayData = daysMap.get(dateKey);

              console.log(`[ProjectionsCalendar] Job ${job.job_number} day ${dayOffset}:`, {
                date: format(date, 'yyyy-MM-dd'),
                dateKey,
                quantity: dayQuantity,
                foundInMap: !!dayData
              });

              if (dayData) {
                dayData.jobs.push({
                  job,
                  quantity: dayQuantity
                });
                dayData.totalQuantity += dayQuantity;
              }
            }
            dayOffset++; // Move to next day regardless of quantity
          });
        });
      }
    });

    const result = Array.from(daysMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
    const daysWithJobs = result.filter(d => d.jobs.length > 0);
    console.log('[ProjectionsCalendar] Days with jobs:', daysWithJobs.length);
    console.log('[ProjectionsCalendar] First day with jobs:', daysWithJobs[0]);

    return result;
  }, [calendarDays, jobs]);

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const daysWithJobs = calendarWithJobs.filter(d => d.jobs.length > 0).length;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-4">
      {/* Debug Info */}
      <div className="bg-gray-100 border border-gray-300 rounded p-3 mb-4">
        <div className="text-sm font-semibold text-gray-700 mb-2">Debug Info:</div>
        <div className="text-xs text-gray-600 space-y-1">
          <div>Jobs received: {jobs.length}</div>
          <div>Calendar days generated: {calendarWithJobs.length}</div>
          <div>Days with jobs: {daysWithJobs}</div>
          <div>Displaying month: {format(startDate, 'MMMM yyyy')}</div>
          {jobs.length > 0 && (
            <>
              <div className="mt-2 font-semibold">First 3 jobs:</div>
              {jobs.slice(0, 3).map(job => {
                const start = job.start_date ? timestampToDate(job.start_date) : null;
                const end = job.due_date ? timestampToDate(job.due_date) : null;
                return (
                  <div key={job.id} className="ml-2">
                    #{job.job_number}: {start ? format(start, 'MM/dd/yy') : 'N/A'} to {end ? format(end, 'MM/dd/yy') : 'N/A'} | 
                    Qty: {job.quantity} | 
                    Split: {(job as any).daily_split ? 'Yes' : 'No'}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-[var(--dark-blue)]">
          Job Calendar - {format(startDate, 'MMMM yyyy')}
        </h3>
        <div className="text-sm text-gray-600">
          {jobs.length} total jobs | {daysWithJobs} days with jobs
        </div>
      </div>

      {jobs.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No jobs found. Add jobs to see them on the calendar.
        </div>
      )}

      {jobs.length > 0 && daysWithJobs === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="text-center text-gray-700">
            <p className="font-semibold mb-2">No jobs scheduled for {format(startDate, 'MMMM yyyy')}</p>
            <p className="text-sm mb-2">Found {jobs.length} jobs total, but none fall in this month.</p>
            <details className="mt-2 text-left">
              <summary className="cursor-pointer text-blue-600 hover:text-blue-800">View job date ranges</summary>
              <div className="mt-2 max-h-60 overflow-y-auto text-xs">
                {jobs.slice(0, 10).map(job => {
                  const start = job.start_date ? timestampToDate(job.start_date) : null;
                  const end = job.due_date ? timestampToDate(job.due_date) : null;
                  return (
                    <div key={job.id} className="py-1 border-b border-gray-200">
                      Job #{job.job_number}: {start ? format(start, 'MMM d, yyyy') : 'No start'} - {end ? format(end, 'MMM d, yyyy') : 'No end'}
                      {(job as any).daily_split ? ' (has daily_split)' : ' (no daily_split)'}
                    </div>
                  );
                })}
                {jobs.length > 10 && <div className="py-1 text-gray-500">... and {jobs.length - 10} more</div>}
              </div>
            </details>
          </div>
        </div>
      )}

      <div className="grid grid-cols-7 gap-1">
        {/* Week day headers */}
        {weekDays.map(day => (
          <div
            key={day}
            className="text-center text-sm font-semibold text-[var(--text-light)] py-2 bg-gray-50 rounded"
          >
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {calendarWithJobs.map((dayData, index) => {
          const isToday = isSameDay(dayData.date, new Date());

          return (
            <div
              key={index}
              className={`min-h-[120px] border rounded-lg p-2 ${
                !dayData.isCurrentMonth
                  ? 'bg-gray-50 opacity-50'
                  : isToday
                  ? 'bg-blue-50 border-blue-300'
                  : 'bg-white border-gray-200'
              }`}
            >
              {/* Date header */}
              <div
                className={`text-sm font-semibold mb-1 ${
                  isToday
                    ? 'text-blue-700'
                    : !dayData.isCurrentMonth
                    ? 'text-gray-400'
                    : 'text-[var(--text-dark)]'
                }`}
              >
                {format(dayData.date, 'd')}
              </div>

              {/* Total quantity for the day */}
              {dayData.totalQuantity > 0 && (
                <div className="text-xs font-semibold text-blue-600 mb-2">
                  Total: {Math.round(dayData.totalQuantity).toLocaleString()} pcs
                </div>
              )}

              {/* Jobs for this day */}
              <div className="space-y-1 max-h-[80px] overflow-y-auto">
                {dayData.jobs.map((dayJob, jobIndex) => (
                  <div
                    key={jobIndex}
                    className="text-xs bg-blue-100 rounded p-1 border border-blue-200"
                    title={`Job ${dayJob.job.job_number}\nClient: ${dayJob.job.client.name}\nQuantity: ${Math.round(dayJob.quantity).toLocaleString()} pcs\nService: ${dayJob.job.service_type}`}
                  >
                    <div className="font-semibold text-[var(--dark-blue)] truncate">
                      #{dayJob.job.job_number}
                    </div>
                    <div className="text-gray-700 truncate">
                      {dayJob.job.client.name}
                    </div>
                    <div className="text-blue-700 font-medium">
                      {Math.round(dayJob.quantity).toLocaleString()} pcs
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs text-[var(--text-light)]">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-50 border-2 border-blue-300 rounded"></div>
          <span>Today</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded"></div>
          <span>Job</span>
        </div>
      </div>
    </div>
  );
}

