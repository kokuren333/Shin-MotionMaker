export function selectLicense(name: string, expression: unknown): string;
export function supportsPlatform(entry: { os?: string[]; cpu?: string[]; libc?: string[] }, platform: string, arch: string, libc?: string): boolean;
export function checkLicenses(root: string): Promise<{
  scope: string;
  allowed: string[];
  packages: {
    path: string; name: string; version: string; license: string; selected: string;
    development: boolean; optional: boolean; installed: boolean; evidence: string;
    files: { path: string; sha256: string }[];
  }[];
}>;
