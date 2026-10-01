import { CreateUsers1790812800000 } from './1790812800000-CreateUsers.js';
import { CreateCategories1790812800100 } from './1790812800100-CreateCategories.js';
import { CreateWorks1790812800200 } from './1790812800200-CreateWorks.js';

/** Lista explícita (sem glob) para funcionar igual em ESM, Vitest e build. */
export const migrations = [
  CreateUsers1790812800000,
  CreateCategories1790812800100,
  CreateWorks1790812800200,
];
