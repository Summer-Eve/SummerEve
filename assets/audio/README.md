# 日晷音频 · 本地试听 v3

背景音乐由 `scripts/make_audio.py` 程序合成，未更改。当前两段音效直接采用用户提供的参考录音，以保留清晰的翻书声和真实的硬木碰撞质感；仅转为单声道，木碰声在自然衰减后补足一秒播放窗口。仍待用户主观试听验收。

| 文件 | 时长 | 内容 |
| --- | --- | --- |
| courtyard-story-v1.wav | 72 秒，循环 | 《庭院叙事》：五声音阶拨弦、箫感旋律、低音铺底；引入、主题、抬升、收束四段 |
| pages-turn-v3.wav | 2.608 秒 | 来自 `mixkit-single-book-paging-1101.wav`，两次清晰翻书声 |
| scroll-wood-v3.wav | 1 秒播放窗口 | 来自 `mixkit-wood-hard-hit-2182.wav`，约 0.417 秒的沉闷硬木撞击与自然衰减，余下静音 |

音效为单声道 44100 Hz / 16-bit PCM WAV，背景音乐保持原格式。首次用户交互后按需加载；音乐循环、切后台暂停。音频下载失败不阻塞游戏。音量与开关随存档保存。跳过展卷取消尚未开始或正在播放的翻页声；点击结果关闭、Esc 关闭播放一次木碰声，再抽按钮不触发木碰声。

复现：`python scripts/import_reference_foley.py <翻页参考.wav> <木碰参考.wav>`。旧版音效仅在本地留存供对比，游戏发布版使用 v3。两段参考录音由用户提供，分别对应 Mixkit 的 [Single book paging](https://mixkit.co/free-sound-effects/page/) 与 [Wood hard hit](https://mixkit.co/free-sound-effects/wood/)；依照其 [Sound Effects Free License](https://mixkit.co/license/modal/sfxFree/) 用于游戏成品，不将参考原件或历史版本作为独立素材发布。
