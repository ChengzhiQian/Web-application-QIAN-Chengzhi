import { Routes } from '@angular/router';
import { SearchComponent } from './pages/search/search.component';
import { DetailComponent } from './pages/detail/detail.component';
import { StatsComponent } from './pages/stats/stats.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'search' },

  { path: 'search', component: SearchComponent },
  { path: 'detail/:appid', component: DetailComponent },
  { path: 'stats', component: StatsComponent },

  { path: '**', redirectTo: 'search' }
];
