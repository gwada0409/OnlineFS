import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('leave summary print contract', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/LeaveSummaryForm.tsx'), 'utf8');

  it('uses deterministic A4 portrait pages with twenty records per side', () => {
    expect(source).toContain("orderedRequests.slice(0, 20)");
    expect(source).toContain("orderedRequests.slice(20, 40)");
    expect(source).toContain('@page{size:A4 portrait;margin:5mm}');
    expect(source).toContain('Print on both sides');
  });

  it('does not render a leave-request number column in the printed summary', () => {
    expect(source).not.toContain('<th rowSpan={2}>#</th>');
    expect(source).not.toContain('Leave Request #');
  });
});
