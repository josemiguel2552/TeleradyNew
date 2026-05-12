import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'telerady:public';

/**
 * Marks a route as unauthenticated. The global JWT guard will skip it.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
