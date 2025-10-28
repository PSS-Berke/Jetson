'use client';

import { DayBreakdown } from '@/types/calendar';
import { formatCurrency, formatNumber } from '@/lib/calendarUtils';
import { formatHours } from '@/lib/capacityUtils';
import { formatDateObject } from '@/lib/dateUtils';
import CapacityIndicator from './CapacityIndicator';

interface DayDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  dayBreakdown: DayBreakdown | null;
}

export default function DayDetailsModal({
  isOpen,
  onClose,
  dayBreakdown
}: DayDetailsModalProps) {
  if (!isOpen || !dayBreakdown) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <div>
            <h2 className="text-2xl font-bold text-[var(--dark-blue)]">
              {formatDateObject(dayBreakdown.date, 'EEEE, MMMM dd, yyyy')}
            </h2>
            <p className="text-sm text-[var(--text-light)] mt-1">
              Daily Summary & Breakdown
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-3xl leading-none font-light"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Daily Totals */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-[var(--text-light)] mb-1">Total Pieces</p>
              <p className="text-2xl font-bold text-[var(--dark-blue)]">
                {formatNumber(dayBreakdown.totalPieces)}
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-[var(--text-light)] mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-[var(--success)]">
                {formatCurrency(dayBreakdown.totalRevenue)}
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-[var(--text-light)] mb-1">Overall Utilization</p>
              <p className="text-2xl font-bold text-[var(--primary-blue)]">
                {dayBreakdown.overallUtilization}%
              </p>
            </div>
          </div>

          {/* Shift Breakdown */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="text-sm font-semibold text-[var(--text-dark)] mb-3">
              Shift Utilization
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[var(--text-light)] mb-2">1st Shift (8am-4pm)</p>
                <CapacityIndicator
                  utilizationPercent={dayBreakdown.shift1Utilization}
                  size="sm"
                />
              </div>
              <div>
                <p className="text-xs text-[var(--text-light)] mb-2">2nd Shift (4pm-12am)</p>
                <CapacityIndicator
                  utilizationPercent={dayBreakdown.shift2Utilization}
                  size="sm"
                />
              </div>
            </div>
          </div>

          {/* Jobs Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-4">
              Jobs ({dayBreakdown.jobs.length})
            </h3>
            {dayBreakdown.jobs.length === 0 ? (
              <p className="text-center text-[var(--text-light)] py-8">
                No jobs scheduled for this day
              </p>
            ) : (
              <div className="space-y-3">
                {dayBreakdown.jobs.map(jobDetail => (
                  <div
                    key={jobDetail.job.id}
                    className="border border-[var(--border)] rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-[var(--text-dark)]">
                          Job #{jobDetail.job.job_number} - {jobDetail.job.job_name || 'Untitled'}
                        </h4>
                        <p className="text-sm text-[var(--text-light)]">
                          {jobDetail.job.client.name}
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                        {jobDetail.job.service_type}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-[var(--text-light)] mb-1">Pieces This Day</p>
                        <p className="font-semibold text-[var(--text-dark)]">
                          {formatNumber(jobDetail.piecesThisDay)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[var(--text-light)] mb-1">Revenue This Day</p>
                        <p className="font-semibold text-[var(--text-dark)]">
                          {formatCurrency(jobDetail.revenueThisDay)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[var(--text-light)] mb-1">Hours Required</p>
                        <p className="font-semibold text-[var(--text-dark)]">
                          {formatHours(jobDetail.hoursThisDay)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[var(--text-light)] mb-1">Shifts</p>
                        <p className="font-semibold text-[var(--text-dark)]">
                          {jobDetail.shifts.join(', ')}
                        </p>
                      </div>
                    </div>

                    {/* Assigned Machines */}
                    {jobDetail.machines.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-[var(--text-light)] mb-2">Assigned Machines:</p>
                        <div className="flex flex-wrap gap-2">
                          {jobDetail.machines.map(machine => (
                            <span
                              key={machine.machineId}
                              className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                            >
                              Line {machine.machineLine} ({formatHours(machine.hoursAllocated)})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Machines Section */}
          <div>
            <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-4">
              Machine Utilization ({dayBreakdown.machines.length})
            </h3>
            {dayBreakdown.machines.length === 0 ? (
              <p className="text-center text-[var(--text-light)] py-8">
                No machines assigned for this day
              </p>
            ) : (
              <div className="space-y-3">
                {dayBreakdown.machines.map(machineDetail => (
                  <div
                    key={machineDetail.machine.id}
                    className="border border-[var(--border)] rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-[var(--text-dark)]">
                          Line {machineDetail.machine.line} - {machineDetail.machine.type}
                        </h4>
                        <p className="text-sm text-[var(--text-light)]">
                          {formatHours(machineDetail.totalHoursAllocated)} / {formatHours(machineDetail.availableHours)} hours
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          machineDetail.status === 'running'
                            ? 'bg-green-100 text-green-800'
                            : machineDetail.status === 'available' || machineDetail.status === 'avalible'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {machineDetail.status}
                      </span>
                    </div>

                    <CapacityIndicator
                      utilizationPercent={machineDetail.utilizationPercent}
                      size="sm"
                      className="mb-3"
                    />

                    {/* Jobs on this machine */}
                    {machineDetail.jobs.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-[var(--text-light)] mb-2">
                          Jobs on this machine:
                        </p>
                        <div className="space-y-1">
                          {machineDetail.jobs.map((job, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className="text-[var(--text-dark)]">
                                Job #{job.jobNumber} - {job.clientName}
                              </span>
                              <span className="font-semibold text-[var(--primary-blue)]">
                                {formatHours(job.hours)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Shift breakdown */}
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="text-[var(--text-light)]">1st Shift</p>
                          <p className="font-semibold text-[var(--text-dark)]">
                            {formatHours(machineDetail.shift1Hours)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[var(--text-light)]">2nd Shift</p>
                          <p className="font-semibold text-[var(--text-dark)]">
                            {formatHours(machineDetail.shift2Hours)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-[var(--border)] rounded-lg font-semibold text-[var(--text-dark)] hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
