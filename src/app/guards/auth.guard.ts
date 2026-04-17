import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthenticationService } from 'src/app/firebase/authentication';
import { map } from 'rxjs/operators';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthenticationService);
  const router = inject(Router);

  return auth.authState$.pipe(
    map(user => {
      if (user) return true;
      router.navigate(['/login'], { replaceUrl: true });
      return false;
    })
  );
};
