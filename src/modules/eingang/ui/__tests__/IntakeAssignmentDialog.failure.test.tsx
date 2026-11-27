// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { AssignmentPorts, AssignmentReadResult, AssignmentView } from '../../assignmentContract';
import { IntakeAssignmentDialog } from '../IntakeAssignmentDialog';

afterEach(cleanup);

// The only synthetic boundary is the dialog's remote read action.
const savedMail: AssignmentView = {
  itemId: 'test-saved-mail', version: 1, channel: 'mail', assignment: 'offen', usage: 'offen',
  senderName: 'TEST Absender', senderAddress: 'test@example.invalid', subject: 'TEST Anfrage',
  text: null, at: '2026-11-26T12:00:00Z', customer: null, files: [],
  proposals: [{ id: 'test-customer', name: 'TEST Kundenfirma', type: 'firma', reason: null }],
  areas: ['eingang', 'kunden', 'auftraege'], restricted: false, concerns: [], duplicates: [],
};

it('M09 offers a fresh mailbox read for an existing mail opened by its id', async () => {
  const read = vi.fn<AssignmentPorts['read']>()
    .mockRejectedValueOnce(new Error('TEST network interruption'))
    .mockResolvedValueOnce({ code: 'OK', view: savedMail } satisfies AssignmentReadResult);
  const ports: AssignmentPorts = {
    read, assign: vi.fn(), noBusiness: vi.fn(), search: vi.fn(),
    openCustomer: vi.fn(), openCapture: vi.fn(), openNewCustomer: vi.fn(), openConversation: vi.fn(),
  };

  render(<IntakeAssignmentDialog itemId={savedMail.itemId} mode="normal" ports={ports} onClose={vi.fn()} onMessage={vi.fn()} />);

  expect(await screen.findByRole('alert')).toHaveTextContent('Postfach nicht erreichbar');
  expect(screen.queryByRole('button', { name: 'Anbindungen' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Erneut' }));

  expect(await screen.findByText('TEST Kundenfirma')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Kunde zuordnen' })).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(read.mock.calls).toEqual([
    [{ itemId: savedMail.itemId, mode: 'normal' }],
    [{ itemId: savedMail.itemId, mode: 'normal' }],
  ]);
  expect(ports.assign).not.toHaveBeenCalled();
});
