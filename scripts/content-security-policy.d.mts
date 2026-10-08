import type { Plugin } from 'vite';

export const CONTENT_SECURITY_POLICY_DIRECTIVES: Readonly<Record<string, readonly string[]>>;
export const CONTENT_SECURITY_POLICY: string;

export function findInlineScripts(html: string): string[];
export function contentSecurityPolicyMetas(html: string): string[];
export function applyContentSecurityPolicy(html: string): string;
export function verifyContentSecurityPolicy(html: string): string | undefined;
export function htmlFiles(directory: string): Promise<string[]>;
export function contentSecurityPolicy(): Plugin;
