import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private apiUrl = 'http://localhost:8080/api/auth';
    private tokenKey = 'authToken';
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
                }
            })
        );
    }

    logout(): void {
        localStorage.removeItem(this.tokenKey);
        this.currentUserSubject.next(null);
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