import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DateInput } from './date-input';

@Component({
  imports: [DateInput, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-date-input inputId="d" [formControl]="control" [min]="min()" />`,
})
class Host {
  readonly control = new FormControl<string>('', { nonNullable: true });
  readonly min = signal('');
}

describe('DateInput', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  /** What a user does: type text and leave the box. */
  function type(text: string): void {
    const box = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    box.value = text;
    box.dispatchEvent(new Event('input'));
    box.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Host] });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('publishes a typed date as yyyy-MM-dd with no error', () => {
    type('3/4/2026');
    expect(host.control.value).toBe('2026-03-04');
    expect(host.control.errors).toBeNull();
  });

  it('marks typed text that is not a date as a parse error instead of silently emptying the value', () => {
    type('garbage');
    expect(host.control.hasError('matDatepickerParse')).toBe(true);
    expect(host.control.invalid).toBe(true);
  });

  it('accepts a cleared box as an empty, valid value', () => {
    type('3/4/2026');
    type('');
    expect(host.control.value).toBe('');
    expect(host.control.errors).toBeNull();
  });

  it('refuses a year below 1000 (a typing slip) instead of storing a malformed date', () => {
    type('1/1/999');
    expect(host.control.hasError('matDatepickerParse')).toBe(true);
    expect(host.control.value).toBe('');
  });

  it('clears the parse error when the form sets a new value', () => {
    type('garbage');
    host.control.setValue('2026-01-02');
    expect(host.control.errors).toBeNull();
  });

  it('refuses a date earlier than the minimum, typed or set, and accepts it once the minimum moves', () => {
    host.min.set('2026-06-01');
    fixture.detectChanges();
    type('3/4/2026');
    expect(host.control.hasError('matDatepickerMin')).toBe(true);

    host.min.set('2026-01-01');
    fixture.detectChanges();
    host.control.updateValueAndValidity();
    expect(host.control.errors).toBeNull();
  });
});
