/**
 * Mutable state shared across all e2e spec files (Jest --runInBand).
 *
 * Jest's node environment clears custom `process` keys between spec files, so values also persist in
 * `test/.e2e-run-state.json` (created/cleared by `jest-e2e-load-env.ts`).
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

export type E2EState = {
  adminToken: string;
  managerToken: string;
  userToken: string;
  adminId: string;
  managerId: string;
  userId: string;

  projectId: string;
  disposableProjectId: string;
  unitId: string;
  unit2Id: string;
  unit3Id: string;
  templateId: string;
  sectionId: string;
  disposableSectionId: string;
  fieldId: string;
  selectFieldId: string;
  agreementTemplateId: string;
  managerProjectId: string;

  bookingId: string;
  secondaryBookingId: string;
  applicationNo: string;
  approvedBookingId: string;
  rejectedBookingId: string;

  kycDocumentId: string;
  agreementDocumentId: string;
  paymentId: string;

  notificationId: string;
  throwawayUserId: string;
};

/** In-memory handle for the current process; Jest may drop this between spec files. */
const PROCESS_KEY = '__PB_CRM_E2E_STATE__' as const;

const STATE_FILE = resolve(__dirname, '.e2e-run-state.json');

function readDisk(): Partial<E2EState> | null {
  try {
    if (!existsSync(STATE_FILE)) {
      return null;
    }
    return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as Partial<E2EState>;
  } catch {
    return null;
  }
}

function flushDisk(next: E2EState): void {
  writeFileSync(STATE_FILE, JSON.stringify(next), 'utf8');
}

function emptyState(): E2EState {
  return {
    adminToken: '',
    managerToken: '',
    userToken: '',
    adminId: '',
    managerId: '',
    userId: '',

    projectId: '',
    disposableProjectId: '',
    unitId: '',
    unit2Id: '',
    unit3Id: '',
    templateId: '',
    sectionId: '',
    disposableSectionId: '',
    fieldId: '',
    selectFieldId: '',
    agreementTemplateId: '',
    managerProjectId: '',

    bookingId: '',
    secondaryBookingId: '',
    applicationNo: '',
    approvedBookingId: '',
    rejectedBookingId: '',

    kycDocumentId: '',
    agreementDocumentId: '',
    paymentId: '',

    notificationId: '',
    throwawayUserId: '',
  };
}

export function getSharedState(): E2EState {
  const p = process as NodeJS.Process & {
    [PROCESS_KEY]?: E2EState;
  };
  if (p[PROCESS_KEY] == null) {
    const disk = readDisk();
    p[PROCESS_KEY] = disk
      ? ({ ...emptyState(), ...disk } as E2EState)
      : emptyState();
  }
  return p[PROCESS_KEY]!;
}

/**
 * Always read/write through getSharedState(). A plain `export const state = getSharedState()`
 * can go stale when Jest/ts-jest loads multiple module instances across spec files.
 */
export const state: E2EState = new Proxy({} as E2EState, {
  get(_, key: string) {
    return (getSharedState() as unknown as Record<string, unknown>)[key];
  },
  set(_, key: string, value: unknown) {
    const bucket = getSharedState() as unknown as Record<string, unknown>;
    bucket[key] = value;
    flushDisk(bucket as E2EState);
    return true;
  },
}) as E2EState;
