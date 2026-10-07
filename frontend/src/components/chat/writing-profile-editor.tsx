"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Feather, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { isWritingProfile, MAX_WRITING_SAMPLES, MIN_STYLE_SAMPLES, validateWritingSamples, type WritingProfile } from "@/lib/writing-profile";
import styles from "./writing-profile-editor.module.css";

type Props = { profile: WritingProfile; onSaved: (profile: WritingProfile) => void; busy?: boolean };

export function WritingProfileEditor({ profile, onSaved, busy = false }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<string[]>([]);
  const [revision, setRevision] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const firstInput = useRef<HTMLTextAreaElement>(null);
  const saveController = useRef<AbortController | null>(null);
  const visibleCount = drafts.filter((sample) => sample.trim()).length;

  useEffect(() => () => saveController.current?.abort(), []);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let current = true;
    async function load() {
      setLoading(true);
      setLoadFailed(false);
      setError(null);
      try {
        const response = await fetch("/api/writing-profile", { cache: "no-store", signal: controller.signal });
        const loaded: unknown = await response.json();
        if (!response.ok || !isWritingProfile(loaded)) throw new Error("Unavailable");
        if (!current) return;
        setDrafts(loaded.samples.length ? [...loaded.samples] : ["", "", ""]);
        setRevision(loaded.revision);
      } catch {
        if (current) { setLoadFailed(true); setError("Your samples couldn’t be loaded. Close this editor and try again."); }
      } finally { if (current) setLoading(false); }
    }
    void load();
    return () => { current = false; controller.abort(); };
  }, [open]);

  useEffect(() => { if (open && !loading && !loadFailed) firstInput.current?.focus(); }, [open, loading, loadFailed]);

  async function save() {
    if (savingRef.current || loading || loadFailed) return;
    const samples = drafts.filter((sample) => sample.trim());
    const validation = validateWritingSamples(samples);
    if (validation) { setError(validation); return; }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    const controller = new AbortController();
    saveController.current = controller;
    try {
      const response = await fetch("/api/writing-profile", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samples, revision }), signal: controller.signal,
      });
      const saved: unknown = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok || !isWritingProfile(saved)) {
        setError(response.status === 409
          ? "Your samples changed in another tab. Close and reopen this editor to reload them."
          : "Your samples weren’t saved. Your draft is still here; please try again.");
        return;
      }
      onSaved(saved);
      setOpen(false);
    } catch { if (!controller.signal.aborted) setError("Your samples weren’t saved. Your draft is still here; please try again."); }
    finally { savingRef.current = false; setSaving(false); saveController.current = null; }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!savingRef.current) setOpen(next); }}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className={styles.trigger} disabled={busy} aria-label="Your voice">
          <Feather size={14} aria-hidden="true" /> Your voice
          {profile.samples.length ? <span className={styles.badge}>{profile.samples.length}</span> : null}
        </Button>
      </DialogTrigger>
      <DialogContent className={styles.dialog} onEscapeKeyDown={(event) => { if (savingRef.current) event.preventDefault(); }}>
        <DialogTitle className={styles.title}>Make replies sound like you</DialogTitle>
        <DialogDescription className={styles.description}>Add messages you wrote yourself—not messages you received or AI replies. Mix everyday replies that reflect how you actually text.</DialogDescription>
        <p className={styles.privacy} id={`${id}-privacy`}>Saved privately to your account. Samples are sent to the AI provider when generating replies. Don’t include passwords or sensitive information.</p>
        <form onSubmit={(event) => { event.preventDefault(); void save(); }} aria-busy={loading || saving}>
          {loading ? <p className={styles.note} role="status">Loading your samples…</p> : null}
          {!loading && !loadFailed ? <div className={styles.samples}>
            {drafts.map((sample, index) => (
              <div className={styles.sample} key={`${id}-${index}`}>
                <label htmlFor={`${id}-sample-${index}`}>Your message {index + 1}</label>
                <Textarea ref={index === 0 ? firstInput : undefined} id={`${id}-sample-${index}`} rows={2}
                  aria-describedby={`${id}-privacy${error ? ` ${id}-error` : ""}`} disabled={saving}
                  value={sample} placeholder={index === 0 ? "A message you actually wrote…" : "Another example in your own words…"}
                  onChange={(event) => { setDrafts((current) => current.map((value, position) => position === index ? event.target.value : value)); setError(null); }} />
                <Button type="button" variant="ghost" size="icon" className={styles.remove} disabled={saving} aria-label={`Remove sample ${index + 1}`}
                  onClick={() => { setDrafts((current) => current.length === 1 ? [""] : current.filter((_, position) => position !== index)); setError(null); }}>
                  <Trash2 size={14} aria-hidden="true" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" disabled={saving || drafts.length >= MAX_WRITING_SAMPLES}
              onClick={() => setDrafts((current) => [...current, ""])}><Plus size={14} aria-hidden="true" /> Add another sample</Button>
          </div> : null}
          {!loading && !loadFailed ? <p className={styles.note}>{visibleCount < MIN_STYLE_SAMPLES
            ? "Add at least 3 varied messages to start using your voice. More varied examples give it more evidence—not a guarantee of accuracy."
            : `${visibleCount} messages. Next replies will use these examples; existing replies won’t change.`}</p> : null}
          {error ? <p className={styles.error} id={`${id}-error`} role="alert">{error}</p> : null}
          <div className={styles.actions}>
            <Button type="submit" disabled={loading || saving || loadFailed}>{saving ? "Saving…" : "Save my writing samples"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
