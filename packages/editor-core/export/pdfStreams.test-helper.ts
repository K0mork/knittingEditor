import { unzlibSync } from 'fflate';

/**
 * PDFテスト用のヘルパー。生成したPDFの圧縮ストリームを展開し、描画命令を文字列で返す。
 *
 * 一部のストリームが壊れていると、残りのストリームだけを検査して見逃すおそれがある。
 * そのため、展開できないストリーム、`/Length`と実際の長さが合わないストリーム、
 * 圧縮されていないストリーム、チェックサムの合わないストリームがあれば、テストを失敗させる。
 */

const FLATE_STREAM = /\/Length (\d+) \/Filter \/FlateDecode >>\nstream\n/g;
const ENDSTREAM = '\nendstream';

/** zlibの末尾に入るAdler-32。fflateの`unzlibSync`は照合しないので、ここで確かめる。 */
function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  // 途中の和が大きくなりすぎないよう、zlibと同じく5552バイトごとに剰余を取る。
  for (let start = 0; start < data.length; start += 5552) {
    const end = Math.min(start + 5552, data.length);
    for (let index = start; index < end; index++) {
      a += data[index];
      b += a;
    }
    a %= 65521;
    b %= 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/** PDFのすべての圧縮ストリームを、出現順に展開して返す。1つでも読めなければ例外を投げる。 */
export function pdfStreams(pdf: Uint8Array): string[] {
  // latin1は1バイトを1文字にするので、文字列の位置がそのままバイトの位置になる。
  const binary = new TextDecoder('latin1').decode(pdf);
  const matches = [...binary.matchAll(FLATE_STREAM)];
  const streamCount = binary.split('\nstream\n').length - 1;
  if (streamCount !== matches.length) throw new Error(`PDFに圧縮されていないストリームがあります（${streamCount - matches.length}件）`);
  return matches.map((match, index) => {
    const label = `PDFの${index + 1}番目のストリーム`;
    const start = match.index + match[0].length;
    const end = start + Number(match[1]);
    if (binary.slice(end, end + ENDSTREAM.length) !== ENDSTREAM) throw new Error(`${label}の長さが/Lengthと合いません`);
    const compressed = pdf.subarray(start, end);
    let data: Uint8Array;
    try {
      data = unzlibSync(compressed);
    } catch (error) {
      throw new Error(`${label}を展開できません: ${error instanceof Error ? error.message : String(error)}`);
    }
    const checksum = new DataView(compressed.buffer, compressed.byteOffset + compressed.byteLength - 4, 4).getUint32(0);
    if (adler32(data) !== checksum) throw new Error(`${label}のチェックサムが合いません`);
    return new TextDecoder().decode(data);
  });
}
