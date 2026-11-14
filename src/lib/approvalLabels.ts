const LEGACY_STAGE_LABELS: Array<[RegExp, string]> = [
  [/\b(?:1st|first)\s+approver\b/gi, 'Recommending'],
  [/\b(?:2nd|second)\s+approver\b/gi, 'Approver'],
];

export function approvalStageLabel(label?: string | null, index?: number): string {
  let display = label?.trim() || '';
  for (const [pattern, replacement] of LEGACY_STAGE_LABELS) display = display.replace(pattern, replacement);
  if (display) return display;
  if (index === 0) return 'Recommending';
  if (index === 1) return 'Approver';
  return typeof index === 'number' ? `Approver ${index + 1}` : 'Approver';
}

export function notificationCopy(value: string): string {
  return approvalStageLabel(value).replace(/\b((?:leave\s+)?request|original\s+request)\s*#\s*\d+\b/gi, '$1');
}
