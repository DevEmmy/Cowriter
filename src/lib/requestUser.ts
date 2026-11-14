import { AsyncLocalStorage } from "async_hooks";
/** Carries the signed-in user through one request so shared services (AI budget) can count per person. */
export const requestUser = new AsyncLocalStorage<{ userId: string }>();
