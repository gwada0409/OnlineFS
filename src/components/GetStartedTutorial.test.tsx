import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GetStartedTutorial } from './GetStartedTutorial';
import type { TutorialStep } from '../lib/tutorial';

const steps: TutorialStep[] = [
  { id: 'welcome', title: 'Welcome', description: 'Begin your tour.', target: '#tour-target' },
  { id: 'finish', title: 'Ready', description: 'Restart any time.', target: '#tour-target' }
];

describe('Get Started tutorial', () => {
  it('supports forward, back, and finish without activating the highlighted control', async () => {
    const close = vi.fn();
    const action = vi.fn();
    const user = userEvent.setup();
    render(<><button id="tour-target" onClick={action}>Real action</button><GetStartedTutorial steps={steps} onClose={close} onNavigationStep={vi.fn()} /></>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus());
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByText('Step 2 of 2')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Back' })).toHaveAttribute('aria-disabled', 'false'));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(screen.getByText('Step 1 of 2')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toHaveAttribute('aria-disabled', 'false'));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    const finish = await screen.findByRole('button', { name: 'Finish' });
    await waitFor(() => expect(finish).toHaveAttribute('aria-disabled', 'false'));
    await user.click(finish);
    expect(close).toHaveBeenCalledWith('finished');
    expect(action).not.toHaveBeenCalled();
  });
  it('can skip with a button or Escape and restart at step one', async () => {
    const outcomes = vi.fn();
    function Host() {
      const [open, setOpen] = useState(false);
      return <><button id="tour-target" onClick={() => setOpen(true)}>Get Started</button>{open && <GetStartedTutorial steps={steps} onNavigationStep={vi.fn()} onClose={outcome => { outcomes(outcome); setOpen(false); }} />}</>;
    }
    render(<Host />);
    const trigger = screen.getByRole('button', { name: 'Get Started' });
    trigger.focus();
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus());
    fireEvent.click(screen.getByRole('button', { name: 'Skip tutorial' }));
    expect(outcomes).toHaveBeenLastCalledWith('skipped');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(outcomes).toHaveBeenCalledTimes(2);
    expect(trigger).toHaveFocus();
  });
  it('makes background controls inert and restores them on close', () => {
    const main = document.createElement('main');
    main.className = 'main-content';
    document.body.appendChild(main);
    const { unmount } = render(<GetStartedTutorial steps={steps} onClose={vi.fn()} onNavigationStep={vi.fn()} />);
    expect(main).toHaveAttribute('inert');
    unmount();
    expect(main).not.toHaveAttribute('inert');
    main.remove();
  });
  it('cycles keyboard focus inside the tutorial in both directions', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockReturnValue(document.body);
    render(<GetStartedTutorial steps={steps} onClose={vi.fn()} onNavigationStep={vi.fn()} />);
    const next = screen.getByRole('button', { name: 'Next' });
    const changeSection = screen.getByRole('button', { name: 'Change section' });
    await waitFor(() => expect(next).toHaveFocus());
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(changeSection).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(next).toHaveFocus();
  });
});
