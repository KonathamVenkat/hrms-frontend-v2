import { Directive, input } from '@angular/core';

/**
 * Gives a mat-table cell's row variable the row type instead of `any`:
 * `*matCellDef="let r; dataSource: rows()"`. Type checking only; it changes nothing at runtime.
 */
@Directive({ selector: '[matCellDef][matCellDefDataSource]' })
export class TypedCellDefDirective<T> {
  readonly matCellDefDataSource = input.required<readonly T[]>();

  static ngTemplateContextGuard<T>(
    _dir: TypedCellDefDirective<T>,
    ctx: unknown,
  ): ctx is { $implicit: T; index: number } {
    return true;
  }
}
