interface ProcessTypeBadgeProps {
  processType: string;
}

export default function ProcessTypeBadge({ processType }: ProcessTypeBadgeProps) {
  // Map process types to their display info (keeping IJ and L/A abbreviated in display)
  const processTypeMap: Record<string, { label: string; color: string; bgColor: string }> = {
    'Insert': { label: 'Insert', color: 'text-blue-800', bgColor: 'bg-blue-100' },
    'Sort': { label: 'Sort', color: 'text-purple-800', bgColor: 'bg-purple-100' },
    'Inkjet': { label: 'IJ', color: 'text-green-800', bgColor: 'bg-green-100' },
    'IJ': { label: 'IJ', color: 'text-green-800', bgColor: 'bg-green-100' }, // Support legacy value
    'Label/Apply': { label: 'L/A', color: 'text-orange-800', bgColor: 'bg-orange-100' },
    'L/A': { label: 'L/A', color: 'text-orange-800', bgColor: 'bg-orange-100' }, // Support legacy value
    'Fold': { label: 'Fold', color: 'text-pink-800', bgColor: 'bg-pink-100' },
    'Laser': { label: 'Laser', color: 'text-red-800', bgColor: 'bg-red-100' },
    'HP Press': { label: 'HP Press', color: 'text-indigo-800', bgColor: 'bg-indigo-100' },
  };

  const typeInfo = processTypeMap[processType] || { label: processType, color: 'text-gray-800', bgColor: 'bg-gray-100' };

  return (
    <span
      className={`inline-flex items-center justify-center px-2 py-1 rounded text-xs font-bold ${typeInfo.bgColor} ${typeInfo.color}`}
      title={processType}
    >
      {typeInfo.label}
    </span>
  );
}
