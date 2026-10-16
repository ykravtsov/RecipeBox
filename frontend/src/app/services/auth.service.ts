import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private apiUrl = '/api/auth';
    private tokenKey = 'authToken';
    private emailKey = 'userEmail';
    private currentUserSubject = new BehaviorSubject<string | null>(this.getToken());

    constructor(private http: HttpClient) { }

    register(email: string, password: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/register`, { email, password });
    }

    login(email: string, password: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/login`, { email, password }).pipe(
            tap((response: any) => {
                if (response.token) {
                    this.setToken(response.token);
                    localStorage.setItem(this.emailKey, email);
                }
            })
        );
    }

    logout(): void {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.emailKey);
        this.currentUserSubject.next(null);
    }

    getEmail(): string | null {
        return localStorage.getItem(this.emailKey);
    }

    private setToken(token: string): void {
        localStorage.setItem(this.tokenKey, token);
        this.currentUserSubject.next(token);
    }

    getToken(): string | null {
        return localStorage.getItem(this.tokenKey);
    }

    isAuthenticated(): boolean {
        return !!this.getToken();
    }

    get currentUserValue(): string | null {
        return this.currentUserSubject.value;
    }

    get currentUser(): Observable<string | null> {
        return this.currentUserSubject.asObservable();
    }
}