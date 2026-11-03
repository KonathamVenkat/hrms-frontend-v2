import { Component, DestroyRef, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { DiscardPrompt, UnsavedChangesTracker } from './discard-prompt';

/** A stand-in for a component that owns a modal form: the prompt is created as a field, as the real ones do. */
@Component({ selector: 'app-host', template: '' })
class Host {
  dirty = false;
  adding = false;
  readonly discard = new DiscardPrompt(
    () => this.dirty,
    () => this.adding,
  );
  readonly destroyRef = inject(DestroyRef);
}

function setup() {
  const fixture = TestBed.createComponent(Host);
  return { fixture, host: fixture.componentInstance, tracker: TestBed.inject(UnsavedChangesTracker) };
}

describe('DiscardPrompt', () => {
  it('closes a form nobody typed in straight away, without asking', () => {
    const { host } = setup();
    const close = vi.fn();

    host.discard.request(close);

    expect(close).toHaveBeenCalledTimes(1);
    expect(host.discard.asking()).toBe(false);
  });

  it('asks instead of closing when something was typed', () => {
    const { host } = setup();
    const close = vi.fn();
    host.dirty = true;

    host.discard.request(close);

    expect(close).not.toHaveBeenCalled();
    expect(host.discard.asking()).toBe(true);
  });

  it('treats a second request while asking (Escape again) as "keep editing"', () => {
    const { host } = setup();
    const close = vi.fn();
    host.dirty = true;
    host.discard.request(close);

    host.discard.request(close);

    expect(host.discard.asking()).toBe(false);
    expect(close).not.toHaveBeenCalled();
  });

  it('keep() drops the question and leaves the form open', () => {
    const { host } = setup();
    host.dirty = true;
    host.discard.request(vi.fn());

    host.discard.keep();

    expect(host.discard.asking()).toBe(false);
  });

  it('is asked again on the next close after "keep editing"', () => {
    const { host } = setup();
    const close = vi.fn();
    host.dirty = true;
    host.discard.request(close);
    host.discard.keep();

    host.discard.request(close);

    expect(host.discard.asking()).toBe(true);
    expect(close).not.toHaveBeenCalled();
  });
});

describe('UnsavedChangesTracker', () => {
  it('reports unsaved changes while a registered form is dirty, and not after it is clean', () => {
    const { host, tracker } = setup();

    expect(tracker.hasUnsavedChanges()).toBe(false);
    host.dirty = true;
    expect(tracker.hasUnsavedChanges()).toBe(true);
    host.dirty = false;
    expect(tracker.hasUnsavedChanges()).toBe(false);
  });

  it('forgets a form when its component is destroyed', () => {
    const { fixture, host, tracker } = setup();
    host.dirty = true;
    expect(tracker.hasUnsavedChanges()).toBe(true);

    fixture.destroy();

    expect(tracker.hasUnsavedChanges()).toBe(false);
  });

  it('is dirty when any one of several forms is', () => {
    const tracker = TestBed.inject(UnsavedChangesTracker);
    const clean = tracker.register(() => false);
    const dirty = tracker.register(() => true);

    expect(tracker.hasUnsavedChanges()).toBe(true);
    dirty();
    expect(tracker.hasUnsavedChanges()).toBe(false);
    clean();
  });
});

describe('DiscardPrompt for a form that adds a new record', () => {
  it('asks "nothing entered yet" when nothing was typed, instead of closing', () => {
    const { host } = setup();
    const close = vi.fn();
    host.adding = true;

    host.discard.request(close);

    expect(close).not.toHaveBeenCalled();
    expect(host.discard.asking()).toBe(true);
    expect(host.discard.kind()).toBe('empty');
  });

  it('still cannot be closed once something was typed: the first record has to be saved', () => {
    const { host } = setup();
    const close = vi.fn();
    host.adding = true;
    host.dirty = true;

    host.discard.request(close);

    expect(close).not.toHaveBeenCalled();
    expect(host.discard.kind()).toBe('empty');
  });

  it('says the form must be filled in while it adds the first record, and not any more after that', () => {
    const { host } = setup();
    host.adding = true;
    expect(host.discard.mustFill()).toBe(true);

    host.adding = false;
    expect(host.discard.mustFill()).toBe(false);
  });

  it('closes like any other form once the tab has a record: at once when untouched, after a question when typed in', () => {
    const { host } = setup();
    const close = vi.fn();
    host.adding = false;

    host.discard.request(close);
    expect(close).toHaveBeenCalledTimes(1);

    host.dirty = true;
    host.discard.request(close);
    expect(close).toHaveBeenCalledTimes(1);
    expect(host.discard.kind()).toBe('unsaved');
  });

  it('does not report an untouched new form as unsaved changes for the page-level warning', () => {
    const { host, tracker } = setup();
    host.adding = true;

    expect(tracker.hasUnsavedChanges()).toBe(false);
  });

  it('closes an untouched form at once when it edits a saved record', () => {
    const { host } = setup();
    const close = vi.fn();
    host.adding = false;

    host.discard.request(close);

    expect(close).toHaveBeenCalledTimes(1);
    expect(host.discard.asking()).toBe(false);
  });

  it('lets Escape (a second request) mean "enter details" and keep the form open', () => {
    const { host } = setup();
    const close = vi.fn();
    host.adding = true;
    host.discard.request(close);

    host.discard.request(close);

    expect(host.discard.asking()).toBe(false);
    expect(close).not.toHaveBeenCalled();
  });
});
