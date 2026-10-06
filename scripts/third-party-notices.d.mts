import type { Plugin } from 'vite';

export const THIRD_PARTY_NOTICES_PATH: string;

export interface PackageNotice {
  name: string;
  version: string;
  license: string;
  text: string;
}

export function packageRootOf(moduleId: string): string | undefined;
export function readPackageNotice(root: string): PackageNotice;
export function renderNoticesHtml(notices: readonly PackageNotice[]): string;
export function thirdPartyNotices(): { plugin: Plugin; workerPlugin: () => Plugin };
