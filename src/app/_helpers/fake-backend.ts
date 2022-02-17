import { Injectable } from '@angular/core';
import { HttpRequest, HttpResponse, HttpHandler, HttpEvent, HttpInterceptor, HTTP_INTERCEPTORS } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay, materialize, dematerialize } from 'rxjs/operators';

import { Role } from '../_models/role';

const users = [
    { id: 1, username: 'admin', password: 'admin', firstName: 'Admin', lastName: 'User', role: Role.Admin, token:'123456.1' },
    { id: 2, username: 'user', password: 'user', firstName: 'Normal', lastName: 'User', role: Role.User, token:'123456.2' }
];

@Injectable()
export class FakeBackendInterceptor implements HttpInterceptor {
    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        const { url, method, headers, body } = request;

        return handleRoute();        

        function handleRoute() {
            switch (true) {
                case url.endsWith('/users/authenticate') && method === 'POST':
                    return authenticate();
                case url.endsWith('/users') && method === 'GET':
                    return getUsers();
                case url.match(/\/users\/\d+$/) && method === 'GET':
                    return getUserById();
                default:
                    // pass through any requests not handled above
                    return next.handle(request);
            }

        }

        // route functions

        function authenticate() {
            const { username, password } = body;
            const user = users.find(x => x.username === username && x.password === password);
            if (!user) return error('Username or password is incorrect');
            return ok(user);
        }

        function getUsers() {
            if (!isAdmin()) return unauthorized();
            return ok(users);
        }

        function getUserById() {
            if (!isLoggedIn()) return unauthorized();

            // only admins can access other user records
            const userC = currentUser();
            if(userC!=null){
                console.log(userC.id);
                if (!isAdmin() && userC.id !== idFromUrl()) return unauthorized();
            }
           
            const user = users.find(x => x.id === idFromUrl());
            return ok(user);
        }

        // helper functions

        function ok(body?: { id: number; username: string; password: string; firstName: string; lastName: string; role: Role; token: string; } | { id: number; username: string; password: string; firstName: string; lastName: string; role: Role; token: string; }[] | undefined) {
            return of(new HttpResponse({ status: 200, body }))
                .pipe(delay(500)); // delay observable to simulate server api call
        }

        function unauthorized() {
            return throwError({ status: 401, error: { message: 'unauthorized' } })
                .pipe(materialize(), delay(500), dematerialize()); // call materialize and dematerialize to ensure delay even if an error is thrown (https://github.com/Reactive-Extensions/RxJS/issues/648);
        }

        function error(message: string) {
            return throwError({ status: 400, error: { message } })
                .pipe(materialize(), delay(500), dematerialize());
        }

        function isLoggedIn() {
            const authHeader = headers.get('Authorization') || '';
            return authHeader.startsWith('123456');
        }

        function isAdmin() {
            if(currentUser()!=null){
                const user = currentUser();
                if(user?.role === Role.Admin){
                    return isLoggedIn()
                }else{
                    return false;
                }
            }else{
                return false;
            }
           
        }

        function currentUser() {
            if (!isLoggedIn()) return;
            const h =headers.get('Authorization')||'';
            const id = parseInt(h.split('.')[1]);
            return users.find(x => x.id === id);
        }

        function idFromUrl() {
            const urlParts = url.split('/');
            return parseInt(urlParts[urlParts.length - 1]);
        }
    }
}

export const fakeBackendProvider = {
    // use fake backend in place of Http service for backend-less development
    provide: HTTP_INTERCEPTORS,
    useClass: FakeBackendInterceptor,
    multi: true
};