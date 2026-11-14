import { StrictMode, useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useLatestRequest } from './useLatestRequest';

const Harness = () => {
  const latest = useLatestRequest();
  const [result, setResult] = useState('none');
  const run = (value: string, delay: number) => {
    const request = latest.begin();
    setTimeout(() => { if (latest.isCurrent(request)) setResult(value); }, delay);
  };
  return <><output>{result}</output><button onClick={() => run('old', 30)}>old</button><button onClick={() => run('new', 5)}>new</button></>;
};

describe('useLatestRequest', () => {
  it('ignores a stale response even under React StrictMode', async () => {
    render(<StrictMode><Harness /></StrictMode>);
    fireEvent.click(screen.getByRole('button', { name: 'old' }));
    fireEvent.click(screen.getByRole('button', { name: 'new' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('new'));
    await new Promise(resolve => setTimeout(resolve, 40));
    expect(screen.getByRole('status')).toHaveTextContent('new');
  });
});
