import React from 'react';
import { ExecutiveAlert, formatCurrency } from '@/lib/cfoUtils';

interface CFOExecutiveAlertsProps {
  alerts: ExecutiveAlert[];
  title?: string;
}

export default function CFOExecutiveAlerts({
  alerts,
  title = 'Executive Alerts',
}: CFOExecutiveAlertsProps) {
  // Get icon for severity
  const getSeverityIcon = (severity: 'critical' | 'warning' | 'info'): string => {
    switch (severity) {
      case 'critical':
        return '🔴';
      case 'warning':
        return '🟡';
      case 'info':
        return '🟢';
    }
  };

  // Get color classes for severity
  const getSeverityColors = (severity: 'critical' | 'warning' | 'info') => {
    switch (severity) {
      case 'critical':
        return {
          border: 'border-red-300',
          bg: 'bg-red-50',
          text: 'text-red-900',
          subtext: 'text-red-700',
          badge: 'bg-red-100 text-red-800',
        };
      case 'warning':
        return {
          border: 'border-yellow-300',
          bg: 'bg-yellow-50',
          text: 'text-yellow-900',
          subtext: 'text-yellow-700',
          badge: 'bg-yellow-100 text-yellow-800',
        };
      case 'info':
        return {
          border: 'border-green-300',
          bg: 'bg-green-50',
          text: 'text-green-900',
          subtext: 'text-green-700',
          badge: 'bg-green-100 text-green-800',
        };
    }
  };

  // Get severity label
  const getSeverityLabel = (severity: 'critical' | 'warning' | 'info'): string => {
    switch (severity) {
      case 'critical':
        return 'CRITICAL';
      case 'warning':
        return 'WARNING';
      case 'info':
        return 'INFO';
    }
  };

  if (alerts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500">Risk indicators and notifications</p>
        </div>
        <div className="text-center py-12">
          <div className="text-6xl mb-4">✓</div>
          <p className="text-lg font-medium text-gray-900">All Clear</p>
          <p className="text-sm text-gray-500 mt-2">No critical alerts or warnings at this time</p>
        </div>
      </div>
    );
  }

  // Group alerts by severity
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');
  const infoAlerts = alerts.filter(a => a.severity === 'info');

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500">Risk indicators and notifications</p>
        </div>

        {/* Alert Summary Badge */}
        <div className="flex gap-2">
          {criticalAlerts.length > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              {criticalAlerts.length} Critical
            </span>
          )}
          {warningAlerts.length > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              {warningAlerts.length} Warning
            </span>
          )}
          {infoAlerts.length > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              {infoAlerts.length} Info
            </span>
          )}
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {alerts.map((alert, index) => {
          const colors = getSeverityColors(alert.severity);
          return (
            <div
              key={alert.id || index}
              className={`border ${colors.border} ${colors.bg} rounded-lg p-4 transition-all hover:shadow-md`}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="flex-shrink-0 text-2xl">
                  {getSeverityIcon(alert.severity)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className={`text-sm font-semibold ${colors.text}`}>
                      {alert.title}
                    </h4>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors.badge} flex-shrink-0`}>
                      {getSeverityLabel(alert.severity)}
                    </span>
                  </div>

                  {/* Description */}
                  <p className={`text-sm ${colors.subtext} mb-2`}>
                    {alert.description}
                  </p>

                  {/* Impact and Action */}
                  <div className="space-y-1">
                    {alert.impact && (
                      <div className="flex items-start gap-2">
                        <span className={`text-xs font-medium ${colors.subtext} min-w-[60px]`}>
                          Impact:
                        </span>
                        <span className={`text-xs ${colors.subtext}`}>
                          {alert.impact}
                        </span>
                      </div>
                    )}

                    {alert.action && (
                      <div className="flex items-start gap-2">
                        <span className={`text-xs font-medium ${colors.subtext} min-w-[60px]`}>
                          Action:
                        </span>
                        <span className={`text-xs ${colors.subtext} italic`}>
                          {alert.action}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Footer */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          {criticalAlerts.length > 0 ? (
            <p className="font-medium text-red-700">
              ⚠️ {criticalAlerts.length} critical issue{criticalAlerts.length > 1 ? 's' : ''} requiring immediate attention
            </p>
          ) : warningAlerts.length > 0 ? (
            <p className="font-medium text-yellow-700">
              ⚡ {warningAlerts.length} warning{warningAlerts.length > 1 ? 's' : ''} to monitor
            </p>
          ) : (
            <p className="font-medium text-green-700">
              ✓ No critical issues. {infoAlerts.length} informational update{infoAlerts.length > 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
