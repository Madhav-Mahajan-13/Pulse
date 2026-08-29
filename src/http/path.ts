export function canonicalPath(path: string): string {
  const absolutePath = path.startsWith("/") ? path : `/${path}`;
  return absolutePath.length > 1
    ? absolutePath.replace(/\/+$/, "")
    : absolutePath;
}
