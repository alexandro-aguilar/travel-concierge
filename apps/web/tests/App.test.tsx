import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import type { ApprovalResponse, MessageResponse, Session, Trip } from '../src/api/contracts';

const session: Session = {
  sessionId: '00000000-0000-4000-8000-000000000001',
  status: 'AWAITING_APPROVAL',
  createdAt: '2026-08-10T12:00:00.000Z',
  messages: [
    {
      messageId: 'm1',
      role: 'ASSISTANT',
      content: 'I found a trip.',
      createdAt: '2026-08-10T12:01:00.000Z',
    },
  ],
};
const trip: Trip = {
  sessionId: session.sessionId,
  status: 'AWAITING_APPROVAL',
  requirements: {},
  recommendation: {
    flight: {
      id: 'flight',
      price: { amount: 300, currency: 'USD' },
      stops: 0,
      durationMinutes: 480,
      departureDate: '2026-09-12',
      returnDate: '2026-09-18',
    },
    hotel: {
      id: 'hotel',
      price: { amount: 400, currency: 'USD' },
      rating: 4.5,
      checkInDate: '2026-09-12',
      checkOutDate: '2026-09-18',
    },
    total: { amount: 700, currency: 'USD' },
    budgetDelta: 300,
    score: 0.8,
    rejectedConstraints: [],
    tradeoffs: ['No matching event was added'],
    availability: { events: 'UNAVAILABLE', weather: 'UNAVAILABLE' },
  },
};
const client = (overrides: Partial<Record<string, unknown>> = {}) => ({
  createSession: async () => session,
  getSession: async () => session,
  getTrip: async () => trip,
  sendMessage: async (): Promise<MessageResponse> => ({
    sessionId: session.sessionId,
    message: session.messages[0]!,
    trip,
    status: trip.status,
  }),
  approve: async (): Promise<ApprovalResponse> => ({
    trip: {
      ...trip,
      status: 'SIMULATED_BOOKING_COMPLETE',
      booking: {
        status: 'confirmed',
        simulation: true,
        confirmationId: 'DEMO-TEST',
        createdAt: '2026-08-10T12:02:00.000Z',
      },
    },
    booking: {
      status: 'confirmed',
      simulation: true,
      confirmationId: 'DEMO-TEST',
      createdAt: '2026-08-10T12:02:00.000Z',
    },
  }),
  ...overrides,
});
describe('App', () => {
  afterEach(() => cleanup());
  it('shows unavailable optional results and requires a deliberate simulated approval', async () => {
    let currentTrip = trip;
    const simulated: ApprovalResponse = {
      trip: {
        ...trip,
        status: 'SIMULATED_BOOKING_COMPLETE',
        booking: {
          status: 'confirmed',
          simulation: true,
          confirmationId: 'DEMO-TEST',
          createdAt: '2026-08-10T12:02:00.000Z',
        },
      },
      booking: {
        status: 'confirmed',
        simulation: true,
        confirmationId: 'DEMO-TEST',
        createdAt: '2026-08-10T12:02:00.000Z',
      },
    };
    const user = userEvent.setup();
    render(
      <App
        client={
          client({
            getTrip: async () => currentTrip,
            approve: async () => {
              currentTrip = simulated.trip;
              return simulated;
            },
          }) as never
        }
      />,
    );
    expect(await screen.findByText('Events unavailable for this itinerary.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Review simulated booking' }));
    expect(screen.getByRole('dialog', { name: 'Confirm simulated booking?' })).toHaveTextContent(
      'does not make a real reservation',
    );
    await user.click(screen.getByRole('button', { name: 'Confirm simulated booking' }));
    await waitFor(() => expect(screen.getByText('DEMO-TEST')).toBeInTheDocument());
    expect(screen.getByText(/Simulation: true/)).toBeInTheDocument();
  });
  it('disables duplicate message submission while pending', async () => {
    let complete!: (value: MessageResponse) => void;
    const delayed = new Promise<MessageResponse>((resolve) => {
      complete = resolve;
    });
    const user = userEvent.setup();
    render(<App client={client({ sendMessage: () => delayed }) as never} />);
    await screen.findByText('I found a trip.');
    await user.type(screen.getByLabelText('Your trip details'), 'Hello');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    complete({
      sessionId: session.sessionId,
      message: session.messages[0]!,
      trip,
      status: trip.status,
    });
  });
});
