import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmAction } from './confirm-action';

@Component({
  imports: [ConfirmAction],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <app-confirm-action
        title="Switch it off?"
        message="Structure A will no longer be offered."
        confirmLabel="Switch off"
        cancelLabel="Cancel"
        [tone]="tone()"
        (confirm)="confirmed.set(confirmed() + 1)"
        (cancel)="open.set(false)"
      />
    }
  `,
})
class Host {
  readonly open = signal(true);
  readonly tone = signal<'danger' | 'success'>('danger');
  readonly confirmed = signal(0);
}

describe('ConfirmAction', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const el = () => fixture.nativeElement as HTMLElement;
  const button = (cls: string) => el().querySelector(`button.${cls}`) as HTMLButtonElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Host] });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('states what changes and is labelled for assistive technology', () => {
    const dialog = el().querySelector('[role="alertdialog"]') as HTMLElement;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(el().querySelector(`#${dialog.getAttribute('aria-labelledby')}`)?.textContent).toContain(
      'Switch it off?',
    );
    expect(
      el().querySelector(`#${dialog.getAttribute('aria-describedby')}`)?.textContent,
    ).toContain('Structure A will no longer be offered.');
  });

  it('does nothing until the user confirms', () => {
    expect(host.confirmed()).toBe(0);
    expect(host.open()).toBe(true);
  });

  it('confirms once, however often the button is pressed', () => {
    button('btn-confirm').click();
    button('btn-confirm').click();
    button('btn-confirm').click();
    expect(host.confirmed()).toBe(1);
  });

  it('cancels from the button and from Escape, without confirming', () => {
    button('btn-cancel').click();
    fixture.detectChanges();
    expect(host.open()).toBe(false);
    expect(host.confirmed()).toBe(0);

    host.open.set(true);
    fixture.detectChanges();
    (el().querySelector('[role="alertdialog"]') as HTMLElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();
    expect(host.open()).toBe(false);
    expect(host.confirmed()).toBe(0);
  });

  it('colours a switching-off action as a warning and a switching-on action as a success', () => {
    expect(button('btn-confirm').classList.contains('btn-danger')).toBe(true);
    host.tone.set('success');
    fixture.detectChanges();
    expect(button('btn-confirm').classList.contains('btn-success')).toBe(true);
    expect(button('btn-confirm').classList.contains('btn-danger')).toBe(false);
  });
});
