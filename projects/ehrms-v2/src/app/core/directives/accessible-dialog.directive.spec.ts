import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AccessibleDialogDirective } from './accessible-dialog.directive';

@Component({
  imports: [AccessibleDialogDirective],
  template: `<div [appAccessibleDialog]="'t'" (dialogClosed)="closed = closed + 1">
    <h2 id="t">Title</h2>
    <button type="button">Inside</button>
  </div>`,
})
class Host {
  closed = 0;
}

function setup() {
  TestBed.configureTestingModule({ imports: [Host] });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const button = (fixture.nativeElement as HTMLElement).querySelector(
    'button',
  ) as HTMLButtonElement;
  return { fixture, button };
}

const escape = () =>
  new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });

describe('AccessibleDialogDirective', () => {
  it('labels the dialog and closes it on Escape', () => {
    const { fixture, button } = setup();
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('t');
    button.dispatchEvent(escape());
    expect(fixture.componentInstance.closed).toBe(1);
  });

  it('ignores an Escape that an open dropdown already handled', () => {
    const { fixture, button } = setup();
    button.addEventListener('keydown', (e) => e.preventDefault());
    button.dispatchEvent(escape());
    expect(fixture.componentInstance.closed).toBe(0);
  });
});
