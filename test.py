#!/usr/bin/env python3
import os
import subprocess

def convert_pdf_to_svg():
    # materialフォルダとsvgフォルダのパスを定義
    material_dir = "material"
    svg_dir = "svg"
    
    # svgフォルダが存在しなければ作成する
    if not os.path.exists(svg_dir):
        os.makedirs(svg_dir)
    
    # materialフォルダ内のすべての*.pdfファイルを対象に変換を実施する
    for filename in os.listdir(material_dir):
        if filename.lower().endswith(".pdf"):
            # 拡張子を除いたファイル名を取得
            basename = os.path.splitext(filename)[0]
            input_path = os.path.join(material_dir, filename)
            output_filename = basename + ".svg"
            output_path = os.path.join(svg_dir, output_filename)
            
            print(f"{input_path} を {output_path} に変換中...")
            # pdf2svg コマンドを実行（PDF が単一ページの場合、ページ番号1を指定）
            subprocess.run(["pdf2svg", input_path, output_path, "1"], check=True)
            print("変換完了\n")
            
if __name__ == "__main__":
    convert_pdf_to_svg()