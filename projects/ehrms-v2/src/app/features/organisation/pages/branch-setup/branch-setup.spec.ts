import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';

import { BranchSetup } from './branch-setup';
import { OrganisationService } from '../../services/organisation.service';
import { OfficeLocationService } from '../../../admin/office-locations/services/office-location';
import { OfficeLocation } from '../../../admin/office-locations/models/office-location';
import { BranchPlacement } from '../../models/organisation.model';

const juba: BranchPlacement = {
  branchId: 1,
  code: 'JUBA',
  name: 'Juba',
  nameAr: 'جوبا',
  companyId: 1,
  locationId: 7,
  locationName: 'Juba HQ',
  managerEmployeeId: 5,
  managerName: 'Lual Deng',
  managerCode: 'EMP-2026-000005',
  isActive: true,
  version: 3,
};
const wau: BranchPlacement = {
  branchId: 2,
  code: 'WAU',
  name: 'Wau',
  nameAr: 'واو',
  companyId: 1,
  isActive: true,
  version: 0,
};
const jubaRetail: BranchPlacement = {
  ...juba,
  branchId: 3,
  code: 'JUBA_RETAIL',
  name: 'Juba Retail',
  managerEmployeeId: undefined,
  managerName: undefined,
  managerCode: undefined,
};
const locations = {
  success: true,
  message: '',
  statusCode: 200,
  data: [{ locationId: 7, locationName: 'Juba HQ', locationNameAr: 'جوبا' } as OfficeLocation],
};

function setup(listBranches: ReturnType<typeof vi.fn>, setPlacement = vi.fn()) {
  TestBed.configureTestingModule({
    imports: [BranchSetup],
    providers: [
      provideTranslateService(),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: OrganisationService,
        useValue: {
          listBranches,
          setPlacement,
          managerCandidates: vi.fn(() =>
            of({
              content: [],
              totalPages: 0,
              totalElements: 0,
              size: 50,
              number: 0,
              first: true,
              last: true,
            }),
          ),
        },
      },
      { provide: OfficeLocationService, useValue: { getActive: vi.fn(() => of(locations)) } },
    ],
  });
  const fixture = TestBed.createComponent(BranchSetup);
  fixture.detectChanges();
  return { fixture, setPlacement, el: fixture.nativeElement as HTMLElement };
}

async function settle(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }) {
  await fixture.whenStable();
  fixture.detectChanges();
}

const click = (el: Element | null) => (el as HTMLElement).click();

