import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ApiResponse,
  EmployeeBankAccount,
  EmployeeBankAccountRequest,
  MasterLookup,
} from '../models/bank-account.model';

@Injectable({ providedIn: 'root' })
export class BankAccountService {
  private http = inject(HttpClient);

  private url(employeeId: number): string {
    return `${environment.serviceUrl}/api/v1/employees/${employeeId}/bank-accounts`;
  }

  getAll(employeeId: number): Observable<ApiResponse<EmployeeBankAccount[]>> {
    return this.http.get<ApiResponse<EmployeeBankAccount[]>>(this.url(employeeId));
  }

  add(
    employeeId: number,
    payload: EmployeeBankAccountRequest,
  ): Observable<ApiResponse<EmployeeBankAccount>> {
    return this.http.post<ApiResponse<EmployeeBankAccount>>(this.url(employeeId), payload);
  }

  update(
    employeeId: number,
    accountId: number,
    payload: EmployeeBankAccountRequest,
  ): Observable<ApiResponse<EmployeeBankAccount>> {
    return this.http.put<ApiResponse<EmployeeBankAccount>>(
      `${this.url(employeeId)}/${accountId}`,
      payload,
    );
  }

  setPrimary(employeeId: number, accountId: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(
      `${this.url(employeeId)}/${accountId}/set-primary`,
      {},
    );
  }

  /** Deactivates; an account is never deleted. */
  deactivate(employeeId: number, accountId: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.url(employeeId)}/${accountId}`);
  }

  /** Active banks for the form's dropdown (HR_ADMIN). */
  getBanks(): Observable<ApiResponse<MasterLookup[]>> {
    return this.http.get<ApiResponse<MasterLookup[]>>(
      `${environment.serviceUrl}/api/v1/banks/lookup`,
    );
  }

  /** Active branches of one bank. */
  getBranches(bankId: number): Observable<ApiResponse<MasterLookup[]>> {
    return this.http.get<ApiResponse<MasterLookup[]>>(
      `${environment.serviceUrl}/api/v1/banks/${bankId}/branches/lookup`,
    );
  }
}
