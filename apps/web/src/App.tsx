import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiClientError, SessionApiClient } from './api/client';
import type { Session, Trip } from './api/contracts';
import { clearSessionId, readSessionId, saveSessionId } from './session-store';
import './styles.css';

const formatMoney = (amount: number, currency: string): string =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
const formatDuration = (minutes: number): string => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
const statusLabel = (status?: Trip['status']): string =>
  ({
    COLLECTING_REQUIREMENTS: 'Collecting trip details',
    SEARCHING: 'Searching options',
    OPTIMIZING: 'Comparing options',
    RECOMMENDATION_READY: 'Recommendation ready',
    AWAITING_APPROVAL: 'Ready for your approval',
    SIMULATED_BOOKING_COMPLETE: 'Simulated booking confirmed',
    FAILED: 'Trip needs attention',
  })[status ?? 'COLLECTING_REQUIREMENTS'];

export interface AppProps {
  readonly client?: SessionApiClient;
}
export function App({ client = new SessionApiClient() }: AppProps): React.JSX.Element {
  const [session, setSession] = useState<Session>();
  const [trip, setTrip] = useState<Trip>();
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState('');
  const [approvalOpen, setApprovalOpen] = useState(false);
  const approvalButton = useRef<HTMLButtonElement>(null);
  const messages = useMemo(
    () => [...(session?.messages ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [session],
  );
  const load = async (sessionId: string): Promise<void> => {
    const [loadedSession, loadedTrip] = await Promise.all([
      client.getSession(sessionId),
      client.getTrip(sessionId),
    ]);
    setSession(loadedSession);
    setTrip(loadedTrip);
  };
  const start = async (): Promise<void> => {
    setPending(true);
    setError(undefined);
    try {
      const created = await client.createSession();
      saveSessionId(created.sessionId);
      await load(created.sessionId);
      setNotice('New trip started. Tell the concierge where and when you would like to travel.');
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : 'Unable to start a trip.');
    } finally {
      setPending(false);
    }
  };
  useEffect(() => {
    const existing = readSessionId();
    void (existing
      ? load(existing).catch(() => {
          clearSessionId();
          void start();
        })
      : start());
  }, []);
  const send = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!session || !draft.trim() || pending) return;
    setPending(true);
    setError(undefined);
    try {
      const result = await client.sendMessage(session.sessionId, draft.trim());
      setDraft('');
      await load(result.sessionId);
      setNotice(result.assistantMessage?.content ?? statusLabel(result.trip.status));
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : 'Unable to send your message.');
    } finally {
      setPending(false);
    }
  };
  const approve = async (): Promise<void> => {
    if (!session) return;
    setPending(true);
    setError(undefined);
    try {
      await client.approve(session.sessionId);
      await load(session.sessionId);
      setApprovalOpen(false);
      setNotice('Your simulated booking is confirmed. No payment or real reservation was made.');
    } catch (reason) {
      setError(
        reason instanceof ApiClientError
          ? reason.message
          : 'Unable to complete the simulated booking. Refresh trip details before retrying.',
      );
      try {
        await load(session.sessionId);
      } catch {
        /* retains safe error */
      }
    } finally {
      setPending(false);
    }
  };
  const newTrip = (): void => {
    clearSessionId();
    setSession(undefined);
    setTrip(undefined);
    void start();
  };
  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#top">
          Wayfinder <span>Travel Concierge</span>
        </a>
        <button className="quiet-button" type="button" onClick={newTrip} disabled={pending}>
          New trip
        </button>
      </header>
      <div id="top" className="hero">
        <p className="eyebrow">A considered way to travel</p>
        <h1>Tell us where you want to go.</h1>
        <p>
          We’ll turn your preferences into a transparent itinerary—then wait for your explicit
          approval before a simulated booking.
        </p>
      </div>
      <p className="sr-only" aria-live="polite">
        {notice}
      </p>
      {error && (
        <div className="alert" role="alert">
          <strong>We couldn’t finish that action.</strong>
          <span>{error}</span>
          <button type="button" onClick={() => session && void load(session.sessionId)}>
            Reload trip
          </button>
        </div>
      )}
      <section className="workspace" aria-label="Trip concierge">
        <div className="conversation panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Conversation</p>
              <h2>{statusLabel(trip?.status ?? session?.status)}</h2>
            </div>
            <span className={`status ${trip?.status === 'FAILED' ? 'status-danger' : ''}`}>
              {trip?.status?.replaceAll('_', ' ') ?? 'STARTING'}
            </span>
          </div>
          <div className="transcript" aria-live="polite">
            {messages.length === 0 && (
              <p className="empty">
                Start with something like: “Mexico City to London, September 12–18, two people,
                $1,000 USD.”
              </p>
            )}
            {messages.map((message) => (
              <article
                className={`message message-${message.role.toLowerCase()}`}
                key={message.messageId}
              >
                <span>{message.role === 'USER' ? 'You' : 'Concierge'}</span>
                <p>{message.content}</p>
              </article>
            ))}
          </div>
          <form className="composer" onSubmit={send}>
            <label htmlFor="message">Your trip details</label>
            <textarea
              id="message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={pending || !session}
              placeholder="Where would you like to go?"
              maxLength={4000}
            />
            <div>
              <span>
                {pending ? 'Working on it…' : 'Your details are only sent to the concierge.'}
              </span>
              <button
                className="primary-button"
                disabled={pending || !draft.trim() || !session}
                type="submit"
              >
                Send message
              </button>
            </div>
          </form>
        </div>
        <TripPanel trip={trip} pending={pending} onApprove={() => setApprovalOpen(true)} />
      </section>
      {approvalOpen && (
        <ApprovalDialog
          pending={pending}
          onCancel={() => {
            setApprovalOpen(false);
            approvalButton.current?.focus();
          }}
          onConfirm={() => void approve()}
        />
      )}
    </main>
  );
}