describe('BranchSetup', () => {
  it('shows a loading state, then one row per branch', async () => {
    const pending = new Subject<BranchPlacement[]>();
    const { fixture, el } = setup(vi.fn(() => pending));

    expect(el.querySelector('[role="status"]')).not.toBeNull();

    pending.next([juba, wau]);
    pending.complete();
    await settle(fixture);
    expect(el.querySelector('[role="status"]')).toBeNull();
    expect(el.querySelectorAll('li.branch-row').length).toBe(2);
  });

  it('groups branches by location, with branches that have no location first', async () => {
    const { fixture, el } = setup(vi.fn(() => of([juba, jubaRetail, wau])));
    await settle(fixture);

    const cards = el.querySelectorAll('section.loc-card');
    expect(cards.length).toBe(2);
    expect(cards[0].querySelectorAll('li.branch-row').length).toBe(1);
    expect(cards[0].querySelector('h2')?.textContent).toContain(
      'organisation.branchSetup.noLocationGroup',
    );
    expect(cards[1].querySelectorAll('li.branch-row').length).toBe(2);
    expect(cards[1].querySelector('h2')?.textContent).toContain('Juba HQ');
  });

  it('shows the empty state when there are no branches', async () => {
    const { fixture, el } = setup(vi.fn(() => of([])));
    await settle(fixture);

    expect(el.querySelector('.empty-card')).not.toBeNull();
    expect(el.querySelector('section.loc-card')).toBeNull();
  });

  it('shows an error with a retry button that loads again', async () => {
    const list = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })))
      .mockReturnValue(of([juba]));
    const { fixture, el } = setup(list);
    await settle(fixture);

    expect(el.querySelector('[role="alert"]')).not.toBeNull();
    click(el.querySelector('[data-testid="retry"]'));
    await settle(fixture);
    expect(list).toHaveBeenCalledTimes(2);
    expect(el.querySelectorAll('li.branch-row').length).toBe(1);
  });

  it('flags a branch with no manager in text, not colour alone', async () => {
    const { fixture, el } = setup(vi.fn(() => of([juba, wau])));
    await settle(fixture);

    const rows = el.querySelectorAll('li.branch-row');
    expect(rows[0].querySelectorAll('.flag-missing').length).toBe(1);
    expect(rows[0].querySelector('.flag-missing')?.textContent?.trim()).not.toBe('');
    expect(rows[1].querySelectorAll('.flag-missing').length).toBe(0);
  });

  it('opens the manager list without asking for a location when the branch already has one', async () => {
    const { fixture, el } = setup(vi.fn(() => of([juba, wau])));
    await settle(fixture);

    click(el.querySelectorAll('li.branch-row')[1].querySelector('[data-testid="edit"]'));
    fixture.detectChanges();

    expect(el.querySelector('app-manager-picker')).not.toBeNull();
    expect(el.querySelector('#bs-location')).toBeNull();
  });

  it('asks for a location only when the branch has none', async () => {
    const { fixture, el } = setup(vi.fn(() => of([juba, wau])));
    await settle(fixture);

    click(el.querySelectorAll('li.branch-row')[0].querySelector('[data-testid="edit"]'));
    fixture.detectChanges();

    expect(el.querySelector('#bs-location')).not.toBeNull();
  });

  it('opens the editor with the current location and manager filled in', async () => {
    const { fixture, el } = setup(vi.fn(() => of([juba, wau])));
    await settle(fixture);

    click(el.querySelectorAll('li.branch-row')[1].querySelector('[data-testid="edit"]'));
    fixture.detectChanges();

    expect(el.querySelector('.modal')).not.toBeNull();
    expect(fixture.componentInstance.form.controls.locationId.value).toBe(7);
    expect(fixture.componentInstance.form.controls.managerEmployeeId.value).toBe(5);
  });

  it('does not save without a location', async () => {
    const { fixture, setPlacement, el } = setup(vi.fn(() => of([juba, wau])));
    await settle(fixture);
    click(el.querySelectorAll('li.branch-row')[0].querySelector('[data-testid="edit"]'));
    fixture.detectChanges();

    fixture.componentInstance.onSubmit();

    expect(setPlacement).not.toHaveBeenCalled();
    expect(fixture.componentInstance.form.controls.locationId.touched).toBe(true);
  });

  it('saves once with the version and a null manager, even if submitted twice', async () => {
    const pending = new Subject<BranchPlacement>();
    const { fixture, setPlacement, el } = setup(
      vi.fn(() => of([juba, wau])),
      vi.fn(() => pending),
    );
    await settle(fixture);
    click(el.querySelectorAll('li.branch-row')[1].querySelector('[data-testid="edit"]'));
    fixture.detectChanges();
    fixture.componentInstance.onManagerPicked(null);

    fixture.componentInstance.onSubmit();
    fixture.componentInstance.onSubmit();
    fixture.detectChanges();

    expect(setPlacement).toHaveBeenCalledTimes(1);
    expect(setPlacement).toHaveBeenCalledWith(1, {
      locationId: 7,
      managerEmployeeId: null,
      version: 3,
    });
    expect((el.querySelector('.btn-save') as HTMLButtonElement).disabled).toBe(true);
  });

  it('on a stale edit (409) keeps the dialog and the input and says to reload', async () => {
    const { fixture, el } = setup(
      vi.fn(() => of([juba, wau])),
      vi.fn(() => throwError(() => new HttpErrorResponse({ status: 409 }))),
    );
    await settle(fixture);
    click(el.querySelectorAll('li.branch-row')[1].querySelector('[data-testid="edit"]'));
    fixture.detectChanges();
    fixture.componentInstance.onManagerPicked({ id: 9, label: 'Nyandeng Ajak' });

    fixture.componentInstance.onSubmit();
    fixture.detectChanges();

    expect(el.querySelector('.modal-alert[role="alert"]')).not.toBeNull();
    expect(el.querySelector('.modal')).not.toBeNull();
    expect(fixture.componentInstance.form.controls.managerEmployeeId.value).toBe(9);
    expect((el.querySelector('.btn-save') as HTMLButtonElement).disabled).toBe(false);
  });

  it('closes, reloads and confirms after a successful save', async () => {
    const list = vi.fn(() => of([juba, wau]));
    const { fixture, el } = setup(
      list,
      vi.fn(() => of({ ...juba, version: 4 })),
    );
    await settle(fixture);
    click(el.querySelectorAll('li.branch-row')[1].querySelector('[data-testid="edit"]'));
    fixture.detectChanges();

    fixture.componentInstance.onSubmit();
    await settle(fixture);

    expect(el.querySelector('.modal')).toBeNull();
    expect(el.querySelector('.alert-success[role="status"]')).not.toBeNull();
    expect(list).toHaveBeenCalledTimes(2);
  });
});
