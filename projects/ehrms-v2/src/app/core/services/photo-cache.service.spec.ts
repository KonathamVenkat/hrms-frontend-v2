import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Auth } from '../auth/auth';
import { PhotoCache } from './photo-cache.service';

const PATH = '/api/v1/employees/5/photo?v=1';

describe('PhotoCache', () => {
  let cache: PhotoCache;
  let http: HttpTestingController;
  let viewer: { id: number } | null = { id: 1 };
  let sessionCleared: Subject<void>;
  let created = 0;
  let revoke = vi.fn<(url: string) => void>();

  beforeEach(() => {
    viewer = { id: 1 };
    sessionCleared = new Subject<void>();
    created = 0;
    URL.createObjectURL = vi.fn(() => `blob:photo-${++created}`);
    revoke = vi.fn<(url: string) => void>();
    URL.revokeObjectURL = revoke;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: Auth,
          useValue: { getStoredUser: () => viewer, sessionCleared$: sessionCleared.asObservable() },
        },
      ],
    });
    cache = TestBed.inject(PhotoCache);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const url = `${environment.serviceUrl}${PATH}`;

  it('never fetches or shows an address that is not the own photo path', () => {
    const bad = [
      'https://cdn.example.com/a.png',
      '//attacker.example/p.png',
      '/\\attacker.example/p.png',
      '/\t/attacker.example/p.png',
      'javascript:alert(1)',
      'p.png',
      '/api/v1/employees/x/photo?v=1',
      '/api/v1/employees/5/photo?v=1&x=2',
      '/api/v1/employees/5/photo/../../admin',
      '/api/v1/employees/5/documents',
    ];
    for (const address of bad) {
      let shown: string | null = 'unset';
      cache.load(address).subscribe((u) => (shown = u));
      expect(shown, address).toBeNull();
    }
  });

  it('loads the own photo path with and without a version', () => {
    cache.load('/api/v1/employees/5/photo').subscribe();
    http.expectOne(`${environment.serviceUrl}/api/v1/employees/5/photo`).flush(new Blob(['img']));
  });

  it('does not load anything when nobody is signed in', () => {
    viewer = null;
    let shown: string | null = 'unset';
    cache.load(PATH).subscribe((u) => (shown = u));
    expect(shown).toBeNull();
  });

  it('fetches an uploaded photo once and shares it between callers', () => {
    const shown: (string | null)[] = [];
    cache.load(PATH).subscribe((u) => shown.push(u));
    cache.load(PATH).subscribe((u) => shown.push(u));

    http.expectOne(url).flush(new Blob(['img']));

    expect(shown).toEqual(['blob:photo-1', 'blob:photo-1']);
    cache.load(PATH).subscribe((u) => shown.push(u)); // still cached: no new request
    expect(shown).toHaveLength(3);
  });

  it('does not share a photo between two signed-in users of the same tab', () => {
    cache.load(PATH).subscribe();
    http.expectOne(url).flush(new Blob(['img']));

    viewer = { id: 2 };
    cache.load(PATH).subscribe();

    http.expectOne(url).flush(new Blob(['img']));
  });

  it('treats a new version of the photo as a different photo', () => {
    cache.load(PATH).subscribe();
    cache.load('/api/v1/employees/5/photo?v=2').subscribe();

    http.expectOne(url).flush(new Blob(['a']));
    http.expectOne(`${environment.serviceUrl}/api/v1/employees/5/photo?v=2`).flush(new Blob(['b']));
  });

  it('reports a failed load as null and tries again next time', () => {
    let shown: string | null = 'unset';
    cache.load(PATH).subscribe((u) => (shown = u));
    http.expectOne(url).flush(new Blob(['gone']), { status: 404, statusText: 'Not Found' });
    expect(shown).toBeNull();

    cache.load(PATH).subscribe();
    http.expectOne(url).flush(new Blob(['img']));
  });

  it('drops every cached photo and revokes its object URL when the session is cleared', () => {
    cache.load(PATH).subscribe();
    cache.load('/api/v1/employees/6/photo?v=1').subscribe();
    http.expectOne(url).flush(new Blob(['a']));
    http.expectOne(`${environment.serviceUrl}/api/v1/employees/6/photo?v=1`).flush(new Blob(['b']));

    sessionCleared.next();

    expect(revoke).toHaveBeenCalledTimes(2);
    expect(revoke).toHaveBeenCalledWith('blob:photo-1');
    expect(revoke).toHaveBeenCalledWith('blob:photo-2');
    cache.load(PATH).subscribe(); // nothing is remembered: it is fetched again
    http.expectOne(url).flush(new Blob(['a']));
  });

  it('discards a photo that arrives after the session was cleared', () => {
    let shown: string | null = 'unset';
    cache.load(PATH).subscribe((u) => (shown = u));

    sessionCleared.next();
    http.expectOne(url).flush(new Blob(['late']));

    expect(shown).toBeNull();
    expect(created).toBe(0);
  });
});
