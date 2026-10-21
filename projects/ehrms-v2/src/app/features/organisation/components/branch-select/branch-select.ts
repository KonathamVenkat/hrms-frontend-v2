import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, distinctUntilChanged, map, of, startWith, switchMap, tap } from 'rxjs';
import { BranchLookup } from '../../models/organisation.model';
import { OrganisationService } from '../../services/organisation.service';

/**
 * Branch dropdown for a form that also has an office-location control. It offers only the branches of the chosen
 * location and clears a chosen branch that does not belong to a newly chosen location. The label lives in the
 * parent form, next to the other fields (point it at {@link inputId}).
 */
@Component({
  selector: 'app-branch-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe],
  template: `
    <!-- A fieldset disables the select without touching the parent form's control state. -->
    <fieldset class="branch-field" [disabled]="locked() || !hasLocation()">
      <select [id]="inputId()" [formControl]="control()">
        <option [ngValue]="null">{{ 'organisation.branchSelect.placeholder' | translate }}</option>
        @for (b of options(); track b.id) {
          <option [ngValue]="b.id">{{ b.nameEn }}</option>
        }
      </select>
    </fieldset>
    @if (failed()) {
      <span class="field-error" role="alert">{{
        'organisation.branchSelect.loadFailed' | translate
      }}</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .branch-field select {
      inline-size: 100%;
    }
    .branch-field {
      margin: 0;
      padding: 0;
      border: 0;
      min-inline-size: 0;
    }
  `,
})
export class BranchSelect {
  readonly locationControl = input.required<FormControl<number | null>>();
  readonly control = input.required<FormControl<number | null>>();
  readonly inputId = input('');
  /** True while an existing job record is edited: the branch only changes with a new assignment. */
  readonly locked = input(false);

  private svc = inject(OrganisationService);

  protected options = signal<BranchLookup[]>([]);
  protected failed = signal(false);
  protected hasLocation = signal(false);

  constructor() {
    toObservable(this.locationControl)
      .pipe(
        switchMap((c) => c.valueChanges.pipe(startWith(c.value))),
        distinctUntilChanged(),
        tap((locationId) => {
          this.hasLocation.set(locationId != null);
          this.failed.set(false);
        }),
        // switchMap: an older location's answer never overwrites a newer one.
        switchMap((locationId) =>
          locationId == null
            ? of({ list: [] as BranchLookup[], ok: true })
            : this.svc.lookupBranches(locationId).pipe(
                map((list) => ({ list, ok: true })),
                catchError(() => of({ list: [] as BranchLookup[], ok: false })),
              ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ list, ok }) => {
        this.options.set(list);
        this.failed.set(!ok);
        const chosen = this.control().value;
        // The value is kept on a failed lookup (the list just is not there) and while locked (the stored branch may be
        // inactive or moved, and the server compares it with what is stored when the current record is edited).
        if (ok && !this.locked() && chosen != null && !list.some((b) => b.id === chosen))
          this.control().setValue(null);
      });
  }
}
