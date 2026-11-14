import { useRef, useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DialogOverlay } from './DialogOverlay';

describe('DialogOverlay', () => {
  it('keeps focus while typing and closes with Escape', async () => {
    const close = vi.fn();
    const user = userEvent.setup();
    render(<DialogOverlay label="Approval comment" onClose={close}><section className="modal-content"><textarea aria-label="Reason" /></section></DialogOverlay>);
    const reason = screen.getByRole('textbox', { name: 'Reason' });
    await waitFor(() => expect(reason).toHaveFocus());
    await user.type(reason, 'Complete approval reason');
    expect(reason).toHaveValue('Complete approval reason');
    expect(reason).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).toHaveBeenCalledOnce();
  });

  it('restores focus to the control that opened it', async () => {
    const Host = () => {
      const [open, setOpen] = useState(false);
      const input = useRef<HTMLTextAreaElement>(null);
      return <><button onClick={() => setOpen(true)}>Review</button>{open && <DialogOverlay label="Review" onClose={() => setOpen(false)} initialFocusRef={input}><section className="modal-content"><textarea ref={input} /></section></DialogOverlay>}</>;
    };
    render(<Host />);
    const trigger = screen.getByRole('button', { name: 'Review' });
    trigger.focus();
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Review' }).querySelector('textarea')).toHaveFocus());
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