function TripPanel({
  trip,
  pending,
  onApprove,
}: {
  readonly trip?: Trip;
  readonly pending: boolean;
  readonly onApprove: () => void;
}): React.JSX.Element {
  const recommendation = trip?.recommendation;
  return (
    <aside className="summary panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Your itinerary</p>
          <h2>
            {trip?.booking
              ? 'Simulation confirmed'
              : recommendation
                ? 'Selected plan'
                : 'Trip summary'}
          </h2>
        </div>
      </div>
      {trip?.booking ? (
        <div className="confirmation">
          <span>SIMULATED BOOKING</span>
          <strong>{trip.booking.confirmationId}</strong>
          <p>Simulation: true. No payment, reservation, or ticket was created.</p>
        </div>
      ) : recommendation ? (
        <>
          <section className="cost-card">
            <span>Total trip estimate</span>
            <strong>
              {formatMoney(recommendation.total.amount, recommendation.total.currency)}
            </strong>
            <p className={recommendation.budgetDelta < 0 ? 'over-budget' : ''}>
              {recommendation.budgetDelta >= 0
                ? `${formatMoney(recommendation.budgetDelta, recommendation.total.currency)} remaining`
                : `${formatMoney(Math.abs(recommendation.budgetDelta), recommendation.total.currency)} over budget`}
            </p>
          </section>
          <Option
            title="Flight"
            detail={`${recommendation.flight.stops === 0 ? 'Nonstop' : `${recommendation.flight.stops} stop`} · ${formatDuration(recommendation.flight.durationMinutes)}`}
            price={recommendation.flight.price}
          />
          <Option
            title="Hotel"
            detail={`${recommendation.hotel.rating.toFixed(1)} / 5 rating`}
            price={recommendation.hotel.price}
          />
          {recommendation.event ? (
            <Option
              title={`Event · ${recommendation.event.category}`}
              detail={recommendation.event.date}
              price={recommendation.event.price}
            />
          ) : (
            <Availability
              label="Events"
              available={recommendation.availability.events === 'AVAILABLE'}
            />
          )}
          {recommendation.weather ? (
            <p className="weather">
              Weather forecast: {recommendation.weather.precipitationProbability}% precipitation
              probability.
            </p>
          ) : (
            <Availability
              label="Weather forecast"
              available={recommendation.availability.weather === 'AVAILABLE'}
            />
          )}
          {recommendation.tradeoffs.length > 0 && (
            <section className="tradeoffs">
              <h3>Tradeoffs</h3>
              <ul>
                {recommendation.tradeoffs.map((tradeoff) => (
                  <li key={tradeoff}>{tradeoff}</li>
                ))}
              </ul>
            </section>
          )}
          {trip.status === 'AWAITING_APPROVAL' && (
            <button
              className="primary-button approval"
              type="button"
              onClick={onApprove}
              disabled={pending}
            >
              Review simulated booking
            </button>
          )}
        </>
      ) : (
        <p className="empty">
          Your selected itinerary, price estimate, and trip tradeoffs will appear here once the
          concierge has enough details.
        </p>
      )}
      {trip?.failure && (
        <div className="failure">
          <strong>{trip.failure.code.replaceAll('_', ' ')}</strong>
          <p>{trip.failure.message}</p>
        </div>
      )}
    </aside>
  );
}
function Option({
  title,
  detail,
  price,
}: {
  readonly title: string;
  readonly detail: string;
  readonly price: { readonly amount: number; readonly currency: string };
}): React.JSX.Element {
  return (
    <section className="option">
      <div>
        <h3>{title}</h3>
        <p>{detail}</p>
      </div>
      <strong>{formatMoney(price.amount, price.currency)}</strong>
    </section>
  );
}
function Availability({
  label,
  available,
}: {
  readonly label: string;
  readonly available: boolean;
}): React.JSX.Element {
  return (
    <p className="availability">
      {available
        ? `${label}: no matching option was selected.`
        : `${label} unavailable for this itinerary.`}
    </p>
  );
}
function ApprovalDialog({
  pending,
  onCancel,
  onConfirm,
}: {
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}): React.JSX.Element {
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="approval-title">
        <p className="eyebrow">One final confirmation</p>
        <h2 id="approval-title">Confirm simulated booking?</h2>
        <p>
          This does not make a real reservation, issue a ticket, or charge a payment method. It
          creates a demo-only confirmation.
        </p>
        <div className="dialog-actions">
          <button type="button" className="quiet-button" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={onConfirm} disabled={pending}>
            {pending ? 'Confirming…' : 'Confirm simulated booking'}
          </button>
        </div>
      </section>
    </div>
  );
}
