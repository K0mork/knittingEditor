#!/usr/bin/env python3
import os
import sys
import subprocess
import re

def make_svg_white_transparent(svg_path):
    """SVGファイル内の白い塗りつぶし（#fff, #ffffff）を透過に変換する関数"""
    with open(svg_path, 'r', encoding='utf-8') as f:
        svg_content = f.read()

    # 属性値として指定されているfill="#fff"やfill="#ffffff"を透過に変更する
    new_content = re.sub(r'(fill\s*=\s*")#(?:fff|ffffff)(")', r'\1none\2', svg_content, flags=re.IGNORECASE)
    # style属性内の指定も置換する（例: fill:#fff; や fill:#ffffff;）
    new_content = re.sub(r'(fill\s*:\s*)#(?:fff|ffffff)(\b)', r'\1none', new_content, flags=re.IGNORECASE)

    with open(svg_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

def convert_pdf_to_svg(target_files=None):
    """
    materialフォルダ内のPDFファイルをSVGに変換する関数
    target_filesが指定されている場合、そのリストに含まれるファイルのみ変換します。
    
    利用例:
      全てのPDFファイルを変換:
            python3 test.py
      特定のファイルだけを変換（例: sample.pdf, example.pdf）:
            python3 test.py sample.pdf example.pdf
    """
    # materialフォルダとsvgフォルダのパスを定義
    material_dir = "material"
    svg_dir = "svg"
    
    # svgフォルダが存在しなければ作成する
    if not os.path.exists(svg_dir):
        os.makedirs(svg_dir)
    
    # materialフォルダ内のすべての*.pdfファイルに対して変換を実施する
    for filename in os.listdir(material_dir):
        if not filename.lower().endswith(".pdf"):
            continue
        # target_filesが指定されている場合、対象外のファイルはスキップする
        if target_files and filename not in target_files:
            continue
        
        # 拡張子を除いたファイル名を取得する
        basename = os.path.splitext(filename)[0]
        input_path = os.path.join(material_dir, filename)
        output_filename = basename + ".svg"
        output_path = os.path.join(svg_dir, output_filename)
        
        print(f"{input_path} を {output_path} に変換中...")
        # pdf2svg コマンドを実行（PDFが単一ページの場合、ページ番号 1 を指定）
        subprocess.run(["pdf2svg", input_path, output_path, "1"], check=True)
        # 変換後、SVG内の白い部分を透過に変換
        make_svg_white_transparent(output_path)
        
        print("変換完了\n")
            
if __name__ == "__main__":
    # コマンドライン引数が指定されていた場合、そのリストに含まれるファイルのみ変換します
    target_files = sys.argv[1:] if len(sys.argv) > 1 else None
    convert_pdf_to_svg(target_files)