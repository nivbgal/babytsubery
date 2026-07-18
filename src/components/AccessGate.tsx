import { FormEvent, useId, useState } from "react";
import { ArrowRight, Eye, LoaderCircle, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import "./AccessGate.css";

export type GuestInviteState = "none" | "checking" | "invalid" | "expired";

export interface AccessGateProps {
  onParentLogin: (password: string) => Promise<void>;
  guestInviteState?: GuestInviteState;
  demoPreview?: boolean;
  onDemoPreview?: () => void;
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message && !error.message.startsWith("{")) return error.message;
  return "We couldn’t open the journal. Please check the password and try again.";
}

export function AccessGate({
  onParentLogin,
  guestInviteState = "none",
  demoPreview = false,
  onDemoPreview,
}: AccessGateProps) {
  const passwordId = useId();
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password || isSubmitting) return;
    setLoginError("");
    setIsSubmitting(true);
    try {
      await onParentLogin(password);
      setPassword("");
    } catch (error) {
      setLoginError(errorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  const inviteMessage =
    guestInviteState === "invalid"
      ? "This family invitation isn’t valid. Ask the parents for a fresh link."
      : guestInviteState === "expired"
        ? "This family invitation has expired. Ask the parents for a new one."
        : "";

  return (
    <main className="access-gate">
      <section className="access-gate__card" aria-labelledby="access-title">
        <div className="access-gate__keepsake" aria-hidden="true">
          <span className="access-gate__date">A FAMILY KEEPSAKE</span>
          <div className="access-gate__frame">
            <Sparkles size={28} strokeWidth={1.4} />
            <span>one little day at a time</span>
          </div>
          <p>Photographs, tiny stories, and all the moments worth holding close.</p>
        </div>

        <div className="access-gate__entry">
          <div className="access-gate__mark" aria-hidden="true">
            <ShieldCheck size={22} />
          </div>
          <p className="access-gate__eyebrow">Private family journal</p>
          <h1 id="access-title">Welcome to the world Baby Tsubery</h1>
          <p className="access-gate__intro">
            A quiet place for loved ones to follow her story. Family guests enter automatically from their private invitation link.
          </p>

          {guestInviteState === "checking" && (
            <div className="access-gate__notice access-gate__notice--loading" role="status" aria-live="polite">
              <LoaderCircle className="access-gate__spinner" size={20} aria-hidden="true" />
              Opening your family invitation…
            </div>
          )}

          {inviteMessage && (
            <div className="access-gate__notice access-gate__notice--error" role="alert" aria-live="assertive">
              <LockKeyhole size={19} aria-hidden="true" />
              <span>{inviteMessage}</span>
            </div>
          )}

          <div className="access-gate__divider" aria-hidden="true"><span>Parents</span></div>

          <form className="access-gate__form" onSubmit={handleSubmit}>
            <label htmlFor={passwordId}>Parent password</label>
            <div className="access-gate__field">
              <LockKeyhole size={19} aria-hidden="true" />
              <input
                id={passwordId}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                disabled={isSubmitting}
                aria-describedby={loginError ? `${passwordId}-error` : undefined}
              />
            </div>
            {loginError && <p className="access-gate__field-error" id={`${passwordId}-error`} role="alert">{loginError}</p>}
            <button className="access-gate__submit" type="submit" disabled={isSubmitting || !password}>
              {isSubmitting ? (
                <><LoaderCircle className="access-gate__spinner" size={19} aria-hidden="true" /> Opening journal…</>
              ) : (
                <>Enter as a parent <ArrowRight size={19} aria-hidden="true" /></>
              )}
            </button>
          </form>

          {demoPreview && onDemoPreview && (
            <button className="access-gate__demo" type="button" onClick={onDemoPreview}>
              <Eye size={18} aria-hidden="true" /> Preview with demo memories
            </button>
          )}

          <p className="access-gate__privacy"><LockKeyhole size={14} aria-hidden="true" /> Photos stay private and are never indexed by search engines.</p>
        </div>
      </section>
    </main>
  );
}
