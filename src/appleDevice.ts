/** iPhone・iPadか。iPadOSのSafariはMacの名乗りをするため、タッチ点の数で見分ける。 */
export function isIPhoneOrIPad(nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints'>): boolean {
  return /iPhone|iPad|iPod/.test(nav.userAgent) || (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1);
}
