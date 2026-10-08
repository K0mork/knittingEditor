import type { Plugin } from 'vite';

export const CONTENT_SECURITY_POLICY_DIRECTIVES: Readonly<Record<string, readonly string[]>>;

export function styleHash(css: string): string;
export function contentSecurityPolicyFor(html: string): string;
export function findInlineCode(html: string): string[];
export function applyContentSecurityPolicy(html: string): string;
export function contentSecurityPolicyMetas(html: string): string[];
export function verifyContentSecurityPolicy(html: string): string | undefined;
export function htmlFiles(directory: string): Promise<string[]>;
export function contentSecurityPolicy(): Plugin;
