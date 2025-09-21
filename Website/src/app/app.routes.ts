import { Routes } from '@angular/router';
import { ImageUpload } from './image-upload/image-upload';
import { PricesManager } from './prices-manager/prices-manager';
import { Industries } from './industries/industries';

export const routes: Routes = [
  { path: '', redirectTo: '/upload', pathMatch: 'full' },
  { path: 'upload', component: ImageUpload },
  { path: 'prices', component: PricesManager },
  { path: 'industries', component: Industries }
];
