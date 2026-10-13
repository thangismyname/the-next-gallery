# Live Vision (Camera AR) — Design

> Status: **not yet implemented.** This document is the design reference for the
> feature if it is built. It is kept separate from the current feature set.

## Overview

Live Vision is an in-browser camera mode that runs on-device vision models while
capturing, and overlays meme stickers anchored to detected features (hand
gesture or face expression). The overlay is baked into the captured photo or
video, so the result is a normal media file.

## Goals

- Real-time, on-device inference (no per-frame server round-trip).
- Anchor meme stickers to detected hand/face features in the viewfinder.
- Bake the overlay into the final photo/video output.
- Degrade gracefully to a server-side fallback when on-device inference fails.

## Architecture

- **On-device inference:** MediaPipe Tasks Vision (hand + face landmarks) loaded
  from static assets served by the AI service; a lazy singleton bundle is loaded
  once and reused per frame.
- **Camera loop:** a `requestAnimationFrame` loop reads frames from the video
  element, runs detection, and drives the overlay canvas without React state
  churn at 60fps (state kept in refs).
- **Overlay:** a canvas layer renders the hand/face skeleton and the current meme
  sticker, mapped from normalized coordinates to the displayed video rect.
- **Bake:** the same drawing routine is reused to composite the overlay onto the
  captured frame (photo) and into the video mirror pipeline.
- **Fallback:** if the on-device bundle fails to load, snapshot frames are sent
  to the AI service detection endpoint at a throttled interval.

## Components

- A `useLiveVision`-style hook: manages camera, the frame loop, pause/resume,
  status (`idle | loading | ready | error`), and fallback behavior.
- An overlay component bound to the viewfinder that draws the AR frame.
- A shared overlay-drawing utility used by both the live preview and the bake step.
- A meme picker that selects the sticker to anchor, using a source that does not
  taint the canvas.

## Data Flow

1. Camera stream → video element.
2. Frame loop reads a frame → on-device model → detection result.
3. Detection result → overlay canvas (skeleton + anchored meme).
4. On capture → composite the current frame + overlay → output blob.

## Notes

- Static WASM/model assets are served by the AI service; they are not bundled
  into the frontend.
- Keep the on-device expression/gesture mapping consistent with the AI service
  so live and server results agree.
