import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';

import { DiscardChanges } from './discard-changes';

function setup() {
  TestBed.configureTestingModule({ imports: [DiscardChanges], providers: [provideTranslateService()] });
  const fixture = TestBed.createComponent(DiscardChanges);
  const keep = vi.fn();
  const discard = vi.fn();
  fixture.componentInstance.keep.subscribe(keep);
  fixture.componentInstance.discard.subscribe(discard);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { el, keep, discard, buttons: [...el.querySelectorAll('button')] };
}

describe('DiscardChanges', () => {
  it('is an alert dialog with a title and a message tied to it for screen readers', () => {
    const { el } = setup();
    const dialog = el.querySelector('[role=alertdialog]');

    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(el.querySelector('#' + dialog?.getAttribute('aria-labelledby'))).not.toBeNull();
    expect(el.querySelector('#' + dialog?.getAttribute('aria-describedby'))).not.toBeNull();
  });

  it('offers "keep editing" first, so it takes the focus, and "discard" second', () => {
    const { buttons } = setup();

    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent).toContain('common.discard.keep');
    expect(buttons[1].textContent).toContain('common.discard.discard');
    expect(buttons.every((b) => b.getAttribute('type') === 'button')).toBe(true);
  });

  it('emits keep for the first button and discard for the second, never both', () => {
    const { buttons, keep, discard } = setup();

    buttons[0].click();
    expect(keep).toHaveBeenCalledTimes(1);
    expect(discard).not.toHaveBeenCalled();

    buttons[1].click();
    expect(discard).toHaveBeenCalledTimes(1);
    expect(keep).toHaveBeenCalledTimes(1);
  });
});

describe('DiscardChanges for a new form with nothing entered', () => {
  it('is a notice with a single "enter details" button: there is no "close anyway"', () => {
    TestBed.configureTestingModule({ imports: [DiscardChanges], providers: [provideTranslateService()] });
    const fixture = TestBed.createComponent(DiscardChanges);
    fixture.componentRef.setInput('kind', 'empty');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = [...el.querySelectorAll('button')];

    expect(el.querySelector('#discard-title')?.textContent).toContain('common.discard.empty.title');
    expect(el.querySelector('#discard-message')?.textContent).toContain('common.discard.empty.message');
    expect(buttons[0].textContent).toContain('common.discard.empty.keep');
    expect(buttons).toHaveLength(1);
    expect(el.textContent).not.toContain('common.discard.empty.discard');
  });

  it('still offers keep and discard when something was typed', () => {
    TestBed.configureTestingModule({ imports: [DiscardChanges], providers: [provideTranslateService()] });
    const fixture = TestBed.createComponent(DiscardChanges);
    fixture.componentRef.setInput('kind', 'unsaved');
    fixture.detectChanges();

    expect([...(fixture.nativeElement as HTMLElement).querySelectorAll('button')]).toHaveLength(2);
  });
});
