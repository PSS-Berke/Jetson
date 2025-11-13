import {
  PROCESS_TYPE_CONFIGS,
  normalizeProcessType,
} from "@/lib/processTypeConfig";

interface ProcessTypeBadgeProps {
  processType: string;
}

// Convert hex color to Tailwind color classes
function hexToTailwindClasses(hexColor: string): {
  textColor: string;
  bgColor: string;
} {
  const colorMap: Record<string, { textColor: string; bgColor: string }> = {
    "#3B82F6": { textColor: "text-blue-800", bgColor: "bg-blue-100" }, // Blue
    "#8B5CF6": { textColor: "text-purple-800", bgColor: "bg-purple-100" }, // Purple
    "#10B981": { textColor: "text-green-800", bgColor: "bg-green-100" }, // Green
    "#F59E0B": { textColor: "text-orange-800", bgColor: "bg-orange-100" }, // Orange
    "#EC4899": { textColor: "text-pink-800", bgColor: "bg-pink-100" }, // Pink
    "#EF4444": { textColor: "text-red-800", bgColor: "bg-red-100" }, // Red
    "#6366F1": { textColor: "text-indigo-800", bgColor: "bg-indigo-100" }, // Indigo
  };

  return (
    colorMap[hexColor] || { textColor: "text-gray-800", bgColor: "bg-gray-100" }
  );
}

export default function ProcessTypeBadge({
  processType,
}: ProcessTypeBadgeProps) {
  // Normalize the process type to match config keys
  const normalized = normalizeProcessType(processType);
  const config = PROCESS_TYPE_CONFIGS.find((c) => c.key === normalized);

  // Get abbreviated labels for some process types
  const getDisplayLabel = (key: string, fullLabel: string): string => {
    if (key === "inkjet") return "IJ";
    if (key === "labelApply") return "L/A";
    return fullLabel;
  };

  const label = config
    ? getDisplayLabel(config.key, config.label)
    : processType;
  const colors = config
    ? hexToTailwindClasses(config.color)
    : { textColor: "text-gray-800", bgColor: "bg-gray-100" };
  const typeInfo = { label, ...colors };

  return (
    <span
      className={`inline-flex items-center justify-center px-2 py-1 rounded text-xs font-bold ${typeInfo.bgColor} ${typeInfo.textColor}`}
      title={processType}
    >
      {typeInfo.label}
    </span>
  );
}
