import { useNavigate } from "react-router-dom";
import { useCamera } from "@/hooks/useCamera";
import { useSwipeUp } from "@/hooks/useSwipeUp";
import CaptureTopBar from "./components/CaptureTopBar";
import CaptureSettingsBar from "./components/CaptureSettingsBar";
import CaptureViewfinder from "./components/CaptureViewfinder";
import CaptureControls from "./components/CaptureControls";

export const CaptureView: React.FC = () => {
  const navigate = useNavigate();
  const {
    mode,
    setMode,
    mirror,
    setMirror,
    aspectRatio,
    setAspectRatio,
    showGrid,
    setShowGrid,
    timerDelay,
    setTimerDelay,
    countdown,
    showSettings,
    setShowSettings,
    ready,
    error,
    retry,
    recording,
    timer,
    preview,
    saving,
    saved,
    videoRef,
    vfBoxRef,
    vfSize,
    flipCamera,
    handleShutterDown,
    handleShutterUp,
    handleShutterCancel,
    resetCapture,
    saveCapture,
  } = useCamera();

  // Vuốt lên từ vùng camera → mở Moments
  const swipeUp = useSwipeUp(() => {
    if (recording || preview || saving) return;
    navigate("/moments");
  });

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
      {...swipeUp}
    >
      {/* Top bar */}
      <CaptureTopBar
        onBack={() => navigate("/gallery")}
        showSettings={showSettings}
        disabled={recording || !!preview}
        onToggleSettings={() => setShowSettings((s) => !s)}
      />

      {/* Settings bar */}
      {showSettings && !preview && !recording && (
        <CaptureSettingsBar
          aspectRatio={aspectRatio}
          onAspectChange={setAspectRatio}
          showGrid={showGrid}
          onGridToggle={() => setShowGrid((g) => !g)}
          timerDelay={timerDelay}
          onTimerToggle={() =>
            setTimerDelay((d) => (d === 0 ? 3 : d === 3 ? 5 : 0))
          }
          mirror={mirror}
          onMirrorToggle={() => setMirror((m) => !m)}
        />
      )}

      {/* Viewfinder */}
      <CaptureViewfinder
        error={error}
        onRetry={retry}
        ready={ready}
        videoRef={videoRef}
        vfBoxRef={vfBoxRef}
        vfSize={vfSize}
        aspectRatio={aspectRatio}
        mirror={mirror}
        showGrid={showGrid}
        countdown={countdown}
        recording={recording}
        timer={timer}
        preview={preview}
        saved={saved}
        saving={saving}
        onReset={resetCapture}
        onSave={saveCapture}
      />

      {/* Controls */}
      {!preview && (
        <CaptureControls
          mode={mode}
          onModeChange={setMode}
          recording={recording}
          countdown={countdown}
          timerDelay={timerDelay}
          timer={timer}
          onFlip={flipCamera}
          onShutterDown={handleShutterDown}
          onShutterUp={handleShutterUp}
          onShutterCancel={handleShutterCancel}
        />
      )}
    </div>
  );
};