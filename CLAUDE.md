# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

インストール不要・スマホ対応のシンプルなWebメトロノーム。ビルドステップなしの素のHTML/CSS/JS（ES Modules）。フレームワーク・パッケージマネージャなし。

## Commands

ビルド・lint・テストのツールチェーンは存在しない。ローカル確認は静的サーバーを立てるだけ:

```
python -m http.server 8000
```

`http://localhost:8000` にアクセス。JS構文エラーの簡易チェックには `node --check js/<file>.js` が使える（テストランナーはない）。

公開はGitHub Pages（リポジトリの Settings > Pages で `main` ブランチ/ルートを指定）。

## Architecture

### Audio scheduling — the core of the app

`js/scheduler.js` の `Scheduler` クラスが全ての拍生成を担う。Chris Wilsonの "A Tale of Two Clocks" lookaheadパターンを実装しており、`setTimeout`/`setInterval`単独でのタイミング管理は使わない（バックグラウンドタブでのドリフトを防ぐため）:

- `_tick()` が25ms間隔(`LOOKAHEAD_MS`)で走り、`audioContext.currentTime`から100秒先(`SCHEDULE_AHEAD_SEC`)までの拍を絶対時刻でスケジュールする
- 拍の発音自体は`AudioContext.currentTime`基準の絶対時刻で`js/sounds.js`に委譲。UI側のコールバック(`onBeat`)は`setTimeout`で該当時刻に発火するが、これは視覚/触覚フィードバック用であり音のタイミング自体には影響しない
- カウントイン・スピードトレーナー・シャッフル（スウィング）・小節頭ベルは全て`_scheduleBeat`/`_advanceNote`/`_maybeAdvanceTrainer`のこのループの中で処理される。新しい拍単位の機能を足すときはここに触ることになる

### Pendulum visual sync — non-obvious physics model

`js/visualBeat.js` の振り子アニメーションは、拍を「振り子が端に到達する瞬間」ではなく「**振り子が中心(0deg)を通過する瞬間**」としてモデル化している。実物のメトロノームの脱進機構がカチッと鳴るのは中心通過時であり、端到達時ではないため。角度計算は`_frameAt()`内のサイン波:

```
angle = dir * MAX_ANGLE * Math.sin(Math.PI * progress)
```

`progress`は「直近の拍(中心通過)」から「次の拍(次の中心通過)」への進行度(0〜1)。CSSアニメーションではなく`requestAnimationFrame`ループで毎フレーム`scheduler.currentTime()`（`AudioContext.currentTime`）を参照して角度を再計算しており、クリック音とのズレが出ない設計になっている。BPM変更・スピードトレーナーの加速時もここが自動追従する。

支点は`transform-origin: bottom center`（`.pendulum`のtransform-origin）。実物同様、重り(`.pendulum-weight`)の位置はBPMに応じて`--weight-pos`（CSS変数）でスライドする（遅いBPM→重りは先端寄り、速いBPM→支点寄り）。BPM↔`weight-pos`の相互変換は`visualBeat.js`の`weightPosToBpm`/`bpmToWeightPos`に集約されている。

重りはドラッグ（`main.js`のIIFE、`pointerdown`/`pointermove`）でもBPM変更できる。再生中に掴むと振り子の回転とドラッグ方向がずれるため、掴んだ瞬間だけ`visualBeat.stopPendulum()`で振り子を垂直固定し、離すと`startPendulum()`で再同期する。

### Sound files: real samples with oscillator fallback

`js/sounds.js`はAudioBufferSourceNodeで`sounds/*.wav`の実サンプル音声を再生する。読込前・失敗時はOscillator+GainNode合成音(`OSC_PARAMS`)にフォールバックする。音色ごとに専用ファイルが1対1対応（`SOUND_FILES`）。

`sounds/`内の音声はBigSoundBank.com（CC0）由来。**ファイル名と中身の音の実態を一致させること** — 過去に「cowbell.wav」という名前でドラムスティック音が入っていた事故があり、これは実際のカウベル/ウッドブロック音（`block.wav`）に差し替えて名前を訂正した経緯がある。新しい音源を追加する際は、ラベルと実際の音色が一致しているか必ず確認する。出典は`README.md`の「音源クレジット」表に追記する。

小節頭ベル（`playBell`）は通常の`soundType`とは独立した機能で、`Scheduler.bellEnabled`/`bellEveryBars`（1/2/4小節ごと）で制御し、アクセント拍に重ねて鳴らす。単独の音色選択肢ではない。

### Persistence: 5 config banks, single localStorage-backed store

`js/quickSlots.js`が唯一の永続化ストアで、「保存」という明示的な操作は存在しない。BPM・拍子・音色・各種トグルを含む設定一式を持つ1〜5の固定バンクを切り替えて使うモデルで、選択中バンクの中身は`main.js`の`SETTINGS_WATCH_IDS`にリストされた全input/selectの変更を監視して`persistSettings()`が自動的に上書き保存する（`saveSlot(activeSlot, ...)`）。どのバンクを選択中かも`saveActiveSlot()`で永続化される。新しい設定項目を追加したら、UI要素をこのリストと`collectSettings()`/`applyConfig()`の両方に追加すること。以前存在した名前付きプリセット機能（`presets.js`）と全体設定の自動保存（`settings.js`）はどちらも廃止され、この単一モデルに統合された

### PWA / offline

`sw.js`はcache-firstのService Worker。`ASSETS`配列に全静的ファイル（JS/CSS/音声/アイコン）を列挙しており、**新しいJSファイルや音声ファイルを追加したら`ASSETS`に追記し、`CACHE_NAME`のバージョンをインクリメントする**（インクリメントし忘れると古いキャッシュが残り続ける）。

### Module dependency shape

`js/main.js`が全モジュールを束ねるエントリポイント（DOM要素取得・イベント配線・各モジュール間の橋渡し）。他のモジュールは互いにほぼ依存せず、`main.js`からのみimportされる木構造:

```
main.js
├── scheduler.js → sounds.js（音の生成・再生）
├── visualBeat.js（振り子・フラッシュ・拍数表示、schedulerからは`getAudioTime`コールバックのみ受け取る）
├── tapTempo.js / haptics.js / wakeLock.js（単機能ユーティリティ）
└── quickSlots.js（localStorage CRUD）
```
