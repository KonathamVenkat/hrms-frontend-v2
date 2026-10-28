import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { RequestHistory } from '../../models/workflow.model';
import { HistoryTimeline } from './history-timeline';

function render(items: RequestHistory[]) {
  TestBed.configureTestingModule({
    imports: [HistoryTimeline],
    providers: [provideTranslateService()],
  });
  const fixture = TestBed.createComponent(HistoryTimeline);
  fixture.componentRef.setInput('items', items);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const row = (over: Partial<RequestHistory>): RequestHistory => ({
  stepKey: 'HEAD',
  action: 'APPROVED',
  actedAt: '2026-10-25T09:30:00',
  ...over,
});

describe('HistoryTimeline', () => {
  it('shows a message when there is no history', () => {
    const el = render([]);
    expect(el.querySelector('ol')).toBeNull();
    expect(el.textContent).toContain('workflow.history.empty');
  });

  it('names each action in text, so colour is never the only signal', () => {
    const el = render([
      row({ action: 'AUTO_ROUTED', stepKey: 'SECRETARY' }),
      row({
        action: 'OVERRIDDEN',
        actorName: 'Hana Said',
        actorRole: 'HR_ADMIN',
        comment: 'Head left',
      }),
    ]);
    const text = el.textContent ?? '';
    expect(text).toContain('workflow.history.actions.AUTO_ROUTED');
    expect(text).toContain('workflow.history.actions.OVERRIDDEN');
    expect(text).toContain('Hana Said');
    expect(text).toContain('Head left');
    expect(el.querySelectorAll('li').length).toBe(2);
  });

  it('names the step of each row, and shows nothing for the submit row or a custom step', () => {
    const el = render([
      row({ action: 'SUBMITTED', stepKey: undefined }),
      row({ action: 'APPROVED', stepKey: 'GM' }),
      row({ action: 'APPROVED', stepKey: 'CUSTOM_STEP' }),
    ]);
    const text = el.textContent ?? '';
    expect(text).toContain('workflow.history.steps.GM');
    expect(text).not.toContain('workflow.history.steps.undefined');
    expect(text).not.toContain('workflow.history.steps.CUSTOM_STEP');
  });

  it('translates a known actor role and shows an unknown one as sent', () => {
    const el = render([
      row({ actorName: 'Hana Said', actorRole: 'GENERAL_MANAGER' }),
      row({ action: 'FORWARDED', actorName: 'Ali', actorRole: 'AUDITOR' }),
    ]);
    const roles = Array.from(el.querySelectorAll('.role')).map((r) => r.textContent?.trim());
    expect(roles).toEqual(['(common.enums.role.GENERAL_MANAGER)', '(AUDITOR)']);
  });

  it('falls back to the employee id when the actor name is missing', () => {
    const el = render([row({ actorEmployeeId: 12 })]);
    expect(el.textContent).toContain('workflow.history.employee');
  });

  it('labels a system row (no actor) as the system', () => {
    const el = render([row({ action: 'AUTO_ROUTED' })]);
    expect(el.textContent).toContain('workflow.history.system');
  });

  it('renders identical rows without a duplicate-key warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const el = render([row({}), row({})]);
    const logged = [...warn.mock.calls, ...err.mock.calls].flat().join(' ');
    warn.mockRestore();
    err.mockRestore();
    expect(el.querySelectorAll('li').length).toBe(2);
    expect(logged).not.toContain('NG0955');
  });
});
