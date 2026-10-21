import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { BranchSelect } from './branch-select';
import { OrganisationService } from '../../services/organisation.service';
import { BranchLookup } from '../../models/organisation.model';

const juba: BranchLookup = { id: 1, nameEn: 'Juba', nameAr: 'جوبا', locationId: 7 };
const wau: BranchLookup = { id: 2, nameEn: 'Wau', nameAr: 'واو', locationId: 8 };

@Component({
  imports: [BranchSelect],
  template: `<app-branch-select
    inputId="b"
    [locationControl]="location"
    [control]="branch"
    [locked]="locked()"
  />`,
})
class Host {
  location = new FormControl<number | null>(null);
  branch = new FormControl<number | null>(null);
  locked = signal(false);
}

function setup(lookup: ReturnType<typeof vi.fn>) {
  TestBed.configureTestingModule({
    imports: [Host],
    providers: [
      provideTranslateService(),
      { provide: OrganisationService, useValue: { lookupBranches: lookup } },
    ],
  });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return { fixture, host: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

const options = (el: HTMLElement) =>
  Array.from(el.querySelectorAll('option')).map((o) => o.textContent?.trim());

describe('BranchSelect', () => {
  it('offers only a placeholder and stays disabled until a location is chosen', () => {
    const lookup = vi.fn(() => of([juba]));
    const { el } = setup(lookup);

    expect(lookup).not.toHaveBeenCalled();
    expect(options(el).length).toBe(1);
    expect((el.querySelector('select') as HTMLSelectElement).matches(':disabled')).toBe(true);
  });

  it('loads the branches of the chosen location', () => {
    const lookup = vi.fn((loc: number) => of(loc === 7 ? [juba] : [wau]));
    const { fixture, host, el } = setup(lookup);

    host.location.setValue(7);
    fixture.detectChanges();

    expect(lookup).toHaveBeenCalledWith(7);
    expect(options(el).join('|')).toContain('Juba');
    expect((el.querySelector('select') as HTMLSelectElement).matches(':disabled')).toBe(false);
  });

  it('clears a branch that is not in the new location, and keeps one that is', () => {
    const lookup = vi.fn((loc: number) => of(loc === 7 ? [juba] : [wau]));
    const { fixture, host } = setup(lookup);
    host.location.setValue(7);
    host.branch.setValue(1);
    fixture.detectChanges();
    expect(host.branch.value).toBe(1);

    host.location.setValue(8);
    fixture.detectChanges();

    expect(host.branch.value).toBeNull();
  });

  it('keeps the chosen branch and shows an inline error when the lookup fails', () => {
    const lookup = vi.fn(() => throwError(() => new HttpErrorResponse({ status: 500 })));
    const { fixture, host, el } = setup(lookup);
    host.branch.setValue(1);

    host.location.setValue(7);
    fixture.detectChanges();

    expect(host.branch.value).toBe(1);
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('is locked while an existing assignment is edited', () => {
    const lookup = vi.fn(() => of([juba]));
    const { fixture, host, el } = setup(lookup);
    host.location.setValue(7);
    host.locked.set(true);
    fixture.detectChanges();

    expect((el.querySelector('select') as HTMLSelectElement).matches(':disabled')).toBe(true);
  });

  it('keeps the stored branch while locked, even when the lookup no longer lists it', () => {
    // The employee's branch was deactivated or moved: editing the shift must not wipe it (the server would refuse).
    const lookup = vi.fn(() => of([juba]));
    const { fixture, host } = setup(lookup);
    host.locked.set(true);
    fixture.detectChanges();

    host.branch.setValue(9);
    host.location.setValue(7);
    fixture.detectChanges();

    expect(host.branch.value).toBe(9);
  });
});
