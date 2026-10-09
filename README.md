# Web Metronome

🔗 https://m-masaki72.github.io/web-metronome/

インストール不要・スマホ対応のシンプルなWebメトロノーム。ビルド不要（素のHTML/CSS/JS）。

## 機能
- BPM指定（30〜300、±ボタン/スライダー/直接入力/振り子の重りドラッグ）
- タップテンポ
- 設定バンク（1〜5ボタンでBPM・拍子・音色等の設定一式を切替。選択中バンクは変更のたびに自動保存）
- 拍子・アクセント設定（2/4, 3/4, 4/4, 5/4, 6/8, 7/8 + 1拍目強調）
- 拍子音の複数音色（Click / Wood / Beep / Block、実サンプル音源）
- 小節頭ベル（1/2/4小節ごとに「チーン」を重ねて鳴らす、練習の区切りの目安）
- ハプティクス（対応端末のみ）
- 画面スリープ防止（Wake Lock API）
- 視覚メトロノーム（実物の脱進機構に忠実な振り子アニメーション + 画面フラッシュ + 拍数表示、サイレントモード対応。画面フラッシュはライトモードで光過敏性に配慮した低め不透明度に調整済み）
- スピードトレーナー（自動テンポアップ）
- カウントイン（1〜2小節の予備拍）
- シャッフル（スウィング）モード
- ダークモード
- PWA対応（オフライン起動、ホーム画面追加）

## 音源クレジット
`sounds/`配下の音声は [BigSoundBank.com](https://bigsoundbank.com/) が CC0（パブリックドメイン、帰属表示不要）で公開している素材から、単発の打撃音を切り出して使用している。音色間の音量差をなくすため、全ファイルをピーク音量-1.0dBFSに揃えてある。

| ファイル | 元音源 |
|---|---|
| `click.wav` | Metronome a 120bpm (ID 0468) |
| `beep.wav` | Electric metronome (ID 0577) |
| `wood.wav` | Drumsticks 1 (ID 1488) |
| `block.wav` | Block "Meinl" in wood (ID s0466) |
| `bell.wav` | Counter bell 2 (ID 2530) |

## ローカル確認
```
python -m http.server 8000
```
`http://localhost:8000` にアクセス。

## 公開（GitHub Pages）
リポジトリの Settings > Pages で、ソースを `main` ブランチ / ルートディレクトリに設定する。

## 紹介ページ

- [制作物ページ（Mori Lab）](https://morilab-garage.com/projects/web-metronome/)
- [開発ブログ記事（はてなブログ）](https://mementomori7272.hatenablog.com/entry/2026/09/03/030002)
